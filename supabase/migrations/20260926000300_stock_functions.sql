-- ============================================================================
-- StockSense — Migration 3: stock operations (atomic database functions)
--
-- EVERY stock-changing operation runs inside ONE database function so that
--   update inventory + insert stock_movements + update operation status
-- either all succeed or all roll back (SystemDesign.md §17, DataBase.md §28).
--
-- The frontend NEVER writes inventory or stock_movements directly
-- (SystemArchitecture.md §15). Public RPCs exposed to the app:
--   create_receipt / update_receipt        create_delivery / update_delivery
--   create_transfer / update_transfer      create_adjustment / update_adjustment
--   mark_ready(op_type, id)                cancel_operation(op_type, id)
--   validate_receipt / validate_delivery / validate_transfer / validate_adjustment
--   init_product_stock(product, location, qty)   set_delivery_lines_progress(id, stage)
-- Helpers prefixed with "_" are internal (EXECUTE revoked in the RLS migration).
--
-- Reservation rule (approved): a delivery reserves stock when it becomes READY,
-- consumes it on DONE and releases it on CANCEL. free_to_use = quantity - reserved.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------------------
create or replace function public._assert_authenticated()
returns uuid
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

create or replace function public._jsonb_uuid(p jsonb, p_key text)
returns uuid
language sql
immutable
as $$
  select nullif(trim(coalesce(p ->> p_key, '')), '')::uuid;
$$;

create or replace function public._jsonb_ts(p jsonb, p_key text)
returns timestamptz
language sql
immutable
as $$
  select nullif(trim(coalesce(p ->> p_key, '')), '')::timestamptz;
$$;

create or replace function public._warehouse_of_location(p_location_id uuid)
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select warehouse_id from public.locations where id = p_location_id;
$$;

create or replace function public._product_label(p_product_id uuid)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(name || ' (' || sku || ')', p_product_id::text) from public.products where id = p_product_id;
$$;

create or replace function public._location_label(p_location_id uuid)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(w.code || ' / ' || l.name, p_location_id::text)
  from public.locations l
  join public.warehouses w on w.id = l.warehouse_id
  where l.id = p_location_id;
$$;

