// ============================================================================
// StockSense — database tests
//
// Runs the real migrations inside PGlite (PostgreSQL compiled to WASM) with a
// mocked Supabase `auth` schema, then exercises every stock-changing
// operation exactly as the master rules §30 require:
//   Receipt +100 · Transfer 30 · Delivery −20 · Adjustment 50→47 · Insufficient
//   delivery (5 available, 8 requested → WAITING, no negative stock)
// plus reference generation, reservations, RLS / privilege guarantees.
//
//   npm run test:db
// ============================================================================
import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, '..', 'migrations');

const db = new PGlite();
process.on('unhandledRejection', (err) => {
  console.error(`\n✘ Unexpected error: ${err?.message ?? err}`);
  if (err?.where) console.error(`  where: ${err.where}`);
  if (err?.internalQuery) console.error(`  query: ${err.internalQuery}`);
  process.exit(1);
});
let passed = 0;
let failed = 0;
const failures = [];

// ---------------------------------------------------------------------------
// tiny test helpers
// ---------------------------------------------------------------------------
function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function q(sql, params = []) {
  const res = await db.query(sql, params);
  return res.rows;
}
async function one(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0];
}
async function scalar(sql, params = []) {
  const row = await one(sql, params);
  return row ? Object.values(row)[0] : undefined;
}
async function rpc(fn, args) {
  // mimics supabase.rpc(fn, args): named parameters
  const keys = Object.keys(args);
  const placeholders = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
  const row = await one(`select public.${fn}(${placeholders}) as result`, Object.values(args));
  return row.result;
}
async function expectError(name, promise, pattern) {
  try {
    await promise;
    check(name, false, 'expected an error but none was raised');
  } catch (err) {
    const ok = pattern ? pattern.test(err.message) : true;
    check(name, ok, ok ? '' : `unexpected error: ${err.message}`);
  }
}
const num = (v) => Number(v);
const section = (title) => console.log(`\n${title}`);

