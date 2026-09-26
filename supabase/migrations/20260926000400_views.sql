-- ============================================================================
-- StockSense — Migration 4: read models
-- Views are security_invoker so Row Level Security of the base tables applies.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Stock by product × location (Stock page, availability by location)
-- ---------------------------------------------------------------------------
create or replace view public.v_stock
with (security_invoker = on) as
select
  i.id,
  i.product_id,
  p.sku,
  p.name                          as product_name,
  p.unit_of_measure,
  p.unit_cost,
  p.reorder_level,
  p.category_id,
  c.name                          as category_name,
  i.location_id,
  l.code                          as location_code,
  l.name                          as location_name,
  l.warehouse_id,
  w.code                          as warehouse_code,
  w.name                          as warehouse_name,
  i.quantity,
  i.reserved_quantity,
  i.quantity - i.reserved_quantity as free_to_use,
  i.updated_at
from public.inventory i
join public.products   p on p.id = i.product_id
join public.locations  l on l.id = i.location_id
join public.warehouses w on w.id = l.warehouse_id
left join public.categories c on c.id = p.category_id;

-- ---------------------------------------------------------------------------
-- Stock per product across all locations + low/out-of-stock flag
-- (Products page, Stock summary, alerts — DataBase.md §24–25)
-- ---------------------------------------------------------------------------
create or replace view public.v_product_stock
with (security_invoker = on) as
select
  p.id                                   as product_id,
  p.sku,
  p.name,
  p.category_id,
  c.name                                 as category_name,
  p.unit_of_measure,
  p.unit_cost,
  p.reorder_level,
  p.is_active,
  p.created_at,
  p.updated_at,
  coalesce(s.on_hand, 0)                 as on_hand,
  coalesce(s.reserved, 0)                as reserved,
  coalesce(s.on_hand, 0) - coalesce(s.reserved, 0) as free_to_use,
  coalesce(s.location_count, 0)          as location_count,
  round(coalesce(s.on_hand, 0) * p.unit_cost, 2) as stock_value,
  case
    when coalesce(s.on_hand, 0) <= 0 then 'OUT_OF_STOCK'
    when coalesce(s.on_hand, 0) <= p.reorder_level then 'LOW_STOCK'
    else 'IN_STOCK'
  end                                    as stock_status
from public.products p
left join public.categories c on c.id = p.category_id
left join (
  select product_id,
         sum(quantity)                          as on_hand,
         sum(reserved_quantity)                 as reserved,
         count(*) filter (where quantity > 0)   as location_count
  from public.inventory
  group by product_id
) s on s.product_id = p.id;

-- ---------------------------------------------------------------------------
-- Move History / Stock Ledger (features.md §11)
-- One row per product per movement; contact resolved through the operation.
-- ---------------------------------------------------------------------------
create or replace view public.v_move_history
with (security_invoker = on) as
select
  m.id,
  m.reference,
  m.movement_type,
  m.quantity,
  case when m.movement_type = 'OUT' then -m.quantity else m.quantity end as signed_quantity,
  m.product_id,
  p.sku,
  p.name                 as product_name,
  p.unit_of_measure,
  p.category_id,
  m.from_location_id,
  fl.name                as from_location_name,
  fl.code                as from_location_code,
  fl.warehouse_id        as from_warehouse_id,
  fw.code                as from_warehouse_code,
  m.to_location_id,
  tl.name                as to_location_name,
  tl.code                as to_location_code,
  tl.warehouse_id        as to_warehouse_id,
  tw.code                as to_warehouse_code,
  m.operation_id,
  m.operation_type,
  case m.operation_type
    when 'RECEIPT'  then (select s.name from public.receipts r left join public.suppliers s on s.id = r.supplier_id where r.id = m.operation_id)
    when 'DELIVERY' then (select c.name from public.deliveries d left join public.customers c on c.id = d.customer_id where d.id = m.operation_id)
  end                    as contact_name,
  'DONE'::text           as status,
  m.performed_by,
  pr.full_name           as performed_by_name,
  pr.login_id            as performed_by_login,
  m.notes,
  m.created_at
from public.stock_movements m
join public.products p on p.id = m.product_id
left join public.locations  fl on fl.id = m.from_location_id
left join public.warehouses fw on fw.id = fl.warehouse_id
left join public.locations  tl on tl.id = m.to_location_id
left join public.warehouses tw on tw.id = tl.warehouse_id
left join public.profiles   pr on pr.id = m.performed_by;

-- ---------------------------------------------------------------------------
-- All operations in one list (Dashboard filters: document type, status,
-- warehouse, location, category — SystemDesign.md §6)
-- ---------------------------------------------------------------------------
create or replace view public.v_operations
with (security_invoker = on) as
select
  'RECEIPT'::text        as operation_type,
  r.id,
  r.reference,
  r.status,
  r.schedule_date,
  r.created_at,
  r.completed_at,
  r.warehouse_id,
  w.code                 as warehouse_code,
  r.location_id,
  l.name                 as location_name,
  null::uuid             as destination_location_id,
  null::text             as destination_location_name,
  s.name                 as contact_name,
  null::text             as note,
  r.responsible_user_id,
  pr.full_name           as responsible_name,
  (select count(*) from public.receipt_items ri where ri.receipt_id = r.id) as line_count,
  (select coalesce(array_agg(distinct p.category_id) filter (where p.category_id is not null), '{}'::uuid[])
     from public.receipt_items ri join public.products p on p.id = ri.product_id where ri.receipt_id = r.id) as category_ids,
  (r.status in ('DRAFT', 'READY') and r.schedule_date < now()) as is_late
