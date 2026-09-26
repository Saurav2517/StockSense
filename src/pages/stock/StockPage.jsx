import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, ArrowUpFromLine, History, SlidersHorizontal } from 'lucide-react';
import { PageHeader, SearchInput } from '../../components/ui/Misc';
import { Checkbox, Select } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/Feedback';
import { useStock } from '../../hooks/useInventory';
import { useCategories, useLocations, useWarehouses } from '../../hooks/useMasterData';
import { useDebounce } from '../../hooks/useDebounce';
import { classNames, formatDateTime, formatMoney, formatQty } from '../../utils/format';

export function StockPage() {
  const [params, setParams] = useSearchParams();
  const warehouseId = params.get('warehouse') || '';
  const locationId = params.get('location') || '';
  const categoryId = params.get('category') || '';
  const [search, setSearch] = useState(params.get('q') || '');
  const [onlyPositive, setOnlyPositive] = useState(true);
  const debounced = useDebounce(search);

  const { data: warehouses = [] } = useWarehouses();
  const { data: locations = [] } = useLocations(warehouseId ? { warehouseId } : {});
  const { data: categories = [] } = useCategories();

  const filters = useMemo(() => ({ warehouseId, locationId, categoryId, search: debounced, onlyPositive }), [warehouseId, locationId, categoryId, debounced, onlyPositive]);
  const { data: rows = [], isLoading, isFetching, error, refetch } = useStock(filters);

  function setParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'warehouse') next.delete('location');
    setParams(next, { replace: true });
  }

  const totals = useMemo(
    () => ({
      qty: rows.reduce((s, r) => s + Number(r.quantity || 0), 0),
      reserved: rows.reduce((s, r) => s + Number(r.reserved_quantity || 0), 0),
      value: rows.reduce((s, r) => s + Number(r.quantity || 0) * Number(r.unit_cost || 0), 0),
    }),
    [rows]
  );

  const columns = [
    {
      key: 'product_name',
      header: 'Product',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.product_name}</p>
          <p className="text-xs text-slate-500">
            {r.sku}
            {r.category_name ? ` · ${r.category_name}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'location_name',
      header: 'Location',
      render: (r) => (
        <div>
          <p className="text-slate-900">{r.location_name}</p>
          <p className="text-xs text-slate-500">
            {r.warehouse_code} — {r.warehouse_name}
          </p>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'On hand',
      align: 'right',
      render: (r) => (
        <span className={classNames('font-semibold tabular-nums', Number(r.quantity) <= 0 ? 'text-red-700' : Number(r.quantity) <= Number(r.reorder_level) ? 'text-amber-700' : 'text-slate-900')}>
          {formatQty(r.quantity)} <span className="text-xs font-normal text-slate-500">{r.unit_of_measure}</span>
        </span>
      ),
    },
    { key: 'reserved_quantity', header: 'Reserved', align: 'right', hideBelow: 'md', render: (r) => <span className="tabular-nums text-slate-500">{formatQty(r.reserved_quantity)}</span> },
    { key: 'free_to_use', header: 'Free to use', align: 'right', hideBelow: 'sm', render: (r) => <span className="tabular-nums">{formatQty(r.free_to_use)}</span> },
    { key: 'value', header: 'Value', align: 'right', hideBelow: 'xl', render: (r) => <span className="tabular-nums">{formatMoney(Number(r.quantity) * Number(r.unit_cost))}</span> },
    { key: 'updated_at', header: 'Last change', hideBelow: 'lg', render: (r) => <span className="text-xs text-slate-500">{formatDateTime(r.updated_at)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" title="Update stock (adjustment)" aria-label="Update stock" to={`/adjustments/new?location=${r.location_id}&product=${r.product_id}`}>
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Transfer from here" aria-label="Transfer" to={`/transfers/new?location=${r.location_id}&product=${r.product_id}`}>
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Deliver from here" aria-label="Deliver" to={`/deliveries/new?location=${r.location_id}&product=${r.product_id}`}>
            <ArrowUpFromLine className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Move history" aria-label="Move history" to={`/move-history?product=${r.product_id}&location=${r.location_id}`}>
            <History className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Stock"
        subtitle="Current inventory per product and location. Quantities change only through validated operations."
        actions={
          <Button icon={SlidersHorizontal} to="/adjustments/new">
            Update stock
          </Button>
        }
      />

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
        <Select value={categoryId} onChange={(e) => setParam('category', e.target.value)} placeholder="All categories" aria-label="Category">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setParam('q', v); }} placeholder="Search SKU or product…" />
        <div className="flex items-center">
          <Checkbox label="Hide empty rows" checked={onlyPositive} onChange={(e) => setOnlyPositive(e.target.checked)} />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={isLoading || isFetching}
        error={error}
        onRetry={refetch}
        empty={
          <EmptyState
            title="No stock for these filters"
            description="Stock appears here once a receipt or adjustment has been validated."
            action={<Button to="/receipts/new" size="sm">New receipt</Button>}
          />
        }
        footer={
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
            <span>
              <strong>{rows.length}</strong> rows
            </span>
            <span>
              On hand <strong>{formatQty(totals.qty)}</strong>
            </span>
            <span>
              Reserved <strong>{formatQty(totals.reserved)}</strong>
            </span>
            <span>
              Free <strong>{formatQty(totals.qty - totals.reserved)}</strong>
            </span>
            <span>
              Value <strong>{formatMoney(totals.value)}</strong>
            </span>
          </div>
        }
        pageSize={25}
      />
    </div>
  );
}