async function actAs(userId) {
  await db.exec('reset role;');
  await q(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
  await q(`select set_config('request.jwt.claim.role', $1, false)`, [userId ? 'authenticated' : 'anon']);
  await db.exec(`set role ${userId ? 'authenticated' : 'anon'};`);
}
async function asAdmin() {
  await db.exec('reset role;');
}

// ---------------------------------------------------------------------------
// 1. Mock the parts of Supabase that migrations depend on
// ---------------------------------------------------------------------------
section('Bootstrapping mock Supabase environment');
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema if not exists auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create or replace function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claim.role', true), '')
  $$;
  grant usage on schema public to anon, authenticated;
`);

// ---------------------------------------------------------------------------
// 2. Apply migrations in order
// ---------------------------------------------------------------------------
section('Applying migrations');
const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
for (const file of files) {
  const sql = await readFile(path.join(migrationsDir, file), 'utf8');
  try {
    await db.exec(sql);
    console.log(`  ✔ ${file}`);
  } catch (err) {
    console.error(`  ✘ ${file}: ${err.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// 3. Users (auth trigger → profiles)
// ---------------------------------------------------------------------------
section('Auth → profiles');
const manager = await one(
  `insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id`,
  ['manager@stocksense.dev', JSON.stringify({ login_id: 'manager1', full_name: 'Maya Manager', role: 'INVENTORY_MANAGER' })]
);
const staff = await one(
  `insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id`,
  ['staff@stocksense.dev', JSON.stringify({ login_id: 'staff001', full_name: 'Sam Staff', role: 'WAREHOUSE_STAFF' })]
);
const noMeta = await one(`insert into auth.users (email) values ($1) returning id`, ['plain@stocksense.dev']);

const profiles = await q(`select id, login_id, role, email from public.profiles order by created_at`);
check('profile rows created by trigger', profiles.length === 3, `got ${profiles.length}`);
check('manager role stored', profiles.find((p) => p.id === manager.id)?.role === 'INVENTORY_MANAGER');
check('staff role stored', profiles.find((p) => p.id === staff.id)?.role === 'WAREHOUSE_STAFF');
const fallback = profiles.find((p) => p.id === noMeta.id);
check('fallback login_id is 6–12 chars', fallback && fallback.login_id.length >= 6 && fallback.login_id.length <= 12, fallback?.login_id);

await actAs(null); // anon
check('anon: login_id_available(new) = true', (await rpc('login_id_available', { p_login_id: 'brandnew1' })) === true);
check('anon: login_id_available(existing, any case) = false', (await rpc('login_id_available', { p_login_id: 'MANAGER1' })) === false);
check('anon: email_for_login_id resolves', (await rpc('email_for_login_id', { p_login_id: 'Manager1' })) === 'manager@stocksense.dev');
check('anon: email_for_login_id unknown → null', (await rpc('email_for_login_id', { p_login_id: 'nobody99' })) === null);
await expectError('anon cannot read products', q('select * from public.products'), /permission denied/i);
await expectError('anon cannot call create_receipt', rpc('create_receipt', { payload: '{}' }), /permission denied/i);

// ---------------------------------------------------------------------------
// 4. Master data as INVENTORY_MANAGER (through RLS)
// ---------------------------------------------------------------------------
section('Master data (manager via RLS)');
await actAs(manager.id);
const category = await one(`insert into public.categories (name) values ('Raw Material') returning id`);
const wh = await one(`insert into public.warehouses (code, name, address) values ('WH', 'Main Warehouse', 'Warehouse Road') returning id`);
const mainStore = await one(`insert into public.locations (warehouse_id, code, name) values ($1, 'WH-ST01', 'Main Store') returning id`, [wh.id]);
const prodFloor = await one(`insert into public.locations (warehouse_id, code, name) values ($1, 'WH-PR01', 'Production Floor') returning id`, [wh.id]);
const supplier = await one(`insert into public.suppliers (name) values ('Tata Steel') returning id`);
const customer = await one(`insert into public.customers (name) values ('Acme Fabricators') returning id`);
const steel = await one(
  `insert into public.products (sku, name, category_id, unit_of_measure, unit_cost, reorder_level)
   values ('STL-ROD-12', 'Steel Rod 12mm', $1, 'pcs', 45.50, 10) returning id`,
  [category.id]
);
check('manager can create master data', !!steel.id);
await expectError('duplicate location code within a warehouse is rejected',
  q(`insert into public.locations (warehouse_id, code, name) values ($1, 'WH-ST01', 'Dup')`, [wh.id]), /duplicate|unique/i);
await expectError('duplicate SKU is rejected',
  q(`insert into public.products (sku, name) values ('STL-ROD-12', 'Dup')`), /duplicate|unique/i);

// staff cannot write master data
await actAs(staff.id);
await expectError('staff cannot insert products (RLS)', q(`insert into public.products (sku, name) values ('X-1', 'Nope')`), /row-level security|permission denied/i);
await expectError('staff cannot insert warehouses (RLS)', q(`insert into public.warehouses (code, name) values ('X1', 'Nope')`), /row-level security|permission denied/i);
check('staff can read products', (await q(`select id from public.products`)).length === 1);

// ---------------------------------------------------------------------------
// 5. Demo flow — Receipt +100
// ---------------------------------------------------------------------------
section('Receipt: +100 → inventory 100, ledger IN');
await actAs(manager.id);
const receiptId = await rpc('create_receipt', {
  payload: JSON.stringify({
    warehouse_id: wh.id, location_id: mainStore.id, supplier_id: supplier.id,
    items: [{ product_id: steel.id, quantity: 100 }],
  }),
});
let receipt = await one(`select * from public.receipts where id = $1`, [receiptId]);
check('receipt reference = WH/IN/0001', receipt.reference === 'WH/IN/0001', receipt.reference);
check('receipt starts as DRAFT', receipt.status === 'DRAFT');
check('receipt created_by = current user', receipt.created_by === manager.id);
check('receipt responsible defaults to current user', receipt.responsible_user_id === manager.id);

await expectError('validate from DRAFT is rejected', rpc('validate_receipt', { p_id: receiptId }), /must be READY/);
check('no inventory before validation', num(await scalar(`select count(*) from public.inventory`)) === 0);

let res = await rpc('mark_ready', { p_operation_type: 'RECEIPT', p_id: receiptId });
check('mark_ready → READY', res.status === 'READY');
await expectError('READY receipt cannot be edited', rpc('update_receipt', { p_id: receiptId, payload: '{"supplier_id": null}' }), /Only DRAFT/);

res = await rpc('validate_receipt', { p_id: receiptId });
check('validate_receipt → DONE', res.status === 'DONE');
receipt = await one(`select status, completed_at from public.receipts where id = $1`, [receiptId]);
check('receipt status persisted DONE with completed_at', receipt.status === 'DONE' && receipt.completed_at !== null);
check('Main Store = 100', num(await scalar(`select quantity from public.inventory where product_id=$1 and location_id=$2`, [steel.id, mainStore.id])) === 100);
const inMove = await one(`select * from public.stock_movements where reference = 'WH/IN/0001'`);
check('ledger IN +100 to Main Store', inMove && inMove.movement_type === 'IN' && num(inMove.quantity) === 100 && inMove.to_location_id === mainStore.id && inMove.from_location_id === null);
check('ledger performed_by = user', inMove.performed_by === manager.id);
await expectError('DONE receipt cannot be canceled', rpc('cancel_operation', { p_operation_type: 'RECEIPT', p_id: receiptId }), /cannot be canceled/);
await expectError('DONE receipt cannot be validated twice', rpc('validate_receipt', { p_id: receiptId }), /must be READY/);

// ---------------------------------------------------------------------------
// 6. Transfer 30: Main Store → Production Floor
// ---------------------------------------------------------------------------
section('Transfer: 30 units → source 70, destination 30, total 100');
const transferId = await rpc('create_transfer', {
  payload: JSON.stringify({
    source_location_id: mainStore.id, destination_location_id: prodFloor.id,
    items: [{ product_id: steel.id, quantity: 30 }],
  }),
});
check('transfer reference = WH/TR/0001', (await scalar(`select reference from public.transfers where id=$1`, [transferId])) === 'WH/TR/0001');
await rpc('mark_ready', { p_operation_type: 'TRANSFER', p_id: transferId });
res = await rpc('validate_transfer', { p_id: transferId });
check('validate_transfer → DONE', res.status === 'DONE');
check('Main Store = 70', num(await scalar(`select quantity from public.inventory where product_id=$1 and location_id=$2`, [steel.id, mainStore.id])) === 70);
check('Production Floor = 30', num(await scalar(`select quantity from public.inventory where product_id=$1 and location_id=$2`, [steel.id, prodFloor.id])) === 30);
check('Total unchanged = 100', num(await scalar(`select sum(quantity) from public.inventory where product_id=$1`, [steel.id])) === 100);
const trMove = await one(`select * from public.stock_movements where reference = 'WH/TR/0001'`);
check('ledger TRANSFER 30 from Main Store to Production Floor',
  trMove && trMove.movement_type === 'TRANSFER' && num(trMove.quantity) === 30 && trMove.from_location_id === mainStore.id && trMove.to_location_id === prodFloor.id);

await expectError('transfer to same location rejected',
  rpc('create_transfer', { payload: JSON.stringify({ source_location_id: mainStore.id, destination_location_id: mainStore.id, items: [] }) }),
  /different/);

// ---------------------------------------------------------------------------
// 7. Delivery 20 from Production Floor (reservation on READY)
// ---------------------------------------------------------------------------
section('Delivery: 20 units → reserved on READY, inventory 80 after validation, ledger OUT');
const deliveryId = await rpc('create_delivery', {
  payload: JSON.stringify({
    warehouse_id: wh.id, source_location_id: prodFloor.id, customer_id: customer.id,
    items: [{ product_id: steel.id, quantity: 20 }],
  }),
});
check('delivery reference = WH/OUT/0001', (await scalar(`select reference from public.deliveries where id=$1`, [deliveryId])) === 'WH/OUT/0001');
res = await rpc('mark_ready', { p_operation_type: 'DELIVERY', p_id: deliveryId });
check('delivery with available stock → READY', res.status === 'READY', JSON.stringify(res));
let pf = await one(`select quantity, reserved_quantity, free_to_use from public.v_stock where product_id=$1 and location_id=$2`, [steel.id, prodFloor.id]);
check('READY delivery reserves 20 (on hand 30, free to use 10)', num(pf.quantity) === 30 && num(pf.reserved_quantity) === 20 && num(pf.free_to_use) === 10);

// a transfer must not move reserved units
const badTransfer = await rpc('create_transfer', {
  payload: JSON.stringify({ source_location_id: prodFloor.id, destination_location_id: mainStore.id, items: [{ product_id: steel.id, quantity: 15 }] }),
});
await rpc('mark_ready', { p_operation_type: 'TRANSFER', p_id: badTransfer });
await expectError('transfer cannot take reserved stock (15 > 10 free)', rpc('validate_transfer', { p_id: badTransfer }), /Insufficient stock/);
check('failed transfer left inventory untouched', num((await one(`select quantity from public.inventory where product_id=$1 and location_id=$2`, [steel.id, prodFloor.id])).quantity) === 30);
check('failed transfer wrote no ledger row', num(await scalar(`select count(*) from public.stock_movements where reference='WH/TR/0002'`)) === 0);
check('failed transfer stays READY (rolled back)', (await scalar(`select status from public.transfers where id=$1`, [badTransfer])) === 'READY');
await rpc('cancel_operation', { p_operation_type: 'TRANSFER', p_id: badTransfer });

res = await rpc('set_delivery_lines_progress', { p_id: deliveryId, p_stage: 'PACK' });
check('pick/pack progress recorded', num(await scalar(`select packed_quantity from public.delivery_items where delivery_id=$1`, [deliveryId])) === 20);

res = await rpc('validate_delivery', { p_id: deliveryId });
check('validate_delivery → DONE', res.status === 'DONE');
pf = await one(`select quantity, reserved_quantity from public.inventory where product_id=$1 and location_id=$2`, [steel.id, prodFloor.id]);
check('Production Floor = 10, reservation consumed', num(pf.quantity) === 10 && num(pf.reserved_quantity) === 0);
check('Total = 80', num(await scalar(`select sum(quantity) from public.inventory where product_id=$1`, [steel.id])) === 80);
const outMove = await one(`select * from public.stock_movements where reference = 'WH/OUT/0001'`);
check('ledger OUT 20 from Production Floor', outMove && outMove.movement_type === 'OUT' && num(outMove.quantity) === 20 && outMove.from_location_id === prodFloor.id && outMove.to_location_id === null);

// ---------------------------------------------------------------------------
// 8. Adjustment: recorded 10 → counted 7 (−3 damaged)
// ---------------------------------------------------------------------------
section('Adjustment: recorded 10, counted 7 → inventory 7, ledger −3, total 77');
const adjustmentId = await rpc('create_adjustment', {
  payload: JSON.stringify({
    location_id: prodFloor.id, reason: 'Damaged units',
    items: [{ product_id: steel.id, counted_quantity: 7 }],
  }),
});
check('adjustment reference = WH/ADJ/0001', (await scalar(`select reference from public.adjustments where id=$1`, [adjustmentId])) === 'WH/ADJ/0001');
let adjItem = await one(`select recorded_quantity, counted_quantity, difference from public.adjustment_items where adjustment_id=$1`, [adjustmentId]);
check('recorded snapshot = 10, difference = −3', num(adjItem.recorded_quantity) === 10 && num(adjItem.difference) === -3);
await expectError('adjustment without reason rejected',
  rpc('create_adjustment', { payload: JSON.stringify({ location_id: prodFloor.id, reason: '  ', items: [] }) }), /reason/i);

await rpc('mark_ready', { p_operation_type: 'ADJUSTMENT', p_id: adjustmentId });
res = await rpc('validate_adjustment', { p_id: adjustmentId });
check('validate_adjustment → DONE with 1 movement', res.status === 'DONE' && res.movements === 1);
check('Production Floor = 7', num(await scalar(`select quantity from public.inventory where product_id=$1 and location_id=$2`, [steel.id, prodFloor.id])) === 7);
check('Total = 77', num(await scalar(`select sum(quantity) from public.inventory where product_id=$1`, [steel.id])) === 77);
const adjMove = await one(`select * from public.stock_movements where reference = 'WH/ADJ/0001'`);
check('ledger ADJUSTMENT −3 (signed) with reason in notes', adjMove && adjMove.movement_type === 'ADJUSTMENT' && num(adjMove.quantity) === -3 && adjMove.notes === 'Damaged units' && adjMove.from_location_id === prodFloor.id);

// ---------------------------------------------------------------------------
// 9. Move History shows the complete audit trail
// ---------------------------------------------------------------------------
section('Move History');
const history = await q(`select reference, movement_type, signed_quantity, contact_name, product_name from public.v_move_history order by created_at`);
const expected = [
  ['WH/IN/0001', 'IN', 100, 'Tata Steel'],
  ['WH/TR/0001', 'TRANSFER', 30, null],
  ['WH/OUT/0001', 'OUT', -20, 'Acme Fabricators'],
  ['WH/ADJ/0001', 'ADJUSTMENT', -3, null],
];
check('exactly 4 ledger rows for the demo flow', history.length === 4, `got ${history.length}`);
expected.forEach(([ref, type, qty, contact], i) => {
  const row = history[i];
  check(`ledger row ${i + 1}: ${ref} ${type} ${qty > 0 ? '+' : ''}${qty}`,
    row && row.reference === ref && row.movement_type === type && num(row.signed_quantity) === qty && row.contact_name === contact,
    row ? `${row.reference} ${row.movement_type} ${row.signed_quantity} ${row.contact_name}` : 'missing');
});
const summary = await one(`select on_hand, free_to_use, stock_status, location_count from public.v_product_stock where product_id=$1`, [steel.id]);
check('v_product_stock: on hand 77, IN_STOCK, 2 locations', num(summary.on_hand) === 77 && summary.stock_status === 'IN_STOCK' && num(summary.location_count) === 2);

// ---------------------------------------------------------------------------
// 10. Insufficient delivery: 5 available, 8 requested
// ---------------------------------------------------------------------------
section('Insufficient delivery: available 5, requested 8 → WAITING, never negative');
const bolt = await one(`insert into public.products (sku, name, unit_of_measure, reorder_level) values ('BLT-M8', 'Bolt M8', 'pcs', 20) returning id`);
const initAdj = await rpc('init_product_stock', { p_product_id: bolt.id, p_location_id: mainStore.id, p_quantity: 5, p_reason: 'Initial stock' });
check('initial stock created an auto-validated adjustment WH/ADJ/0002',
  (await one(`select reference, status from public.adjustments where id=$1`, [initAdj])).reference === 'WH/ADJ/0002' &&
  (await scalar(`select status from public.adjustments where id=$1`, [initAdj])) === 'DONE');
check('initial stock = 5 with ledger row', num(await scalar(`select quantity from public.inventory where product_id=$1 and location_id=$2`, [bolt.id, mainStore.id])) === 5 &&
  num(await scalar(`select count(*) from public.stock_movements where product_id=$1`, [bolt.id])) === 1);
check('Bolt is LOW_STOCK (5 <= reorder 20)', (await scalar(`select stock_status from public.v_product_stock where product_id=$1`, [bolt.id])) === 'LOW_STOCK');

const waitingId = await rpc('create_delivery', {
  payload: JSON.stringify({ source_location_id: mainStore.id, customer_id: customer.id, items: [{ product_id: bolt.id, quantity: 8 }] }),
});
check('delivery reference = WH/OUT/0002', (await scalar(`select reference from public.deliveries where id=$1`, [waitingId])) === 'WH/OUT/0002');
res = await rpc('mark_ready', { p_operation_type: 'DELIVERY', p_id: waitingId });
check('insufficient stock → WAITING', res.status === 'WAITING', JSON.stringify(res));
check('shortage details reported (requested 8, available 5)', res.shortages?.length === 1 && num(res.shortages[0].requested) === 8 && num(res.shortages[0].available) === 5);
let boltInv = await one(`select quantity, reserved_quantity from public.inventory where product_id=$1 and location_id=$2`, [bolt.id, mainStore.id]);
check('WAITING reserves nothing and inventory stays 5', num(boltInv.quantity) === 5 && num(boltInv.reserved_quantity) === 0);
await expectError('WAITING delivery cannot be validated', rpc('validate_delivery', { p_id: waitingId }), /must be READY/);
check('no OUT movement was written', num(await scalar(`select count(*) from public.stock_movements where reference='WH/OUT/0002'`)) === 0);

// stock arrives → delivery is promoted automatically
const boltReceipt = await rpc('create_receipt', {
  payload: JSON.stringify({ location_id: mainStore.id, supplier_id: supplier.id, items: [{ product_id: bolt.id, quantity: 10 }] }),
});
check('second receipt reference = WH/IN/0002', (await scalar(`select reference from public.receipts where id=$1`, [boltReceipt])) === 'WH/IN/0002');
await rpc('mark_ready', { p_operation_type: 'RECEIPT', p_id: boltReceipt });
await rpc('validate_receipt', { p_id: boltReceipt });
check('WAITING → READY once stock becomes available', (await scalar(`select status from public.deliveries where id=$1`, [waitingId])) === 'READY');
boltInv = await one(`select quantity, reserved_quantity, free_to_use from public.v_stock where product_id=$1 and location_id=$2`, [bolt.id, mainStore.id]);
check('promoted delivery reserved 8 of 15 (free 7)', num(boltInv.quantity) === 15 && num(boltInv.reserved_quantity) === 8 && num(boltInv.free_to_use) === 7);

await expectError('adjustment below reserved quantity is rejected',
  (async () => {
    const id = await rpc('create_adjustment', { payload: JSON.stringify({ location_id: mainStore.id, reason: 'Count', items: [{ product_id: bolt.id, counted_quantity: 5 }] }) });
    await rpc('mark_ready', { p_operation_type: 'ADJUSTMENT', p_id: id });
    await rpc('validate_adjustment', { p_id: id });
  })(), /reserved/);

res = await rpc('cancel_operation', { p_operation_type: 'DELIVERY', p_id: waitingId });
check('cancel READY delivery → CANCELED', res.status === 'CANCELED');
boltInv = await one(`select quantity, reserved_quantity from public.inventory where product_id=$1 and location_id=$2`, [bolt.id, mainStore.id]);
check('cancel releases the reservation (15 on hand, 0 reserved)', num(boltInv.quantity) === 15 && num(boltInv.reserved_quantity) === 0);

// ---------------------------------------------------------------------------
// 11. References are per warehouse + operation
// ---------------------------------------------------------------------------
section('Reference generation');
const wh2 = await one(`insert into public.warehouses (code, name) values ('WH2', 'Second Warehouse') returning id`);
const wh2Loc = await one(`insert into public.locations (warehouse_id, code, name) values ($1, 'WH2-ST01', 'Store') returning id`, [wh2.id]);
const r2 = await rpc('create_receipt', { payload: JSON.stringify({ location_id: wh2Loc.id, items: [{ product_id: steel.id, quantity: 1 }] }) });
check('new warehouse starts its own sequence: WH2/IN/0001', (await scalar(`select reference from public.receipts where id=$1`, [r2])) === 'WH2/IN/0001');
const r3 = await rpc('create_receipt', { payload: JSON.stringify({ location_id: mainStore.id, items: [{ product_id: steel.id, quantity: 1 }] }) });
check('main warehouse continues: WH/IN/0003', (await scalar(`select reference from public.receipts where id=$1`, [r3])) === 'WH/IN/0003');
const crossTransfer = await rpc('create_transfer', { payload: JSON.stringify({ source_location_id: wh2Loc.id, destination_location_id: mainStore.id, items: [{ product_id: steel.id, quantity: 1 }] }) });
check('cross-warehouse transfer uses SOURCE warehouse code: WH2/TR/0001', (await scalar(`select reference from public.transfers where id=$1`, [crossTransfer])) === 'WH2/TR/0001');
await expectError('receipt location must belong to selected warehouse',
  rpc('create_receipt', { payload: JSON.stringify({ warehouse_id: wh.id, location_id: wh2Loc.id, items: [] }) }), /does not belong/);
// duplicate lines merge, invalid quantities rejected
const merged = await rpc('create_receipt', { payload: JSON.stringify({ location_id: mainStore.id, items: [{ product_id: steel.id, quantity: 2 }, { product_id: steel.id, quantity: 3 }] }) });
check('duplicate product lines are merged (2 + 3 = 5)', num(await scalar(`select quantity from public.receipt_items where receipt_id=$1`, [merged])) === 5);
await expectError('zero quantity line rejected',
  rpc('create_receipt', { payload: JSON.stringify({ location_id: mainStore.id, items: [{ product_id: steel.id, quantity: 0 }] }) }), /greater than 0/);
await expectError('mark_ready without lines rejected',
  (async () => { const id = await rpc('create_receipt', { payload: JSON.stringify({ location_id: mainStore.id, items: [] }) }); await rpc('mark_ready', { p_operation_type: 'RECEIPT', p_id: id }); })(),
  /at least one product line/);

// ---------------------------------------------------------------------------
// 12. Dashboard KPIs come from the database
// ---------------------------------------------------------------------------
section('Dashboard KPIs');
const kpis = await rpc('dashboard_kpis', { p_warehouse_id: null, p_category_id: null });
check('KPI: total products in stock = 2', num(kpis.total_products_in_stock) === 2, JSON.stringify(kpis));
check('KPI: low stock = 1 (Bolt 15 <= 20)', num(kpis.low_stock_items) === 1);
check('KPI: out of stock = 0', num(kpis.out_of_stock_items) === 0);
check('KPI: pending receipts counted (drafts exist)', num(kpis.pending_receipts) >= 3);
check('KPI: pending deliveries = 0 (done / canceled)', num(kpis.pending_deliveries) === 0);
check('KPI: transfers scheduled = 1 (WH2/TR/0001 draft)', num(kpis.transfers_scheduled) === 1);
const kpisWh2 = await rpc('dashboard_kpis', { p_warehouse_id: wh2.id, p_category_id: null });
check('KPI warehouse filter: WH2 has 0 products in stock and 1 pending receipt', num(kpisWh2.total_products_in_stock) === 0 && num(kpisWh2.pending_receipts) === 1);
const ops = await q(`select operation_type, reference, status, warehouse_code, contact_name from public.v_operations order by created_at`);
check('v_operations lists every document type', ['RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT'].every((t) => ops.some((o) => o.operation_type === t)));

// ---------------------------------------------------------------------------
// 13. Security: the frontend can never write stock directly
// ---------------------------------------------------------------------------
section('Security: no client-side stock manipulation');
await expectError('client cannot UPDATE inventory', q(`update public.inventory set quantity = 999`), /permission denied/);
await expectError('client cannot INSERT stock_movements', q(`insert into public.stock_movements (reference, product_id, movement_type, quantity) values ('X', $1, 'IN', 1)`, [steel.id]), /permission denied/);
await expectError('client cannot flip an operation to DONE', q(`update public.receipts set status = 'DONE'`), /permission denied/);
await expectError('client cannot insert receipt rows directly', q(`insert into public.receipts (reference, warehouse_id, location_id) values ('HACK', $1, $2)`, [wh.id, mainStore.id]), /permission denied/);
await expectError('client cannot call internal helpers', q(`select public._insert_movement('X', $1, 'IN', 1, null, null, null, null)`, [steel.id]), /permission denied/);
await expectError('client cannot call next_reference', q(`select public.next_reference($1, 'RECEIPT')`, [wh.id]), /permission denied/);
await expectError('client cannot read reference_counters', q(`select * from public.reference_counters`), /permission denied/);
await expectError('user cannot change own role', q(`update public.profiles set role = 'WAREHOUSE_STAFF' where id = $1`, [manager.id]), /permission denied/);
await q(`update public.profiles set full_name = 'Maya M.' where id = $1`, [manager.id]);
check('user can update own full_name', (await scalar(`select full_name from public.profiles where id=$1`, [manager.id])) === 'Maya M.');
await q(`update public.profiles set full_name = 'Hacked' where id = $1`, [staff.id]);
check("user cannot update someone else's profile (0 rows)", (await scalar(`select full_name from public.profiles where id=$1`, [staff.id])) === 'Sam Staff');

// staff can run operations
await actAs(staff.id);
const staffReceipt = await rpc('create_receipt', { payload: JSON.stringify({ location_id: mainStore.id, items: [{ product_id: steel.id, quantity: 4 }] }) });
await rpc('mark_ready', { p_operation_type: 'RECEIPT', p_id: staffReceipt });
res = await rpc('validate_receipt', { p_id: staffReceipt });
check('warehouse staff can perform receipts', res.status === 'DONE');
check('Main Store now 74 (70 + 4)', num(await scalar(`select quantity from public.inventory where product_id=$1 and location_id=$2`, [steel.id, mainStore.id])) === 74);

// integrity invariant: ledger sums equal inventory for every product
await asAdmin();
const mismatch = await q(`
  with ledger as (
    select product_id, sum(delta) as total from (
      -- IN adds, OUT removes, ADJUSTMENT is signed, TRANSFER nets to zero company-wide
      select product_id,
             case movement_type when 'OUT' then -quantity when 'TRANSFER' then 0 else quantity end as delta
      from public.stock_movements
    ) x group by product_id
  ),
  inv as (select product_id, sum(quantity) as total from public.inventory group by product_id)
  select coalesce(l.product_id, i.product_id) as product_id, l.total as ledger_total, i.total as inventory_total
  from ledger l full join inv i on i.product_id = l.product_id
  where coalesce(l.total, 0) <> coalesce(i.total, 0)
`);
check('invariant: Σ ledger == Σ inventory for every product', mismatch.length === 0, JSON.stringify(mismatch));
const negatives = await scalar(`select count(*) from public.inventory where quantity < 0 or reserved_quantity < 0 or reserved_quantity > quantity`);
check('invariant: no negative or over-reserved inventory rows', num(negatives) === 0);

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('Failures:\n - ' + failures.join('\n - '));
  process.exit(1);
}
