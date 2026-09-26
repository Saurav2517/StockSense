// Configuration that drives the shared Receipt / Delivery / Transfer /
// Adjustment pages. Field names mirror DataBase.md; RPC names mirror
// supabase/migrations/20260926000300_stock_functions.sql.

const PROFILE_FIELDS = 'id,full_name,login_id';
const PRODUCT_FIELDS = 'id,sku,name,unit_of_measure,unit_cost,is_active';

export const OPERATION_TYPES = {
  RECEIPT: {
    type: 'RECEIPT',
    label: 'Receipt',
    plural: 'Receipts',
    path: '/receipts',
    table: 'receipts',
    prefix: 'IN',
    movement: 'IN',
    description: 'Incoming goods from a supplier. Validation increases inventory.',
    hasWarehouse: true,
    contact: { key: 'supplier_id', label: 'Receive From (Supplier)', entity: 'supplier' },
    locations: [{ key: 'location_id', label: 'Destination Location', role: 'to' }],
    linesMode: 'quantity',
    quantityLabel: 'Quantity received',
    statuses: ['DRAFT', 'READY', 'DONE', 'CANCELED'],
    editableStatuses: ['DRAFT'],
    rpc: { create: 'create_receipt', update: 'update_receipt', validate: 'validate_receipt' },
    select: `*,
      warehouse:warehouses(id,code,name),
      location:locations(id,code,name),
      supplier:suppliers(id,name,email,phone,address),
      responsible:profiles!receipts_responsible_user_id_fkey(${PROFILE_FIELDS}),
      creator:profiles!receipts_created_by_fkey(${PROFILE_FIELDS}),
      items:receipt_items(id,product_id,quantity,product:products(${PRODUCT_FIELDS}))`,
  },

  DELIVERY: {
    type: 'DELIVERY',
    label: 'Delivery Order',
    plural: 'Delivery Orders',
    path: '/deliveries',
    table: 'deliveries',
    prefix: 'OUT',
    movement: 'OUT',
    description: 'Outgoing goods to a customer. Stock is reserved when Ready and consumed on validation.',
    hasWarehouse: true,
    contact: { key: 'customer_id', label: 'Delivery Address / Customer', entity: 'customer' },
    locations: [{ key: 'source_location_id', label: 'Source Location', role: 'from' }],
    linesMode: 'quantity',
    quantityLabel: 'Quantity to deliver',
    showAvailability: true,
    statuses: ['DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED'],
    editableStatuses: ['DRAFT', 'WAITING'],
    rpc: { create: 'create_delivery', update: 'update_delivery', validate: 'validate_delivery' },
    select: `*,
      warehouse:warehouses(id,code,name),
      location:locations!deliveries_source_location_id_fkey(id,code,name),
      customer:customers(id,name,email,phone,address),
      responsible:profiles!deliveries_responsible_user_id_fkey(${PROFILE_FIELDS}),
      creator:profiles!deliveries_created_by_fkey(${PROFILE_FIELDS}),
      items:delivery_items(id,product_id,quantity,picked_quantity,packed_quantity,product:products(${PRODUCT_FIELDS}))`,
  },

  TRANSFER: {
    type: 'TRANSFER',
    label: 'Internal Transfer',
    plural: 'Transfers',
    path: '/transfers',
    table: 'transfers',
    prefix: 'TR',
    movement: 'TRANSFER',
    description: 'Moves stock between locations. Total company stock stays unchanged.',
    hasWarehouse: false,
    contact: null,
    locations: [
      { key: 'source_location_id', label: 'Source Location', role: 'from' },
      { key: 'destination_location_id', label: 'Destination Location', role: 'to' },
    ],
    linesMode: 'quantity',
    quantityLabel: 'Quantity to move',
    showAvailability: true,
    statuses: ['DRAFT', 'READY', 'DONE', 'CANCELED'],
    editableStatuses: ['DRAFT'],
    rpc: { create: 'create_transfer', update: 'update_transfer', validate: 'validate_transfer' },
    select: `*,
      source:locations!transfers_source_location_id_fkey(id,code,name,warehouse:warehouses(id,code,name)),
      destination:locations!transfers_destination_location_id_fkey(id,code,name,warehouse:warehouses(id,code,name)),
      responsible:profiles!transfers_responsible_user_id_fkey(${PROFILE_FIELDS}),
      creator:profiles!transfers_created_by_fkey(${PROFILE_FIELDS}),
      items:transfer_items(id,product_id,quantity,product:products(${PRODUCT_FIELDS}))`,
  },

  ADJUSTMENT: {
    type: 'ADJUSTMENT',
    label: 'Inventory Adjustment',
    plural: 'Adjustments',
    path: '/adjustments',
    table: 'adjustments',
    prefix: 'ADJ',
    movement: 'ADJUSTMENT',
    description: 'Reconciles recorded stock with a physical count. A reason is mandatory.',
    hasWarehouse: false,
    contact: null,
    locations: [{ key: 'location_id', label: 'Location', role: 'at' }],
    linesMode: 'count',
    quantityLabel: 'Counted quantity',
    extraFields: [{ key: 'reason', label: 'Reason', type: 'textarea', required: true, placeholder: 'e.g. Damaged units found during cycle count' }],
    statuses: ['DRAFT', 'READY', 'DONE', 'CANCELED'],
    editableStatuses: ['DRAFT'],
    rpc: { create: 'create_adjustment', update: 'update_adjustment', validate: 'validate_adjustment' },
    select: `*,
      location:locations(id,code,name,warehouse:warehouses(id,code,name)),
      responsible:profiles!adjustments_responsible_user_id_fkey(${PROFILE_FIELDS}),
      creator:profiles!adjustments_created_by_fkey(${PROFILE_FIELDS}),
      items:adjustment_items(id,product_id,recorded_quantity,counted_quantity,difference,product:products(${PRODUCT_FIELDS}))`,
  },
};

export const OPERATION_LIST = Object.values(OPERATION_TYPES);

export function getOperationConfig(type) {
  const cfg = OPERATION_TYPES[type];
  if (!cfg) throw new Error(`Unknown operation type: ${type}`);
  return cfg;
}

export function operationPath(type, id) {
  const cfg = getOperationConfig(type);
  return id ? `${cfg.path}/${id}` : cfg.path;
}

/** Status transitions available from the UI for a given operation status. */
export function availableActions(type, status) {
  const cfg = getOperationConfig(type);
  const actions = [];
  const editable = cfg.editableStatuses.includes(status);
  if (editable) actions.push('edit');
  if (status === 'DRAFT') actions.push('ready');
  if (status === 'WAITING') actions.push('recheck');
  if (status === 'READY') {
    if (type === 'DELIVERY') actions.push('pick', 'pack');
    actions.push('validate');
  }
  if (['DRAFT', 'WAITING', 'READY'].includes(status)) actions.push('cancel');
  if (status === 'DONE' && ['RECEIPT', 'DELIVERY'].includes(type)) actions.push('print');
  return actions;
}
