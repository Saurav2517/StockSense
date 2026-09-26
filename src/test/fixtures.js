/**
 * Fixture database for the UI tests — mirrors the demo flow in README §24:
 * WH / Rack A1 & Rack B2, two products, one draft receipt, one waiting delivery.
 */
export const IDS = {
  user: '00000000-0000-0000-0000-000000000001',
  wh: '10000000-0000-0000-0000-000000000001',
  a1: '20000000-0000-0000-0000-000000000001',
  b2: '20000000-0000-0000-0000-000000000002',
  catRaw: '30000000-0000-0000-0000-000000000001',
  steel: '40000000-0000-0000-0000-000000000001',
  paint: '40000000-0000-0000-0000-000000000002',
  supplier: '50000000-0000-0000-0000-000000000001',
  customer: '60000000-0000-0000-0000-000000000001',
  receipt: '70000000-0000-0000-0000-000000000001',
  delivery: '80000000-0000-0000-0000-000000000001',
};

export const session = {
  access_token: 'fake',
  user: { id: IDS.user, email: 'manager@example.com' },
};

const now = new Date();
const iso = (d) => d.toISOString();
const past = iso(new Date(now.getTime() - 2 * 86400000));
const future = iso(new Date(now.getTime() + 2 * 86400000));

export function createDb() {
  const warehouse = { id: IDS.wh, code: 'WH', name: 'Main Warehouse', address: 'Ludhiana', is_active: true, created_at: past };
  const whEmbed = { id: IDS.wh, code: 'WH', name: 'Main Warehouse', is_active: true };
  const locations = [
    { id: IDS.a1, warehouse_id: IDS.wh, code: 'A1', name: 'Rack A1', is_active: true, warehouse: whEmbed },
    { id: IDS.b2, warehouse_id: IDS.wh, code: 'B2', name: 'Rack B2', is_active: true, warehouse: whEmbed },
  ];
  const products = [
    { id: IDS.steel, sku: 'STL-001', name: 'Steel Rod 12mm', category_id: IDS.catRaw, unit_of_measure: 'pcs', unit_cost: 50, reorder_level: 20, is_active: true },
    { id: IDS.paint, sku: 'PNT-002', name: 'Wall Paint 5L', category_id: null, unit_of_measure: 'l', unit_cost: 12.5, reorder_level: 10, is_active: true },
  ];
  const profile = { id: IDS.user, login_id: 'manager1', email: 'manager@example.com', full_name: 'Asha Manager', role: 'INVENTORY_MANAGER', created_at: past };

  return {
    profiles: [profile],
    categories: [{ id: IDS.catRaw, name: 'Raw Material', description: null }],
    warehouses: [warehouse],
    locations,
    products,
    suppliers: [{ id: IDS.supplier, name: 'Tata Steel', email: 'sales@tata.example', phone: '', address: 'Jamshedpur' }],
    customers: [{ id: IDS.customer, name: 'Acme Builders', email: '', phone: '', address: 'Delhi' }],

    v_product_stock: [
      { product_id: IDS.steel, sku: 'STL-001', name: 'Steel Rod 12mm', category_id: IDS.catRaw, category_name: 'Raw Material', unit_of_measure: 'pcs', unit_cost: 50, reorder_level: 20, is_active: true, on_hand: 100, reserved: 0, free_to_use: 100, location_count: 2, stock_value: 5000, stock_status: 'IN_STOCK' },
      { product_id: IDS.paint, sku: 'PNT-002', name: 'Wall Paint 5L', category_id: null, category_name: null, unit_of_measure: 'l', unit_cost: 12.5, reorder_level: 10, is_active: true, on_hand: 5, reserved: 0, free_to_use: 5, location_count: 1, stock_value: 62.5, stock_status: 'LOW_STOCK' },
    ],
    v_stock: [
      { id: 'inv-1', product_id: IDS.steel, sku: 'STL-001', product_name: 'Steel Rod 12mm', unit_of_measure: 'pcs', unit_cost: 50, reorder_level: 20, category_id: IDS.catRaw, category_name: 'Raw Material', location_id: IDS.a1, location_code: 'A1', location_name: 'Rack A1', warehouse_id: IDS.wh, warehouse_code: 'WH', warehouse_name: 'Main Warehouse', quantity: 70, reserved_quantity: 0, free_to_use: 70, updated_at: past },
      { id: 'inv-2', product_id: IDS.steel, sku: 'STL-001', product_name: 'Steel Rod 12mm', unit_of_measure: 'pcs', unit_cost: 50, reorder_level: 20, category_id: IDS.catRaw, category_name: 'Raw Material', location_id: IDS.b2, location_code: 'B2', location_name: 'Rack B2', warehouse_id: IDS.wh, warehouse_code: 'WH', warehouse_name: 'Main Warehouse', quantity: 30, reserved_quantity: 0, free_to_use: 30, updated_at: past },
      { id: 'inv-3', product_id: IDS.paint, sku: 'PNT-002', product_name: 'Wall Paint 5L', unit_of_measure: 'l', unit_cost: 12.5, reorder_level: 10, category_id: null, category_name: null, location_id: IDS.a1, location_code: 'A1', location_name: 'Rack A1', warehouse_id: IDS.wh, warehouse_code: 'WH', warehouse_name: 'Main Warehouse', quantity: 5, reserved_quantity: 0, free_to_use: 5, updated_at: past },
    ],
    v_operations: [
      { operation_type: 'RECEIPT', id: IDS.receipt, reference: 'WH/IN/0001', status: 'DRAFT', schedule_date: future, created_at: past, completed_at: null, warehouse_id: IDS.wh, warehouse_code: 'WH', location_id: IDS.a1, location_name: 'Rack A1', destination_location_id: null, destination_location_name: null, contact_name: 'Tata Steel', note: null, responsible_user_id: IDS.user, responsible_name: 'Asha Manager', line_count: 1, category_ids: [IDS.catRaw], is_late: false },
      { operation_type: 'DELIVERY', id: IDS.delivery, reference: 'WH/OUT/0001', status: 'WAITING', schedule_date: past, created_at: past, completed_at: null, warehouse_id: IDS.wh, warehouse_code: 'WH', location_id: IDS.a1, location_name: 'Rack A1', destination_location_id: null, destination_location_name: null, contact_name: 'Acme Builders', note: null, responsible_user_id: IDS.user, responsible_name: 'Asha Manager', line_count: 1, category_ids: [], is_late: true },
    ],
    v_move_history: [
      { id: 'mv-1', reference: 'WH/ADJ/0001', movement_type: 'ADJUSTMENT', quantity: 100, signed_quantity: 100, product_id: IDS.steel, sku: 'STL-001', product_name: 'Steel Rod 12mm', unit_of_measure: 'pcs', category_id: IDS.catRaw, from_location_id: null, from_location_name: null, from_warehouse_id: null, from_warehouse_code: null, to_location_id: IDS.a1, to_location_name: 'Rack A1', to_warehouse_id: IDS.wh, to_warehouse_code: 'WH', operation_id: 'adj-1', operation_type: 'ADJUSTMENT', contact_name: null, status: 'DONE', performed_by: IDS.user, performed_by_name: 'Asha Manager', performed_by_login: 'manager1', notes: 'Initial stock', created_at: past },
    ],

    receipts: [
      {
        id: IDS.receipt, reference: 'WH/IN/0001', status: 'DRAFT', warehouse_id: IDS.wh, location_id: IDS.a1, supplier_id: IDS.supplier, schedule_date: future, responsible_user_id: IDS.user, created_by: IDS.user, created_at: past, completed_at: null,
        warehouse: whEmbed, location: { id: IDS.a1, code: 'A1', name: 'Rack A1' }, supplier: { id: IDS.supplier, name: 'Tata Steel', address: 'Jamshedpur' },
        responsible: { id: IDS.user, full_name: 'Asha Manager', login_id: 'manager1' }, creator: { id: IDS.user, full_name: 'Asha Manager', login_id: 'manager1' },
        items: [{ id: 'ri-1', product_id: IDS.steel, quantity: 100, product: { id: IDS.steel, sku: 'STL-001', name: 'Steel Rod 12mm', unit_of_measure: 'pcs' } }],
      },
    ],
    deliveries: [
      {
        id: IDS.delivery, reference: 'WH/OUT/0001', status: 'WAITING', warehouse_id: IDS.wh, source_location_id: IDS.a1, customer_id: IDS.customer, schedule_date: past, responsible_user_id: IDS.user, created_by: IDS.user, created_at: past, completed_at: null,
        warehouse: whEmbed, location: { id: IDS.a1, code: 'A1', name: 'Rack A1' }, customer: { id: IDS.customer, name: 'Acme Builders', address: 'Delhi' },
        responsible: { id: IDS.user, full_name: 'Asha Manager', login_id: 'manager1' }, creator: null,
        items: [{ id: 'di-1', product_id: IDS.paint, quantity: 8, picked_quantity: 0, packed_quantity: 0, product: { id: IDS.paint, sku: 'PNT-002', name: 'Wall Paint 5L', unit_of_measure: 'l' } }],
      },
    ],
    transfers: [],
    adjustments: [],
  };
}

