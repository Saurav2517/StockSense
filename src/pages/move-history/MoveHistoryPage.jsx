import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Download, X } from 'lucide-react';
import { PageHeader, SearchInput, Tabs } from '../../components/ui/Misc';
import { Input, Select } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { MovementBadge, StatusBadge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/Feedback';
import { useMoveHistory } from '../../hooks/useInventory';
import { useLocations, useProductList, useWarehouses } from '../../hooks/useMasterData';
import { useDebounce } from '../../hooks/useDebounce';
import { classNames, formatDateTime, formatQty } from '../../utils/format';
import { MOVEMENT_META } from '../../utils/status';
import { operationPath } from '../../utils/operations';

function toCsv(rows) {
  const header = ['Date', 'Reference', 'Type', 'SKU', 'Product', 'Quantity', 'From', 'To', 'Contact', 'Performed by', 'Notes'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      new Date(r.created_at).toISOString(),
      r.reference,
      r.movement_type,
      r.sku,
      r.product_name,
      r.movement_type === 'ADJUSTMENT' ? r.quantity : r.signed_quantity,
      r.from_location_name ? `${r.from_warehouse_code}/${r.from_location_name}` : '',
      r.to_location_name ? `${r.to_warehouse_code}/${r.to_location_name}` : '',
      r.contact_name,
      r.performed_by_name || r.performed_by_login,
      r.notes,
    ]
      .map(esc)
      .join(',')
  );
  return [header.map(esc).join(','), ...lines].join('\n');
}

export function MoveHistoryPage() {
  const [params, setParams] = useSearchParams();
  const movementType = params.get('type') || '';
  const warehouseId = params.get('warehouse') || '';
  const locationId = params.get('location') || '';
  const productId = params.get('product') || '';
  const dateFrom = params.get('from') || '';
  const dateTo = params.get('to') || '';
  const [search, setSearch] = useState(params.get('q') || '');
  const debounced = useDebounce(search);

  const { data: warehouses = [] } = useWarehouses();
  const { data: locations = [] } = useLocations(warehouseId ? { warehouseId } : {});
  const { data: products = [] } = useProductList();

  const filters = useMemo(
    () => ({ movementType, warehouseId, locationId, productId, search: debounced, dateFrom, dateTo }),
    [movementType, warehouseId, locationId, productId, debounced, dateFrom, dateTo]
  );
  const { data: rows = [], isLoading, isFetching, error, refetch } = useMoveHistory(filters);

  function setParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'warehouse') next.delete('location');
    setParams(next, { replace: true });
  }
  const hasFilters = movementType || warehouseId || locationId || productId || dateFrom || dateTo || search;

  function exportCsv() {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stocksense-move-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns = [
    { key: 'created_at', header: 'Date', render: (r) => <span className="whitespace-nowrap text-slate-600">{formatDateTime(r.created_at)}</span> },
    {
      key: 'reference',
      header: 'Reference',
      render: (r) => (
        <Link to={operationPath(r.operation_type, r.operation_id)} className="font-semibold text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
          {r.reference}
        </Link>
      ),
    },
    { key: 'movement_type', header: 'Type', render: (r) => <MovementBadge type={r.movement_type} /> },
    {
      key: 'product_name',
      header: 'Product',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.product_name}</p>
          <p className="text-xs text-slate-500">{r.sku}</p>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Qty',
      align: 'right',
      render: (r) => {
        const q = Number(r.movement_type === 'ADJUSTMENT' ? r.quantity : r.signed_quantity);
        const signed = r.movement_type !== 'TRANSFER';
        return (
          <span className={classNames('font-semibold tabular-nums', signed && q > 0 && 'text-emerald-700', signed && q < 0 && 'text-red-700')}>
            {formatQty(q, { signed })} <span className="text-xs font-normal text-slate-500">{r.unit_of_measure}</span>
          </span>
        );
      },
    },
    {
      key: 'locations',
      header: 'From → To',
      hideBelow: 'md',
      render: (r) => (
        <span className="inline-flex flex-wrap items-center gap-1 text-slate-600">
          <span>{r.from_location_name ? `${r.from_warehouse_code} / ${r.from_location_name}` : r.movement_type === 'IN' ? (r.contact_name || 'Supplier') : '—'}</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          <span>{r.to_location_name ? `${r.to_warehouse_code} / ${r.to_location_name}` : r.movement_type === 'OUT' ? (r.contact_name || 'Customer') : '—'}</span>
        </span>
      ),
    },
    { key: 'contact_name', header: 'Contact', hideBelow: 'xl', render: (r) => r.contact_name || '—' },
    { key: 'performed_by_name', header: 'By', hideBelow: 'lg', render: (r) => r.performed_by_name || r.performed_by_login || '—' },
    { key: 'status', header: 'Status', hideBelow: 'sm', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Move History"
        subtitle="Immutable ledger of every validated stock movement."
        actions={
          <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={rows.length === 0}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={movementType}
          onChange={(v) => setParam('type', v)}
          items={[{ value: '', label: 'All' }, ...Object.entries(MOVEMENT_META).map(([value, meta]) => ({ value, label: meta.label }))]}
        />
        <SearchInput value={search} onChange={(v) => { setSearch(v); setParam('q', v); }} placeholder="Search reference, product, contact…" className="lg:w-80" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Select value={warehouseId} onChange={(e) => setParam('warehouse', e.target.value)} placeholder="All warehouses" aria-label="Warehouse">
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} — {w.name}
            </option>
          ))}
        </Select>
        <Select value={locationId} onChange={(e) => setParam('location', e.target.value)} placeholder="All locations" aria-label="Location">
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.warehouse?.code} / {l.name}
            </option>
          ))}
        </Select>
        <Select value={productId} onChange={(e) => setParam('product', e.target.value)} placeholder="All products" aria-label="Product">
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} — {p.name}
            </option>
          ))}
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setParam('from', e.target.value)} aria-label="From date" />
        <Input type="date" value={dateTo} onChange={(e) => setParam('to', e.target.value)} aria-label="To date" />
      </div>
      {hasFilters && (
        <div className="mb-3">
          <Button variant="ghost" size="sm" icon={X} onClick={() => { setSearch(''); setParams({}, { replace: true }); }}>
            Clear filters
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={isLoading || isFetching}
        error={error}
        onRetry={refetch}
        empty={<EmptyState title="No movements yet" description="Validate a receipt, delivery, transfer or adjustment to see it here." />}
        pageSize={25}
        footer={<span className="text-xs text-slate-500">{rows.length} movement{rows.length === 1 ? '' : 's'}{rows.length >= 500 ? ' (showing latest 500 — narrow the filters for more)' : ''}</span>}
      />
    </div>
  );
}
