-- ============================================================================
-- StockSense — Migration 1: core schema
-- Source of truth: DataBase.md (tables, constraints, indexes)
-- Status / type values are enforced with CHECK constraints (DataBase.md §21).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (DataBase.md §3) — linked to Supabase Auth, never stores passwords
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  login_id    varchar(12) not null unique,
  email       text not null unique,
  full_name   text,
  role        text not null default 'INVENTORY_MANAGER',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_role_check
    check (role in ('INVENTORY_MANAGER', 'WAREHOUSE_STAFF')),
  constraint profiles_login_id_length_check
    check (char_length(login_id) between 6 and 12)
);
-- Login IDs are unique regardless of case.
create unique index if not exists profiles_login_id_lower_key
  on public.profiles (lower(login_id));

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- categories (DataBase.md §4)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  description  text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- products (DataBase.md §5) — NO stock column; stock lives in inventory
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  sku              text not null unique,
  name             text not null,
  category_id      uuid references public.categories (id) on delete set null,
  unit_of_measure  text not null default 'pcs',
  unit_cost        numeric(12,2) not null default 0,
  reorder_level    numeric(12,3) not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint products_unit_cost_check check (unit_cost >= 0),
  constraint products_reorder_level_check check (reorder_level >= 0)
);
create index if not exists products_sku_idx on public.products (sku);
create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_name_idx on public.products (lower(name));

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- warehouses (DataBase.md §6)
-- ---------------------------------------------------------------------------
create table if not exists public.warehouses (
  id          uuid primary key default gen_random_uuid(),
  code        varchar(10) not null unique,
  name        text not null,
  address     text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint warehouses_code_format_check check (code ~ '^[A-Z0-9-]{1,10}$')
);

drop trigger if exists warehouses_set_updated_at on public.warehouses;
create trigger warehouses_set_updated_at
  before update on public.warehouses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- locations (DataBase.md §7) — a location belongs to exactly one warehouse
-- ---------------------------------------------------------------------------
create table if not exists public.locations (
  id            uuid primary key default gen_random_uuid(),
  warehouse_id  uuid not null references public.warehouses (id) on delete restrict,
  code          text not null,
  name          text not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint locations_warehouse_code_key unique (warehouse_id, code)
);
create index if not exists locations_warehouse_id_idx on public.locations (warehouse_id);

drop trigger if exists locations_set_updated_at on public.locations;
create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- inventory (DataBase.md §8) — THE authoritative current stock
-- ---------------------------------------------------------------------------
create table if not exists public.inventory (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references public.products (id) on delete restrict,
  location_id        uuid not null references public.locations (id) on delete restrict,
  quantity           numeric(12,3) not null default 0,
  reserved_quantity  numeric(12,3) not null default 0,
  updated_at         timestamptz not null default now(),
  constraint inventory_product_location_key unique (product_id, location_id),
  constraint inventory_quantity_check check (quantity >= 0),
  constraint inventory_reserved_quantity_check check (reserved_quantity >= 0),
  constraint inventory_reserved_lte_quantity_check check (reserved_quantity <= quantity)
);
create index if not exists inventory_product_location_idx on public.inventory (product_id, location_id);
create index if not exists inventory_location_product_idx on public.inventory (location_id, product_id);

drop trigger if exists inventory_set_updated_at on public.inventory;
create trigger inventory_set_updated_at
  before update on public.inventory
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- suppliers (DataBase.md §9) / customers (DataBase.md §10)
-- ---------------------------------------------------------------------------
create table if not exists public.suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  phone       text,
  address     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  phone       text,
  address     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reference_counters — the "numeric sequence per warehouse and operation"
-- described in DataBase.md §26. Only written by database functions.
-- ---------------------------------------------------------------------------
create table if not exists public.reference_counters (
  warehouse_id    uuid not null references public.warehouses (id) on delete cascade,
  operation_type  text not null,
  last_number     integer not null default 0,
  primary key (warehouse_id, operation_type),
  constraint reference_counters_operation_type_check
    check (operation_type in ('RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT'))
);