/** RPC handlers that mimic the SQL functions closely enough for UI behaviour. */
export function createRpc(db) {
  return {
    dashboard_kpis: () => ({
      total_products_in_stock: 2,
      low_stock_items: 1,
      out_of_stock_items: 0,
      pending_receipts: 1,
      pending_deliveries: 1,
      waiting_deliveries: 1,
      transfers_scheduled: 0,
      pending_adjustments: 0,
      late_operations: 1,
      generated_at: new Date().toISOString(),
    }),
    email_for_login_id: ({ p_login_id }) => (p_login_id === 'manager1' ? 'manager@example.com' : null),
    login_id_available: ({ p_login_id }) => p_login_id !== 'manager1',
    init_product_stock: () => 'adj-new',
    create_receipt: ({ payload }) => {
      const id = 'new-receipt-1';
      db.receipts.push({
        id, reference: 'WH/IN/0002', status: 'DRAFT', ...payload,
        warehouse: db.warehouses[0], location: db.locations.find((l) => l.id === payload.location_id),
        supplier: db.suppliers.find((s) => s.id === payload.supplier_id) || null, responsible: null, creator: null, created_at: new Date().toISOString(),
        items: payload.items.map((it, i) => ({ id: `nri-${i}`, ...it, product: db.products.find((p) => p.id === it.product_id) })),
      });
      return id;
    },
    mark_ready: ({ p_operation_type, p_id }) => {
      const table = { RECEIPT: 'receipts', DELIVERY: 'deliveries', TRANSFER: 'transfers', ADJUSTMENT: 'adjustments' }[p_operation_type];
      const row = db[table].find((r) => r.id === p_id);
      if (p_operation_type === 'DELIVERY') {
        // 8 requested > 5 available → WAITING (README §30 test 5)
        row.status = 'WAITING';
        return { id: p_id, reference: row.reference, status: 'WAITING', shortages: [{ product_id: row.items[0].product_id, sku: 'PNT-002', name: 'Wall Paint 5L', requested: 8, available: 5 }] };
      }
      row.status = 'READY';
      return { id: p_id, reference: row.reference, status: 'READY' };
    },
    validate_receipt: ({ p_id }) => {
      const row = db.receipts.find((r) => r.id === p_id);
      if (row.status !== 'READY') throw new Error(`Only READY receipts can be validated (current status: ${row.status})`);
      row.status = 'DONE';
      row.completed_at = new Date().toISOString();
      return { id: p_id, reference: row.reference, status: 'DONE', lines: row.items.length };
    },
    cancel_operation: ({ p_operation_type, p_id }) => {
      const table = { RECEIPT: 'receipts', DELIVERY: 'deliveries' }[p_operation_type];
      const row = db[table].find((r) => r.id === p_id);
      row.status = 'CANCELED';
      return { id: p_id, reference: row.reference, status: 'CANCELED' };
    },
  };
}
