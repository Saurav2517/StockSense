import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Boxes, History, Pencil, Plus, SlidersHorizontal, Tags } from 'lucide-react';
import { PageHeader, SearchInput, Tabs } from '../../components/ui/Misc';
import { Checkbox, Select } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { StockStatusBadge, Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/Feedback';
import { Modal } from '../../components/ui/Modal';
import { useCategories, useProductStock } from '../../hooks/useMasterData';
import { useStock } from '../../hooks/useInventory';
import { useDebounce } from '../../hooks/useDebounce';
import { formatMoney, formatQty } from '../../utils/format';
import { STOCK_STATUS_META } from '../../utils/status';
import { ProductFormModal } from './ProductFormModal';
import { CategoriesModal } from './CategoriesModal';

function StockByLocationModal({ product, onClose }) {
  const { data: rows = [], isLoading, error, refetch } = useStock({ productId: product?.product_id, onlyPositive: false });
  return (
    <Modal open={Boolean(product)} onClose={onClose} title={product?.name} description={`${product?.sku} · stock by location`} size="lg">
      <DataTable
        columns={[
          { key: 'warehouse_code', header: 'Warehouse', render: (r) => `${r.warehouse_code} — ${r.warehouse_name}` },
          { key: 'location_name', header: 'Location', render: (r) => `${r.location_code} — ${r.location_name}` },
          { key: 'quantity', header: 'On hand', align: 'right', render: (r) => <span className="font-semibold tabular-nums">{formatQty(r.quantity)}</span> },
          { key: 'reserved_quantity', header: 'Reserved', align: 'right', render: (r) => <span className="tabular-nums text-slate-500">{formatQty(r.reserved_quantity)}</span> },
          { key: 'free_to_use', header: 'Free to use', align: 'right', render: (r) => <span className="tabular-nums">{formatQty(r.free_to_use)}</span> },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (r) => (
              <Button size="sm" variant="secondary" to={`/adjustments/new?location=${r.location_id}&product=${r.product_id}`} icon={SlidersHorizontal}>
                Adjust
              </Button>
            ),
          },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        empty={<EmptyState title="No stock recorded" description="Receive stock or add it with an adjustment." action={<Button to="/receipts/new" size="sm">New receipt</Button>} />}
        pageSize={10}
      />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" size="sm" icon={History} to={`/move-history?product=${product?.product_id}`}>
          Move history
        </Button>
      </div>
    </Modal>
  );
}

export function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const stockStatus = params.get('stock') || '';
  const categoryId = params.get('category') || '';
  const [search, setSearch] = useState(params.get('q') || '');
  const [includeInactive, setIncludeInactive] = useState(false);
  const debounced = useDebounce(search);

  const filters = useMemo(() => ({ search: debounced, categoryId, stockStatus, includeInactive }), [debounced, categoryId, stockStatus, includeInactive]);
  const { data: rows = [], isLoading, isFetching, error, refetch } = useProductStock(filters);
  const { data: allRows = [] } = useProductStock({ includeInactive, categoryId, search: debounced });
  const { data: categories = [] } = useCategories();

  const [editing, setEditing] = useState(null); // null | {} (new) | product
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [viewing, setViewing] = useState(null);

  function setParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const counts = useMemo(() => {
    const c = { '': allRows.length };
    for (const s of Object.keys(STOCK_STATUS_META)) c[s] = allRows.filter((r) => r.stock_status === s).length;
    return c;
  }, [allRows]);

  const totals = useMemo(
    () => ({
      onHand: rows.reduce((s, r) => s + Number(r.on_hand || 0), 0),
      value: rows.reduce((s, r) => s + Number(r.stock_value || 0), 0),
    }),
    [rows]
  );

  const columns = [
    {
      key: 'sku',
      header: 'Product',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.name}</p>
          <p className="text-xs text-slate-500">
            {r.sku}
            {!r.is_active && (
              <Badge tone="slate" className="ml-2">
                Inactive
              </Badge>
            )}
          </p>
        </div>
      ),
    },
    { key: 'category_name', header: 'Category', hideBelow: 'md', render: (r) => r.category_name || <span className="text-slate-400">—</span> },
    { key: 'unit_of_measure', header: 'UoM', hideBelow: 'lg' },
    { key: 'on_hand', header: 'On hand', align: 'right', render: (r) => <span className="font-semibold tabular-nums">{formatQty(r.on_hand)}</span> },
    { key: 'reserved', header: 'Reserved', align: 'right', hideBelow: 'lg', render: (r) => <span className="tabular-nums text-slate-500">{formatQty(r.reserved)}</span> },
    { key: 'free_to_use', header: 'Free', align: 'right', hideBelow: 'md', render: (r) => <span className="tabular-nums">{formatQty(r.free_to_use)}</span> },
    { key: 'reorder_level', header: 'Reorder at', align: 'right', hideBelow: 'lg', render: (r) => <span className="tabular-nums text-slate-500">{formatQty(r.reorder_level)}</span> },
    { key: 'stock_value', header: 'Value', align: 'right', hideBelow: 'xl', render: (r) => <span className="tabular-nums">{formatMoney(r.stock_value)}</span> },
    { key: 'stock_status', header: 'Status', render: (r) => <StockStatusBadge status={r.stock_status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" aria-label="Stock by location" title="Stock by location" onClick={() => setViewing(r)}>
            <Boxes className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Edit product" title="Edit product" onClick={() => setEditing(r)}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Master data with live stock across all locations."
        actions={
          <>
            <Button variant="secondary" icon={Tags} onClick={() => setCategoriesOpen(true)}>
              Categories
            </Button>
            <Button icon={Plus} onClick={() => setEditing({})}>
              New product
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={stockStatus}
          onChange={(v) => setParam('stock', v)}
          items={[
            { value: '', label: 'All', count: counts[''] },
            ...Object.entries(STOCK_STATUS_META).map(([value, meta]) => ({ value, label: meta.label, count: counts[value] })),
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={categoryId} onChange={(e) => setParam('category', e.target.value)} placeholder="All categories" className="sm:w-48" aria-label="Category">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setParam('q', v); }} placeholder="Search SKU or name…" className="sm:w-64" />
          <Checkbox label="Show inactive" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.product_id}
        loading={isLoading || isFetching}
        error={error}
        onRetry={refetch}
        onRowClick={(r) => setViewing(r)}
        empty={
          <EmptyState
            title={debounced || categoryId || stockStatus ? 'No products match these filters' : 'No products yet'}
            description={debounced || categoryId || stockStatus ? 'Try clearing the search or filters.' : 'Create your first product. You can record initial stock at the same time.'}
            action={!debounced && !categoryId && !stockStatus ? <Button icon={Plus} onClick={() => setEditing({})}>New product</Button> : null}
          />
        }
        footer={
          rows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                {rows.length} product{rows.length === 1 ? '' : 's'} · total on hand {formatQty(totals.onHand)} · stock value {formatMoney(totals.value)}
              </span>
              <Link to="/stock" className="link">
                View stock by location →
              </Link>
            </div>
          )
        }
      />

      {editing !== null && <ProductFormModal open product={editing.product_id ? editing : null} onClose={() => setEditing(null)} />}
      <CategoriesModal open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
      {viewing && <StockByLocationModal product={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
