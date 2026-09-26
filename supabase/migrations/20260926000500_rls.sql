-- ============================================================================
-- StockSense — Migration 5: Row Level Security & privileges
-- Strategy (DataBase.md §27, master rules §16/§22):
--   * Every application table has RLS enabled.
--   * Authenticated users can READ application data.
--   * Master data (products, categories, warehouses, locations) is written by
--     INVENTORY_MANAGER; suppliers/customers by any authenticated user.
--   * inventory, stock_movements, reference_counters and ALL operation tables
--     have NO client write policies: they change only through the
--     SECURITY DEFINER functions of migration 3. The frontend can never be
--     the source of truth for stock.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.categories         enable row level security;
alter table public.products           enable row level security;
alter table public.warehouses         enable row level security;
alter table public.locations          enable row level security;
alter table public.inventory          enable row level security;
alter table public.suppliers          enable row level security;
alter table public.customers          enable row level security;
alter table public.reference_counters enable row level security;
alter table public.receipts           enable row level security;
alter table public.receipt_items      enable row level security;
alter table public.deliveries         enable row level security;
alter table public.delivery_items     enable row level security;
alter table public.transfers          enable row level security;
alter table public.transfer_items     enable row level security;
alter table public.adjustments        enable row level security;
alter table public.adjustment_items   enable row level security;
alter table public.stock_movements    enable row level security;

-- ---------------------------------------------------------------------------
-- Table privileges (defence in depth on top of RLS)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

-- read access for signed-in users (tables + views)
grant select on all tables in schema public to authenticated;
revoke select on public.reference_counters from authenticated;

-- master data writes (RLS decides who)
grant insert, update, delete on public.categories, public.products,
                                public.warehouses, public.locations,
                                public.suppliers, public.customers to authenticated;

-- users may edit their own display fields only (never role / email / id)
grant update (full_name, login_id) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- profiles
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- categories / products / warehouses / locations : read all, write manager
do $$
declare
  t text;
begin
  foreach t in array array['categories', 'products', 'warehouses', 'locations'] loop
    execute format('drop policy if exists %1$s_select_authenticated on public.%1$I', t);
    execute format('create policy %1$s_select_authenticated on public.%1$I for select to authenticated using (true)', t);

    execute format('drop policy if exists %1$s_insert_manager on public.%1$I', t);
    execute format('create policy %1$s_insert_manager on public.%1$I for insert to authenticated with check (public.is_inventory_manager())', t);

    execute format('drop policy if exists %1$s_update_manager on public.%1$I', t);
    execute format('create policy %1$s_update_manager on public.%1$I for update to authenticated using (public.is_inventory_manager()) with check (public.is_inventory_manager())', t);

    execute format('drop policy if exists %1$s_delete_manager on public.%1$I', t);
    execute format('create policy %1$s_delete_manager on public.%1$I for delete to authenticated using (public.is_inventory_manager())', t);
  end loop;
end $$;

-- suppliers / customers : read all, insert/update any authenticated, delete manager
do $$
declare
  t text;
begin
  foreach t in array array['suppliers', 'customers'] loop
    execute format('drop policy if exists %1$s_select_authenticated on public.%1$I', t);
    execute format('create policy %1$s_select_authenticated on public.%1$I for select to authenticated using (true)', t);

    execute format('drop policy if exists %1$s_insert_authenticated on public.%1$I', t);
    execute format('create policy %1$s_insert_authenticated on public.%1$I for insert to authenticated with check (true)', t);

    execute format('drop policy if exists %1$s_update_authenticated on public.%1$I', t);
    execute format('create policy %1$s_update_authenticated on public.%1$I for update to authenticated using (true) with check (true)', t);

    execute format('drop policy if exists %1$s_delete_manager on public.%1$I', t);
    execute format('create policy %1$s_delete_manager on public.%1$I for delete to authenticated using (public.is_inventory_manager())', t);
  end loop;
end $$;

-- inventory, ledger and operations : READ ONLY for clients (writes via RPC only)
do $$
declare
  t text;
begin
  foreach t in array array[
    'inventory', 'stock_movements',
    'receipts', 'receipt_items',
    'deliveries', 'delivery_items',
    'transfers', 'transfer_items',
    'adjustments', 'adjustment_items'
  ] loop
    execute format('drop policy if exists %1$s_select_authenticated on public.%1$I', t);
    execute format('create policy %1$s_select_authenticated on public.%1$I for select to authenticated using (true)', t);
  end loop;
end $$;
-- reference_counters: no policies at all → invisible to clients.

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

-- internal helpers: not callable by clients (only via SECURITY DEFINER callers)
revoke execute on function public._assert_authenticated()                          from public, anon, authenticated;
revoke execute on function public._jsonb_uuid(jsonb, text)                          from public, anon, authenticated;
revoke execute on function public._jsonb_ts(jsonb, text)                            from public, anon, authenticated;
revoke execute on function public._warehouse_of_location(uuid)                      from public, anon, authenticated;
revoke execute on function public._product_label(uuid)                              from public, anon, authenticated;
revoke execute on function public._location_label(uuid)                             from public, anon, authenticated;
revoke execute on function public._insert_movement(text, uuid, text, numeric, uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public._replace_quantity_items(text, text, uuid, jsonb)  from public, anon, authenticated;
revoke execute on function public._replace_adjustment_items(uuid, jsonb)            from public, anon, authenticated;
revoke execute on function public._refresh_adjustment_snapshot(uuid)                from public, anon, authenticated;
revoke execute on function public._try_reserve_delivery(uuid)                       from public, anon, authenticated;
revoke execute on function public._release_delivery_reservation(uuid)               from public, anon, authenticated;
revoke execute on function public._recheck_waiting_deliveries(uuid)                 from public, anon, authenticated;
revoke execute on function public.next_reference(uuid, text)                        from public, anon, authenticated;

-- pre-auth helpers: anon + authenticated
grant execute on function public.login_id_available(text)  to anon, authenticated;
grant execute on function public.email_for_login_id(text)  to anon, authenticated;

-- application RPCs: authenticated only
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.create_receipt(jsonb)',
    'public.update_receipt(uuid, jsonb)',
    'public.create_delivery(jsonb)',
    'public.update_delivery(uuid, jsonb)',
    'public.create_transfer(jsonb)',
    'public.update_transfer(uuid, jsonb)',
    'public.create_adjustment(jsonb)',
    'public.update_adjustment(uuid, jsonb)',
    'public.mark_ready(text, uuid)',
    'public.validate_receipt(uuid)',
    'public.validate_delivery(uuid)',
    'public.validate_transfer(uuid)',
    'public.validate_adjustment(uuid)',
    'public.cancel_operation(text, uuid)',
    'public.set_delivery_lines_progress(uuid, text)',
    'public.init_product_stock(uuid, uuid, numeric, text)',
    'public.dashboard_kpis(uuid, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