from public.receipts r
join public.warehouses w on w.id = r.warehouse_id
join public.locations  l on l.id = r.location_id
left join public.suppliers s on s.id = r.supplier_id
left join public.profiles  pr on pr.id = r.responsible_user_id

union all

select
  'DELIVERY',
  d.id, d.reference, d.status, d.schedule_date, d.created_at, d.completed_at,
  d.warehouse_id, w.code, d.source_location_id, l.name,
  null::uuid, null::text,
  c.name, null::text,
  d.responsible_user_id, pr.full_name,
  (select count(*) from public.delivery_items di where di.delivery_id = d.id),
  (select coalesce(array_agg(distinct p.category_id) filter (where p.category_id is not null), '{}'::uuid[])
     from public.delivery_items di join public.products p on p.id = di.product_id where di.delivery_id = d.id),
  (d.status in ('DRAFT', 'WAITING', 'READY') and d.schedule_date < now())
from public.deliveries d
join public.warehouses w on w.id = d.warehouse_id
join public.locations  l on l.id = d.source_location_id
left join public.customers c on c.id = d.customer_id
left join public.profiles  pr on pr.id = d.responsible_user_id

union all

select
  'TRANSFER',
  t.id, t.reference, t.status, t.schedule_date, t.created_at, t.completed_at,
  sl.warehouse_id, w.code, t.source_location_id, sl.name,
  t.destination_location_id, dl.name,
  null::text, null::text,
  t.responsible_user_id, pr.full_name,
  (select count(*) from public.transfer_items ti where ti.transfer_id = t.id),
  (select coalesce(array_agg(distinct p.category_id) filter (where p.category_id is not null), '{}'::uuid[])
     from public.transfer_items ti join public.products p on p.id = ti.product_id where ti.transfer_id = t.id),
  (t.status in ('DRAFT', 'READY') and t.schedule_date < now())
from public.transfers t
join public.locations  sl on sl.id = t.source_location_id
join public.warehouses w  on w.id = sl.warehouse_id
join public.locations  dl on dl.id = t.destination_location_id
left join public.profiles pr on pr.id = t.responsible_user_id

union all

select
  'ADJUSTMENT',
  a.id, a.reference, a.status, a.schedule_date, a.created_at, a.completed_at,
  l.warehouse_id, w.code, a.location_id, l.name,
  null::uuid, null::text,
  null::text, a.reason,
  a.responsible_user_id, pr.full_name,
  (select count(*) from public.adjustment_items ai where ai.adjustment_id = a.id),
  (select coalesce(array_agg(distinct p.category_id) filter (where p.category_id is not null), '{}'::uuid[])
     from public.adjustment_items ai join public.products p on p.id = ai.product_id where ai.adjustment_id = a.id),
  (a.status in ('DRAFT', 'READY') and a.schedule_date < now())
from public.adjustments a
join public.locations  l on l.id = a.location_id
join public.warehouses w on w.id = l.warehouse_id
left join public.profiles pr on pr.id = a.responsible_user_id;

-- ---------------------------------------------------------------------------
-- Dashboard KPIs — always computed from the database (SystemDesign.md §6)
-- Optional filters: warehouse, product category.
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_kpis(
  p_warehouse_id uuid default null,
  p_category_id  uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  perform public._assert_authenticated();

  with stock as (
    select p.id as product_id,
           p.reorder_level,
           coalesce(sum(i.quantity) filter (
             where p_warehouse_id is null or l.warehouse_id = p_warehouse_id), 0) as on_hand
    from public.products p
    left join public.inventory i on i.product_id = p.id
    left join public.locations l on l.id = i.location_id
    where p.is_active
      and (p_category_id is null or p.category_id = p_category_id)
    group by p.id, p.reorder_level
  ),
  ops as (
    select operation_type, status, schedule_date, warehouse_id, category_ids, is_late
    from public.v_operations
    where (p_warehouse_id is null or warehouse_id = p_warehouse_id)
      and (p_category_id is null or category_ids @> array[p_category_id])
  )
  select jsonb_build_object(
    'total_products_in_stock', (select count(*) from stock where on_hand > 0),
    'low_stock_items',         (select count(*) from stock where on_hand > 0 and on_hand <= reorder_level),
    'out_of_stock_items',      (select count(*) from stock where on_hand <= 0),
    'pending_receipts',        (select count(*) from ops where operation_type = 'RECEIPT'    and status in ('DRAFT', 'READY')),
    'pending_deliveries',      (select count(*) from ops where operation_type = 'DELIVERY'   and status in ('DRAFT', 'WAITING', 'READY')),
    'waiting_deliveries',      (select count(*) from ops where operation_type = 'DELIVERY'   and status = 'WAITING'),
    'transfers_scheduled',     (select count(*) from ops where operation_type = 'TRANSFER'   and status in ('DRAFT', 'READY')),
    'pending_adjustments',     (select count(*) from ops where operation_type = 'ADJUSTMENT' and status in ('DRAFT', 'READY')),
    'late_operations',         (select count(*) from ops where is_late),
    'generated_at',            now()
  ) into v_result;

  return v_result;
end;
$$;