-- ---------------------------------------------------------------------------
-- Reference generation: <Warehouse>/<Operation>/<ID>  e.g. WH/IN/0001
-- One counter per (warehouse, operation) — DataBase.md §26. The row-level
-- lock taken by INSERT ... ON CONFLICT DO UPDATE serialises concurrent users.
-- ---------------------------------------------------------------------------
create or replace function public.next_reference(p_warehouse_id uuid, p_operation_type text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code   text;
  v_prefix text;
  v_number integer;
begin
  select code into v_code from public.warehouses where id = p_warehouse_id;
  if v_code is null then
    raise exception 'Warehouse not found';
  end if;

  v_prefix := case p_operation_type
    when 'RECEIPT'    then 'IN'
    when 'DELIVERY'   then 'OUT'
    when 'TRANSFER'   then 'TR'
    when 'ADJUSTMENT' then 'ADJ'
  end;
  if v_prefix is null then
    raise exception 'Invalid operation type: %', p_operation_type;
  end if;

  insert into public.reference_counters (warehouse_id, operation_type, last_number)
  values (p_warehouse_id, p_operation_type, 1)
  on conflict (warehouse_id, operation_type)
  do update set last_number = public.reference_counters.last_number + 1
  returning last_number into v_number;

  return format('%s/%s/%s', v_code, v_prefix, lpad(v_number::text, 4, '0'));
end;
$$;

-- ---------------------------------------------------------------------------
-- Ledger insert helper
-- ---------------------------------------------------------------------------
create or replace function public._insert_movement(
  p_reference      text,
  p_product_id     uuid,
  p_movement_type  text,
  p_quantity       numeric,
  p_from_location  uuid,
  p_to_location    uuid,
  p_operation_id   uuid,
  p_operation_type text,
  p_notes          text default null
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.stock_movements
    (reference, product_id, movement_type, quantity, from_location_id, to_location_id,
     operation_id, operation_type, performed_by, notes)
  values
    (p_reference, p_product_id, p_movement_type, p_quantity, p_from_location, p_to_location,
     p_operation_id, p_operation_type, auth.uid(), p_notes);
$$;

-- ---------------------------------------------------------------------------
-- Line items: replace the quantity lines of a receipt / delivery / transfer.
-- Duplicate product lines are merged. Quantity must be > 0.
-- ---------------------------------------------------------------------------
create or replace function public._replace_quantity_items(
  p_table     text,      -- 'receipt_items' | 'delivery_items' | 'transfer_items'
  p_fk_column text,      -- 'receipt_id' | 'delivery_id' | 'transfer_id'
  p_id        uuid,
  p_items     jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r       record;
  v_count integer := 0;
begin
  if p_table not in ('receipt_items', 'delivery_items', 'transfer_items') then
    raise exception 'Invalid items table';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Items must be an array';
  end if;

  execute format('delete from public.%I where %I = $1', p_table, p_fk_column) using p_id;

  for r in
    select public._jsonb_uuid(x, 'product_id') as product_id,
           nullif(trim(coalesce(x ->> 'quantity', '')), '')::numeric as quantity
    from jsonb_array_elements(p_items) x
  loop
    if r.product_id is null then
      raise exception 'Each line must have a product';
    end if;
    if r.quantity is null or r.quantity <= 0 then
      raise exception 'Quantity must be greater than 0 for %', public._product_label(r.product_id);
    end if;
    if not exists (select 1 from public.products where id = r.product_id) then
      raise exception 'Product not found';
    end if;

    execute format(
      'insert into public.%I (%I, product_id, quantity) values ($1, $2, $3)
       on conflict (%I, product_id) do update set quantity = public.%I.quantity + excluded.quantity',
      p_table, p_fk_column, p_fk_column, p_table
    ) using p_id, r.product_id, r.quantity;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Re-read the recorded quantity of every line of an adjustment from inventory.
create or replace function public._refresh_adjustment_snapshot(p_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.adjustment_items ai
     set recorded_quantity = coalesce(s.qty, 0),
         difference        = ai.counted_quantity - coalesce(s.qty, 0)
    from (
      select ai2.id, i.quantity as qty
      from public.adjustment_items ai2
      join public.adjustments a on a.id = ai2.adjustment_id
      left join public.inventory i
        on i.location_id = a.location_id and i.product_id = ai2.product_id
      where a.id = p_id
    ) s
   where s.id = ai.id;
$$;

-- Adjustment lines: { product_id, counted_quantity }. recorded_quantity is a
-- snapshot for display; it is re-read (authoritatively) at validation time.
create or replace function public._replace_adjustment_items(p_id uuid, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r          record;
  v_loc      uuid;
  v_recorded numeric;
  v_count    integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Items must be an array';
  end if;

  select location_id into v_loc from public.adjustments where id = p_id;
  delete from public.adjustment_items where adjustment_id = p_id;

  for r in
    select public._jsonb_uuid(x, 'product_id') as product_id,
           nullif(trim(coalesce(x ->> 'counted_quantity', '')), '')::numeric as counted_quantity
    from jsonb_array_elements(p_items) x
  loop
    if r.product_id is null then
      raise exception 'Each line must have a product';
    end if;
    if r.counted_quantity is null or r.counted_quantity < 0 then
      raise exception 'Counted quantity must be 0 or more for %', public._product_label(r.product_id);
    end if;
    if not exists (select 1 from public.products where id = r.product_id) then
      raise exception 'Product not found';
    end if;

    select coalesce(quantity, 0) into v_recorded
    from public.inventory where product_id = r.product_id and location_id = v_loc;
    v_recorded := coalesce(v_recorded, 0);

    insert into public.adjustment_items (adjustment_id, product_id, recorded_quantity, counted_quantity, difference)
    values (p_id, r.product_id, v_recorded, r.counted_quantity, r.counted_quantity - v_recorded)
    on conflict (adjustment_id, product_id) do update
      set counted_quantity = excluded.counted_quantity,
          recorded_quantity = excluded.recorded_quantity,
          difference = excluded.difference;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ===========================================================================
-- RECEIPTS
-- payload: { warehouse_id?, location_id, supplier_id?, schedule_date?,
--            responsible_user_id?, items: [{ product_id, quantity }] }
-- ===========================================================================
create or replace function public.create_receipt(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public._assert_authenticated();
  v_id  uuid;
  v_loc uuid := public._jsonb_uuid(payload, 'location_id');
  v_wh  uuid := public._jsonb_uuid(payload, 'warehouse_id');
begin
  if v_loc is null then
    raise exception 'Destination location is required';
  end if;
  v_wh := coalesce(v_wh, public._warehouse_of_location(v_loc));
  if public._warehouse_of_location(v_loc) is distinct from v_wh then
    raise exception 'Location does not belong to the selected warehouse';
  end if;

  insert into public.receipts
    (reference, warehouse_id, location_id, supplier_id, schedule_date, status, responsible_user_id, created_by)
  values
    (public.next_reference(v_wh, 'RECEIPT'), v_wh, v_loc,
     public._jsonb_uuid(payload, 'supplier_id'),
     coalesce(public._jsonb_ts(payload, 'schedule_date'), now()),
     'DRAFT',
     coalesce(public._jsonb_uuid(payload, 'responsible_user_id'), v_uid),
     v_uid)
  returning id into v_id;

  perform public._replace_quantity_items('receipt_items', 'receipt_id', v_id, coalesce(payload -> 'items', '[]'::jsonb));
  return v_id;
end;
$$;

create or replace function public.update_receipt(p_id uuid, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec public.receipts%rowtype;
  v_loc uuid;
begin
  perform public._assert_authenticated();
  select * into v_rec from public.receipts where id = p_id for update;
  if not found then raise exception 'Receipt not found'; end if;
  if v_rec.status <> 'DRAFT' then
    raise exception 'Only DRAFT receipts can be edited (current status: %)', v_rec.status;
  end if;

  v_loc := coalesce(public._jsonb_uuid(payload, 'location_id'), v_rec.location_id);
  if public._warehouse_of_location(v_loc) <> v_rec.warehouse_id then
    raise exception 'The warehouse of a receipt cannot change after creation (reference %)', v_rec.reference;
  end if;

  update public.receipts set
    location_id         = v_loc,
    supplier_id         = case when payload ? 'supplier_id' then public._jsonb_uuid(payload, 'supplier_id') else supplier_id end,
    schedule_date       = coalesce(public._jsonb_ts(payload, 'schedule_date'), schedule_date),
    responsible_user_id = case when payload ? 'responsible_user_id' then public._jsonb_uuid(payload, 'responsible_user_id') else responsible_user_id end
  where id = p_id;

  if payload ? 'items' then
    perform public._replace_quantity_items('receipt_items', 'receipt_id', p_id, payload -> 'items');
  end if;
  return p_id;
end;
$$;

-- ===========================================================================
-- DELIVERIES
-- payload: { warehouse_id?, source_location_id, customer_id?, schedule_date?,
--            responsible_user_id?, items: [{ product_id, quantity }] }
-- ===========================================================================
create or replace function public.create_delivery(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public._assert_authenticated();
  v_id  uuid;
  v_loc uuid := public._jsonb_uuid(payload, 'source_location_id');
  v_wh  uuid := public._jsonb_uuid(payload, 'warehouse_id');
begin
  if v_loc is null then
    raise exception 'Source location is required';
  end if;
  v_wh := coalesce(v_wh, public._warehouse_of_location(v_loc));
  if public._warehouse_of_location(v_loc) is distinct from v_wh then
    raise exception 'Location does not belong to the selected warehouse';
  end if;

  insert into public.deliveries
    (reference, warehouse_id, source_location_id, customer_id, schedule_date, status, responsible_user_id, created_by)
  values
    (public.next_reference(v_wh, 'DELIVERY'), v_wh, v_loc,
     public._jsonb_uuid(payload, 'customer_id'),
     coalesce(public._jsonb_ts(payload, 'schedule_date'), now()),
     'DRAFT',
     coalesce(public._jsonb_uuid(payload, 'responsible_user_id'), v_uid),
     v_uid)
  returning id into v_id;

  perform public._replace_quantity_items('delivery_items', 'delivery_id', v_id, coalesce(payload -> 'items', '[]'::jsonb));
  return v_id;
end;
$$;

create or replace function public.update_delivery(p_id uuid, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec public.deliveries%rowtype;
  v_loc uuid;
begin
  perform public._assert_authenticated();
  select * into v_rec from public.deliveries where id = p_id for update;
  if not found then raise exception 'Delivery not found'; end if;
  -- WAITING deliveries hold no reservation, so their lines may still be edited.
  if v_rec.status not in ('DRAFT', 'WAITING') then
    raise exception 'Only DRAFT or WAITING deliveries can be edited (current status: %)', v_rec.status;
  end if;

  v_loc := coalesce(public._jsonb_uuid(payload, 'source_location_id'), v_rec.source_location_id);
  if public._warehouse_of_location(v_loc) <> v_rec.warehouse_id then
    raise exception 'The warehouse of a delivery cannot change after creation (reference %)', v_rec.reference;
  end if;

  update public.deliveries set
    source_location_id  = v_loc,
    customer_id         = case when payload ? 'customer_id' then public._jsonb_uuid(payload, 'customer_id') else customer_id end,
    schedule_date       = coalesce(public._jsonb_ts(payload, 'schedule_date'), schedule_date),
    responsible_user_id = case when payload ? 'responsible_user_id' then public._jsonb_uuid(payload, 'responsible_user_id') else responsible_user_id end
  where id = p_id;

  if payload ? 'items' then
    perform public._replace_quantity_items('delivery_items', 'delivery_id', p_id, payload -> 'items');
  end if;
  return p_id;
end;
$$;

-- ===========================================================================
-- TRANSFERS
-- payload: { source_location_id, destination_location_id, schedule_date?,
--            responsible_user_id?, items: [{ product_id, quantity }] }
-- Reference uses the SOURCE location's warehouse code.
-- ===========================================================================
create or replace function public.create_transfer(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public._assert_authenticated();
  v_id  uuid;
  v_src uuid := public._jsonb_uuid(payload, 'source_location_id');
  v_dst uuid := public._jsonb_uuid(payload, 'destination_location_id');
  v_wh  uuid;
begin
  if v_src is null or v_dst is null then
    raise exception 'Source and destination locations are required';
  end if;
  if v_src = v_dst then
    raise exception 'Source and destination locations must be different';
  end if;
  v_wh := public._warehouse_of_location(v_src);
  if v_wh is null or public._warehouse_of_location(v_dst) is null then
    raise exception 'Location not found';
  end if;

  insert into public.transfers
    (reference, source_location_id, destination_location_id, schedule_date, status, responsible_user_id, created_by)
  values
    (public.next_reference(v_wh, 'TRANSFER'), v_src, v_dst,
     coalesce(public._jsonb_ts(payload, 'schedule_date'), now()),
     'DRAFT',
     coalesce(public._jsonb_uuid(payload, 'responsible_user_id'), v_uid),
     v_uid)
  returning id into v_id;

  perform public._replace_quantity_items('transfer_items', 'transfer_id', v_id, coalesce(payload -> 'items', '[]'::jsonb));
  return v_id;
end;
$$;

create or replace function public.update_transfer(p_id uuid, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec public.transfers%rowtype;
  v_src uuid;
  v_dst uuid;
begin
  perform public._assert_authenticated();
  select * into v_rec from public.transfers where id = p_id for update;
  if not found then raise exception 'Transfer not found'; end if;
  if v_rec.status <> 'DRAFT' then
    raise exception 'Only DRAFT transfers can be edited (current status: %)', v_rec.status;
  end if;

  v_src := coalesce(public._jsonb_uuid(payload, 'source_location_id'), v_rec.source_location_id);
  v_dst := coalesce(public._jsonb_uuid(payload, 'destination_location_id'), v_rec.destination_location_id);
  if v_src = v_dst then
    raise exception 'Source and destination locations must be different';
  end if;
  if public._warehouse_of_location(v_src) <> public._warehouse_of_location(v_rec.source_location_id) then
    raise exception 'The source warehouse of a transfer cannot change after creation (reference %)', v_rec.reference;
  end if;

  update public.transfers set
    source_location_id      = v_src,
    destination_location_id = v_dst,
    schedule_date           = coalesce(public._jsonb_ts(payload, 'schedule_date'), schedule_date),
    responsible_user_id     = case when payload ? 'responsible_user_id' then public._jsonb_uuid(payload, 'responsible_user_id') else responsible_user_id end
  where id = p_id;

  if payload ? 'items' then
    perform public._replace_quantity_items('transfer_items', 'transfer_id', p_id, payload -> 'items');
  end if;
  return p_id;
end;
$$;

-- ===========================================================================
-- ADJUSTMENTS
-- payload: { location_id, reason, schedule_date?, responsible_user_id?,
--            items: [{ product_id, counted_quantity }] }
-- ===========================================================================
create or replace function public.create_adjustment(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := public._assert_authenticated();
  v_id     uuid;
  v_loc    uuid := public._jsonb_uuid(payload, 'location_id');
  v_reason text := nullif(trim(coalesce(payload ->> 'reason', '')), '');
  v_wh     uuid;
begin
  if v_loc is null then
    raise exception 'Location is required';
  end if;
  if v_reason is null then
    raise exception 'Adjustments must include a reason';
  end if;
  v_wh := public._warehouse_of_location(v_loc);
  if v_wh is null then
    raise exception 'Location not found';
  end if;

  insert into public.adjustments
    (reference, location_id, schedule_date, status, reason, responsible_user_id, created_by)
  values
    (public.next_reference(v_wh, 'ADJUSTMENT'), v_loc,
     coalesce(public._jsonb_ts(payload, 'schedule_date'), now()),
     'DRAFT', v_reason,
     coalesce(public._jsonb_uuid(payload, 'responsible_user_id'), v_uid),
     v_uid)
  returning id into v_id;

  perform public._replace_adjustment_items(v_id, coalesce(payload -> 'items', '[]'::jsonb));
  return v_id;
end;
$$;

create or replace function public.update_adjustment(p_id uuid, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec    public.adjustments%rowtype;
  v_loc    uuid;
  v_reason text;
begin
  perform public._assert_authenticated();
  select * into v_rec from public.adjustments where id = p_id for update;
  if not found then raise exception 'Adjustment not found'; end if;
  if v_rec.status <> 'DRAFT' then
    raise exception 'Only DRAFT adjustments can be edited (current status: %)', v_rec.status;
  end if;

  v_loc := coalesce(public._jsonb_uuid(payload, 'location_id'), v_rec.location_id);
  if public._warehouse_of_location(v_loc) <> public._warehouse_of_location(v_rec.location_id) then
    raise exception 'The warehouse of an adjustment cannot change after creation (reference %)', v_rec.reference;
  end if;
  v_reason := coalesce(nullif(trim(coalesce(payload ->> 'reason', '')), ''), v_rec.reason);

  update public.adjustments set
    location_id         = v_loc,
    reason              = v_reason,
    schedule_date       = coalesce(public._jsonb_ts(payload, 'schedule_date'), schedule_date),
    responsible_user_id = case when payload ? 'responsible_user_id' then public._jsonb_uuid(payload, 'responsible_user_id') else responsible_user_id end
  where id = p_id;

  if payload ? 'items' then
    perform public._replace_adjustment_items(p_id, payload -> 'items');
  elsif v_loc <> v_rec.location_id then
    -- location changed: refresh recorded quantities snapshot
    perform public._refresh_adjustment_snapshot(p_id);
  end if;
  return p_id;
end;
$$;

-- ===========================================================================
-- DELIVERY RESERVATION HELPERS
-- ===========================================================================

-- Tries to reserve every line of a delivery at its source location.
-- Caller must hold the delivery row lock. Returns { ok, shortages[] }.
create or replace function public._try_reserve_delivery(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loc       uuid;
  it          record;
  v_available numeric;
  v_ok        boolean := true;
  v_shortages jsonb := '[]'::jsonb;
begin
  select source_location_id into v_loc from public.deliveries where id = p_id;

  for it in
    select di.product_id, di.quantity, p.name, p.sku
    from public.delivery_items di
    join public.products p on p.id = di.product_id
    where di.delivery_id = p_id
    order by di.product_id
  loop
    select quantity - reserved_quantity into v_available
    from public.inventory
    where product_id = it.product_id and location_id = v_loc
    for update;
    v_available := coalesce(v_available, 0);

    if v_available < it.quantity then
      v_ok := false;
      v_shortages := v_shortages || jsonb_build_object(
        'product_id', it.product_id, 'sku', it.sku, 'name', it.name,
        'requested', it.quantity, 'available', v_available);
    end if;
  end loop;

  if v_ok then
    update public.inventory i
       set reserved_quantity = i.reserved_quantity + di.quantity
      from public.delivery_items di
     where di.delivery_id = p_id
       and i.product_id = di.product_id
       and i.location_id = v_loc;
  end if;

  return jsonb_build_object('ok', v_ok, 'shortages', v_shortages);
end;
$$;

create or replace function public._release_delivery_reservation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loc uuid;
begin
  select source_location_id into v_loc from public.deliveries where id = p_id;
  update public.inventory i
     set reserved_quantity = greatest(i.reserved_quantity - di.quantity, 0)
    from public.delivery_items di
   where di.delivery_id = p_id
     and i.product_id = di.product_id
     and i.location_id = v_loc;
end;
$$;

-- After stock arrives at a location, WAITING deliveries sourced from it are
-- re-checked (oldest schedule first) and promoted to READY when fulfillable.
create or replace function public._recheck_waiting_deliveries(p_location_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d        record;
  v_res    jsonb;
  v_count  integer := 0;
begin
  for d in
    select id from public.deliveries
    where status = 'WAITING' and source_location_id = p_location_id
    order by schedule_date, created_at
    for update skip locked
  loop
    v_res := public._try_reserve_delivery(d.id);
    if (v_res ->> 'ok')::boolean then
      update public.deliveries set status = 'READY' where id = d.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- ===========================================================================
-- MARK READY  (DRAFT -> READY, or for deliveries DRAFT/WAITING -> READY|WAITING)
-- ===========================================================================
create or replace function public.mark_ready(p_operation_type text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_ref    text;
  v_res    jsonb;
  v_count  integer;
begin
  perform public._assert_authenticated();

  case p_operation_type
  when 'RECEIPT' then
    select status, reference into v_status, v_ref from public.receipts where id = p_id for update;
    if not found then raise exception 'Receipt not found'; end if;
    if v_status <> 'DRAFT' then raise exception 'Receipt % is % — only DRAFT receipts can be marked Ready', v_ref, v_status; end if;
    select count(*) into v_count from public.receipt_items where receipt_id = p_id;
    if v_count = 0 then raise exception 'Add at least one product line before marking Ready'; end if;
    update public.receipts set status = 'READY' where id = p_id;
    return jsonb_build_object('id', p_id, 'reference', v_ref, 'status', 'READY');

  when 'DELIVERY' then
    select status, reference into v_status, v_ref from public.deliveries where id = p_id for update;
    if not found then raise exception 'Delivery not found'; end if;
    if v_status not in ('DRAFT', 'WAITING') then
      raise exception 'Delivery % is % — only DRAFT or WAITING deliveries can be checked', v_ref, v_status;
    end if;
    select count(*) into v_count from public.delivery_items where delivery_id = p_id;
    if v_count = 0 then raise exception 'Add at least one product line before marking Ready'; end if;

    v_res := public._try_reserve_delivery(p_id);
    if (v_res ->> 'ok')::boolean then
      update public.deliveries set status = 'READY' where id = p_id;
      return jsonb_build_object('id', p_id, 'reference', v_ref, 'status', 'READY', 'shortages', '[]'::jsonb);
    else
      update public.deliveries set status = 'WAITING' where id = p_id;
      return jsonb_build_object('id', p_id, 'reference', v_ref, 'status', 'WAITING', 'shortages', v_res -> 'shortages');
    end if;

  when 'TRANSFER' then
    select status, reference into v_status, v_ref from public.transfers where id = p_id for update;
    if not found then raise exception 'Transfer not found'; end if;
    if v_status <> 'DRAFT' then raise exception 'Transfer % is % — only DRAFT transfers can be marked Ready', v_ref, v_status; end if;
    select count(*) into v_count from public.transfer_items where transfer_id = p_id;
    if v_count = 0 then raise exception 'Add at least one product line before marking Ready'; end if;
    update public.transfers set status = 'READY' where id = p_id;
    return jsonb_build_object('id', p_id, 'reference', v_ref, 'status', 'READY');

  when 'ADJUSTMENT' then
    select status, reference into v_status, v_ref from public.adjustments where id = p_id for update;
    if not found then raise exception 'Adjustment not found'; end if;
    if v_status <> 'DRAFT' then raise exception 'Adjustment % is % — only DRAFT adjustments can be marked Ready', v_ref, v_status; end if;
    select count(*) into v_count from public.adjustment_items where adjustment_id = p_id;
    if v_count = 0 then raise exception 'Add at least one product line before marking Ready'; end if;
    -- refresh the recorded snapshot so the user reviews current figures
    perform public._refresh_adjustment_snapshot(p_id);
    update public.adjustments set status = 'READY' where id = p_id;
    return jsonb_build_object('id', p_id, 'reference', v_ref, 'status', 'READY');

  else
    raise exception 'Invalid operation type: %', p_operation_type;
  end case;
end;
$$;

-- ===========================================================================
-- VALIDATE RECEIPT:  inventory += qty,  ledger IN,  status DONE
-- ===========================================================================
create or replace function public.validate_receipt(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec   public.receipts%rowtype;
  it      record;
  v_lines integer := 0;
begin
  perform public._assert_authenticated();
  select * into v_rec from public.receipts where id = p_id for update;
  if not found then raise exception 'Receipt not found'; end if;
  if v_rec.status <> 'READY' then
    raise exception 'Receipt % must be READY before validation (current status: %)', v_rec.reference, v_rec.status;
  end if;

  for it in
    select product_id, quantity from public.receipt_items
    where receipt_id = p_id order by product_id
  loop
    insert into public.inventory (product_id, location_id, quantity)
    values (it.product_id, v_rec.location_id, it.quantity)
    on conflict (product_id, location_id)
    do update set quantity = public.inventory.quantity + excluded.quantity;

    perform public._insert_movement(v_rec.reference, it.product_id, 'IN', it.quantity,
                                    null, v_rec.location_id, p_id, 'RECEIPT');
    v_lines := v_lines + 1;
  end loop;

  if v_lines = 0 then
    raise exception 'Receipt % has no product lines', v_rec.reference;
  end if;

  update public.receipts set status = 'DONE', completed_at = now() where id = p_id;
  perform public._recheck_waiting_deliveries(v_rec.location_id);

  return jsonb_build_object('id', p_id, 'reference', v_rec.reference, 'status', 'DONE', 'lines', v_lines);
end;
$$;

-- ===========================================================================
-- VALIDATE DELIVERY:  inventory -= qty (never negative),  ledger OUT,  DONE
-- ===========================================================================
create or replace function public.validate_delivery(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec   public.deliveries%rowtype;
  it      record;
  v_lines integer := 0;
begin
  perform public._assert_authenticated();
  select * into v_rec from public.deliveries where id = p_id for update;
  if not found then raise exception 'Delivery not found'; end if;
  if v_rec.status <> 'READY' then
    raise exception 'Delivery % must be READY before validation (current status: %)', v_rec.reference, v_rec.status;
  end if;

  for it in
    select product_id, quantity from public.delivery_items
    where delivery_id = p_id order by product_id
  loop
    update public.inventory
       set quantity          = quantity - it.quantity,
           reserved_quantity = greatest(reserved_quantity - it.quantity, 0)
     where product_id = it.product_id
       and location_id = v_rec.source_location_id
       and quantity >= it.quantity;
    if not found then
      raise exception 'Insufficient stock for % at % — delivery % cannot be completed',
        public._product_label(it.product_id), public._location_label(v_rec.source_location_id), v_rec.reference;
    end if;

    perform public._insert_movement(v_rec.reference, it.product_id, 'OUT', it.quantity,
                                    v_rec.source_location_id, null, p_id, 'DELIVERY');
    v_lines := v_lines + 1;
  end loop;

  if v_lines = 0 then
    raise exception 'Delivery % has no product lines', v_rec.reference;
  end if;

  update public.deliveries set status = 'DONE', completed_at = now() where id = p_id;
  return jsonb_build_object('id', p_id, 'reference', v_rec.reference, 'status', 'DONE', 'lines', v_lines);
end;
$$;

-- ===========================================================================
-- VALIDATE TRANSFER:  source -= qty, destination += qty, ledger TRANSFER, DONE
-- Total company stock is unchanged.
-- ===========================================================================
create or replace function public.validate_transfer(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec       public.transfers%rowtype;
  it          record;
  v_available numeric;
  v_lines     integer := 0;
begin
  perform public._assert_authenticated();
  select * into v_rec from public.transfers where id = p_id for update;
  if not found then raise exception 'Transfer not found'; end if;
  if v_rec.status <> 'READY' then
    raise exception 'Transfer % must be READY before validation (current status: %)', v_rec.reference, v_rec.status;
  end if;

  for it in
    select product_id, quantity from public.transfer_items
    where transfer_id = p_id order by product_id
  loop
    select quantity - reserved_quantity into v_available
    from public.inventory
    where product_id = it.product_id and location_id = v_rec.source_location_id
    for update;
    v_available := coalesce(v_available, 0);

    if v_available < it.quantity then
      raise exception 'Insufficient stock for % at %: available %, requested % (transfer %)',
        public._product_label(it.product_id), public._location_label(v_rec.source_location_id),
        v_available, it.quantity, v_rec.reference;
    end if;

    update public.inventory set quantity = quantity - it.quantity
     where product_id = it.product_id and location_id = v_rec.source_location_id;

    insert into public.inventory (product_id, location_id, quantity)
    values (it.product_id, v_rec.destination_location_id, it.quantity)
    on conflict (product_id, location_id)
    do update set quantity = public.inventory.quantity + excluded.quantity;

    perform public._insert_movement(v_rec.reference, it.product_id, 'TRANSFER', it.quantity,
                                    v_rec.source_location_id, v_rec.destination_location_id, p_id, 'TRANSFER');
    v_lines := v_lines + 1;
  end loop;

  if v_lines = 0 then
    raise exception 'Transfer % has no product lines', v_rec.reference;
  end if;

  update public.transfers set status = 'DONE', completed_at = now() where id = p_id;
  perform public._recheck_waiting_deliveries(v_rec.destination_location_id);

  return jsonb_build_object('id', p_id, 'reference', v_rec.reference, 'status', 'DONE', 'lines', v_lines);
end;
$$;

-- ===========================================================================
-- VALIDATE ADJUSTMENT:  inventory = counted, ledger ADJUSTMENT (signed diff), DONE
-- ===========================================================================
create or replace function public.validate_adjustment(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec      public.adjustments%rowtype;
  it         record;
  v_qty      numeric;
  v_reserved numeric;
  v_diff     numeric;
  v_lines    integer := 0;
  v_moves    integer := 0;
begin
  perform public._assert_authenticated();
  select * into v_rec from public.adjustments where id = p_id for update;
  if not found then raise exception 'Adjustment not found'; end if;
  if v_rec.status <> 'READY' then
    raise exception 'Adjustment % must be READY before validation (current status: %)', v_rec.reference, v_rec.status;
  end if;

  for it in
    select id, product_id, counted_quantity from public.adjustment_items
    where adjustment_id = p_id order by product_id
  loop
    select quantity, reserved_quantity into v_qty, v_reserved
    from public.inventory
    where product_id = it.product_id and location_id = v_rec.location_id
    for update;
    v_qty := coalesce(v_qty, 0);
    v_reserved := coalesce(v_reserved, 0);
    v_diff := it.counted_quantity - v_qty;

    if it.counted_quantity < v_reserved then
      raise exception 'Counted quantity for % (%) is below the % reserved for READY deliveries at %',
        public._product_label(it.product_id), it.counted_quantity, v_reserved,
        public._location_label(v_rec.location_id);
    end if;

    -- authoritative snapshot taken inside the transaction
    update public.adjustment_items
       set recorded_quantity = v_qty, difference = v_diff
     where id = it.id;

    if v_diff <> 0 then
      insert into public.inventory (product_id, location_id, quantity)
      values (it.product_id, v_rec.location_id, it.counted_quantity)
      on conflict (product_id, location_id)
      do update set quantity = excluded.quantity;

      perform public._insert_movement(
        v_rec.reference, it.product_id, 'ADJUSTMENT', v_diff,
        case when v_diff < 0 then v_rec.location_id end,
        case when v_diff > 0 then v_rec.location_id end,
        p_id, 'ADJUSTMENT', v_rec.reason);
      v_moves := v_moves + 1;
    end if;
    v_lines := v_lines + 1;
  end loop;

  if v_lines = 0 then
    raise exception 'Adjustment % has no product lines', v_rec.reference;
  end if;

  update public.adjustments set status = 'DONE', completed_at = now() where id = p_id;
  perform public._recheck_waiting_deliveries(v_rec.location_id);

  return jsonb_build_object('id', p_id, 'reference', v_rec.reference, 'status', 'DONE',
                            'lines', v_lines, 'movements', v_moves);
end;
$$;

-- ===========================================================================
-- CANCEL  (DRAFT/WAITING/READY -> CANCELED; DONE is terminal)
-- ===========================================================================
create or replace function public.cancel_operation(p_operation_type text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_ref    text;
  v_loc    uuid;
begin
  perform public._assert_authenticated();

  case p_operation_type
  when 'RECEIPT' then
    select status, reference into v_status, v_ref from public.receipts where id = p_id for update;
    if not found then raise exception 'Receipt not found'; end if;
    if v_status not in ('DRAFT', 'READY') then
      raise exception 'Receipt % is % and cannot be canceled', v_ref, v_status;
    end if;
    update public.receipts set status = 'CANCELED' where id = p_id;

  when 'DELIVERY' then
    select status, reference, source_location_id into v_status, v_ref, v_loc
    from public.deliveries where id = p_id for update;
    if not found then raise exception 'Delivery not found'; end if;
    if v_status not in ('DRAFT', 'WAITING', 'READY') then
      raise exception 'Delivery % is % and cannot be canceled', v_ref, v_status;
    end if;
    if v_status = 'READY' then
      perform public._release_delivery_reservation(p_id);
    end if;
    update public.deliveries set status = 'CANCELED' where id = p_id;
    if v_status = 'READY' then
      perform public._recheck_waiting_deliveries(v_loc);
    end if;

  when 'TRANSFER' then
    select status, reference into v_status, v_ref from public.transfers where id = p_id for update;
    if not found then raise exception 'Transfer not found'; end if;
    if v_status not in ('DRAFT', 'READY') then
      raise exception 'Transfer % is % and cannot be canceled', v_ref, v_status;
    end if;
    update public.transfers set status = 'CANCELED' where id = p_id;

  when 'ADJUSTMENT' then
    select status, reference into v_status, v_ref from public.adjustments where id = p_id for update;
    if not found then raise exception 'Adjustment not found'; end if;
    if v_status not in ('DRAFT', 'READY') then
      raise exception 'Adjustment % is % and cannot be canceled', v_ref, v_status;
    end if;
    update public.adjustments set status = 'CANCELED' where id = p_id;

  else
    raise exception 'Invalid operation type: %', p_operation_type;
  end case;

  return jsonb_build_object('id', p_id, 'reference', v_ref, 'status', 'CANCELED');
end;
$$;

-- ===========================================================================
-- Delivery pick / pack progress (non stock-changing; READY only)
-- ===========================================================================
create or replace function public.set_delivery_lines_progress(p_id uuid, p_stage text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_ref    text;
begin
  perform public._assert_authenticated();
  select status, reference into v_status, v_ref from public.deliveries where id = p_id for update;
  if not found then raise exception 'Delivery not found'; end if;
  if v_status <> 'READY' then
    raise exception 'Delivery % must be READY to be picked or packed (current status: %)', v_ref, v_status;
  end if;

  if p_stage = 'PICK' then
    update public.delivery_items set picked_quantity = quantity where delivery_id = p_id;
  elsif p_stage = 'PACK' then
    update public.delivery_items set picked_quantity = quantity, packed_quantity = quantity where delivery_id = p_id;
  else
    raise exception 'Invalid stage: % (expected PICK or PACK)', p_stage;
  end if;
  return jsonb_build_object('id', p_id, 'reference', v_ref, 'stage', p_stage);
end;
$$;

-- ===========================================================================
-- Initial stock for a new product = an auto-validated Adjustment, so the
-- quantity is still auditable (DataBase.md §5, Conflict 2 resolution).
-- ===========================================================================
create or replace function public.init_product_stock(
  p_product_id  uuid,
  p_location_id uuid,
  p_quantity    numeric,
  p_reason      text default 'Initial stock'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id      uuid;
  v_current numeric;
begin
  perform public._assert_authenticated();
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Initial stock must be greater than 0';
  end if;

  select quantity into v_current from public.inventory
  where product_id = p_product_id and location_id = p_location_id;
  v_current := coalesce(v_current, 0);

  v_id := public.create_adjustment(jsonb_build_object(
    'location_id', p_location_id,
    'reason', coalesce(nullif(trim(p_reason), ''), 'Initial stock'),
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', p_product_id,
      'counted_quantity', v_current + p_quantity))));

  perform public.mark_ready('ADJUSTMENT', v_id);
  perform public.validate_adjustment(v_id);
  return v_id;
end;
$$;
