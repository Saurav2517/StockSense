-- ============================================================================
-- StockSense — optional demo seed (master data only; NO stock)
-- Run after the migrations. Stock must always enter through operations so
-- that the ledger stays complete — follow the demo flow in README.md.
-- ============================================================================
insert into public.categories (name, description) values
  ('Raw Material',   'Inputs consumed by production'),
  ('Finished Goods', 'Sellable products'),
  ('Consumables',    'Packaging, fasteners and supplies')
on conflict (name) do nothing;

insert into public.warehouses (code, name, address) values
  ('WH', 'Main Warehouse', 'Warehouse Road')
on conflict (code) do nothing;

insert into public.locations (warehouse_id, code, name)
select w.id, l.code, l.name
from public.warehouses w
cross join (values
  ('WH-ST01', 'Main Store'),
  ('WH-RK01', 'Rack A'),
  ('WH-RK02', 'Rack B'),
  ('WH-PR01', 'Production Floor')
) as l(code, name)
where w.code = 'WH'
on conflict (warehouse_id, code) do nothing;

insert into public.suppliers (name, email, phone, address)
select 'Tata Steel Ltd', 'orders@tatasteel.example', '+91 98765 00001', 'Jamshedpur'
where not exists (select 1 from public.suppliers where name = 'Tata Steel Ltd');

insert into public.customers (name, email, phone, address)
select 'Acme Fabricators', 'purchase@acme.example', '+91 98765 00002', 'Ludhiana'
where not exists (select 1 from public.customers where name = 'Acme Fabricators');
