// Status model (SystemDesign.md §16) and movement types (DataBase.md §21).
// Colours follow the mockup convention: incoming green, outgoing red.

export const STATUSES = ['DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED'];
export const PENDING_STATUSES = ['DRAFT', 'WAITING', 'READY'];

export const STATUS_META = {
  DRAFT: { label: 'Draft', tone: 'slate', description: 'Initial state — can still be edited' },
  WAITING: { label: 'Waiting', tone: 'amber', description: 'Blocked: required stock is unavailable' },
  READY: { label: 'Ready', tone: 'sky', description: 'Operation can be executed' },
  DONE: { label: 'Done', tone: 'emerald', description: 'Stock operation completed' },
  CANCELED: { label: 'Canceled', tone: 'red', description: 'Closed without moving stock' },
};

export const MOVEMENT_META = {
  IN: { label: 'IN', tone: 'emerald', sign: 1, description: 'Receipt — incoming' },
  OUT: { label: 'OUT', tone: 'red', sign: -1, description: 'Delivery — outgoing' },
  TRANSFER: { label: 'TRANSFER', tone: 'sky', sign: 0, description: 'Internal transfer' },
  ADJUSTMENT: { label: 'ADJUSTMENT', tone: 'amber', sign: 0, description: 'Inventory adjustment' },
};

export const STOCK_STATUS_META = {
  IN_STOCK: { label: 'In stock', tone: 'emerald' },
  LOW_STOCK: { label: 'Low stock', tone: 'amber' },
  OUT_OF_STOCK: { label: 'Out of stock', tone: 'red' },
};

export const ROLE_META = {
  INVENTORY_MANAGER: { label: 'Inventory Manager' },
  WAREHOUSE_STAFF: { label: 'Warehouse Staff' },
};

export const TONE_CLASSES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800/60',
  sky: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-800/60',
  emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800/60',
  red: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800/60',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:ring-brand-800/60',
};