-- ---------------------------------------------------------------------------
-- receipts / receipt_items (DataBase.md §11, §12)
-- ---------------------------------------------------------------------------
create table if not exists public.receipts (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique,
  warehouse_id         uuid not null references public.warehouses (id) on delete restrict,
  location_id          uuid not null references public.locations (id) on delete restrict,
  supplier_id          uuid references public.suppliers (id) on delete set null,
  schedule_date        timestamptz not null default now(),
  status               text not null default 'DRAFT',
  responsible_user_id  uuid references public.profiles (id) on delete set null,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  completed_at         timestamptz,
  constraint receipts_status_check
    check (status in ('DRAFT', 'READY', 'DONE', 'CANCELED'))
);
create index if not exists receipts_reference_idx on public.receipts (reference);
create index if not exists receipts_status_idx on public.receipts (status);
create index if not exists receipts_schedule_date_idx on public.receipts (schedule_date);
create index if not exists receipts_warehouse_id_idx on public.receipts (warehouse_id);

drop trigger if exists receipts_set_updated_at on public.receipts;
create trigger receipts_set_updated_at
  before update on public.receipts
  for each row execute function public.set_updated_at();

create table if not exists public.receipt_items (
  id          uuid primary key default gen_random_uuid(),
  receipt_id  uuid not null references public.receipts (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete restrict,
  quantity    numeric(12,3) not null,
  created_at  timestamptz not null default now(),
  constraint receipt_items_quantity_check check (quantity > 0),
  constraint receipt_items_receipt_product_key unique (receipt_id, product_id)
);
create index if not exists receipt_items_receipt_id_idx on public.receipt_items (receipt_id);

-- ---------------------------------------------------------------------------
-- deliveries / delivery_items (DataBase.md §13, §14)
-- ---------------------------------------------------------------------------
create table if not exists public.deliveries (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique,
  warehouse_id         uuid not null references public.warehouses (id) on delete restrict,
  source_location_id   uuid not null references public.locations (id) on delete restrict,
  customer_id          uuid references public.customers (id) on delete set null,
  schedule_date        timestamptz not null default now(),
  status               text not null default 'DRAFT',
  responsible_user_id  uuid references public.profiles (id) on delete set null,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  completed_at         timestamptz,
  constraint deliveries_status_check
    check (status in ('DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED'))
);
create index if not exists deliveries_reference_idx on public.deliveries (reference);
create index if not exists deliveries_status_idx on public.deliveries (status);
create index if not exists deliveries_schedule_date_idx on public.deliveries (schedule_date);
create index if not exists deliveries_warehouse_id_idx on public.deliveries (warehouse_id);
create index if not exists deliveries_source_location_id_idx on public.deliveries (source_location_id);

drop trigger if exists deliveries_set_updated_at on public.deliveries;
create trigger deliveries_set_updated_at
  before update on public.deliveries
  for each row execute function public.set_updated_at();

create table if not exists public.delivery_items (
  id               uuid primary key default gen_random_uuid(),
  delivery_id      uuid not null references public.deliveries (id) on delete cascade,
  product_id       uuid not null references public.products (id) on delete restrict,
  quantity         numeric(12,3) not null,
  picked_quantity  numeric(12,3) not null default 0,
  packed_quantity  numeric(12,3) not null default 0,
  created_at       timestamptz not null default now(),
  constraint delivery_items_quantity_check check (quantity > 0),
  constraint delivery_items_picked_check check (picked_quantity >= 0),
  constraint delivery_items_packed_check check (packed_quantity >= 0),
  constraint delivery_items_delivery_product_key unique (delivery_id, product_id)
);
create index if not exists delivery_items_delivery_id_idx on public.delivery_items (delivery_id);

-- ---------------------------------------------------------------------------
-- transfers / transfer_items (DataBase.md §15, §16)
-- ---------------------------------------------------------------------------
create table if not exists public.transfers (
  id                       uuid primary key default gen_random_uuid(),
  reference                text not null unique,
  source_location_id       uuid not null references public.locations (id) on delete restrict,
  destination_location_id  uuid not null references public.locations (id) on delete restrict,
  schedule_date            timestamptz not null default now(),
  status                   text not null default 'DRAFT',
  responsible_user_id      uuid references public.profiles (id) on delete set null,
  created_by               uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  completed_at             timestamptz,
  constraint transfers_status_check
    check (status in ('DRAFT', 'READY', 'DONE', 'CANCELED')),
  constraint transfers_distinct_locations_check
    check (source_location_id <> destination_location_id)
);
create index if not exists transfers_reference_idx on public.transfers (reference);
create index if not exists transfers_status_idx on public.transfers (status);
create index if not exists transfers_schedule_date_idx on public.transfers (schedule_date);
create index if not exists transfers_source_location_id_idx on public.transfers (source_location_id);

drop trigger if exists transfers_set_updated_at on public.transfers;
create trigger transfers_set_updated_at
  before update on public.transfers
  for each row execute function public.set_updated_at();

create table if not exists public.transfer_items (
  id           uuid primary key default gen_random_uuid(),
  transfer_id  uuid not null references public.transfers (id) on delete cascade,
  product_id   uuid not null references public.products (id) on delete restrict,
  quantity     numeric(12,3) not null,
  created_at   timestamptz not null default now(),
  constraint transfer_items_quantity_check check (quantity > 0),
  constraint transfer_items_transfer_product_key unique (transfer_id, product_id)
);
create index if not exists transfer_items_transfer_id_idx on public.transfer_items (transfer_id);

-- ---------------------------------------------------------------------------
-- adjustments / adjustment_items (DataBase.md §17, §18)
-- ---------------------------------------------------------------------------
create table if not exists public.adjustments (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique,
  location_id          uuid not null references public.locations (id) on delete restrict,
  schedule_date        timestamptz not null default now(),
  status               text not null default 'DRAFT',
  reason               text not null,
  responsible_user_id  uuid references public.profiles (id) on delete set null,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  completed_at         timestamptz,
  constraint adjustments_status_check
    check (status in ('DRAFT', 'READY', 'DONE', 'CANCELED')),
  constraint adjustments_reason_check check (char_length(trim(reason)) > 0)
);
create index if not exists adjustments_reference_idx on public.adjustments (reference);
create index if not exists adjustments_status_idx on public.adjustments (status);
create index if not exists adjustments_schedule_date_idx on public.adjustments (schedule_date);
create index if not exists adjustments_location_id_idx on public.adjustments (location_id);

drop trigger if exists adjustments_set_updated_at on public.adjustments;
create trigger adjustments_set_updated_at
  before update on public.adjustments
  for each row execute function public.set_updated_at();

create table if not exists public.adjustment_items (
  id                 uuid primary key default gen_random_uuid(),
  adjustment_id      uuid not null references public.adjustments (id) on delete cascade,
  product_id         uuid not null references public.products (id) on delete restrict,
  recorded_quantity  numeric(12,3) not null default 0,
  counted_quantity   numeric(12,3) not null,
  difference         numeric(12,3) not null default 0,
  created_at         timestamptz not null default now(),
  constraint adjustment_items_counted_check check (counted_quantity >= 0),
  constraint adjustment_items_adjustment_product_key unique (adjustment_id, product_id)
);
create index if not exists adjustment_items_adjustment_id_idx on public.adjustment_items (adjustment_id);

-- ---------------------------------------------------------------------------
-- stock_movements (DataBase.md §19) — the central audit ledger
-- ---------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null,
  product_id        uuid not null references public.products (id) on delete restrict,
  movement_type     text not null,
  quantity          numeric(12,3) not null,
  from_location_id  uuid references public.locations (id) on delete restrict,
  to_location_id    uuid references public.locations (id) on delete restrict,
  operation_id      uuid,
  operation_type    text,
  performed_by      uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  notes             text,
  constraint stock_movements_movement_type_check
    check (movement_type in ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT')),
  constraint stock_movements_operation_type_check
    check (operation_type is null or operation_type in ('RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT')),
  constraint stock_movements_quantity_nonzero_check check (quantity <> 0)
);
create index if not exists stock_movements_reference_idx on public.stock_movements (reference);
create index if not exists stock_movements_product_id_idx on public.stock_movements (product_id);
create index if not exists stock_movements_created_at_idx on public.stock_movements (created_at desc);
create index if not exists stock_movements_movement_type_idx on public.stock_movements (movement_type);
create index if not exists stock_movements_operation_idx on public.stock_movements (operation_type, operation_id);
