import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Boxes, Clock, PackageX, TrendingDown, X } from 'lucide-react';
import { KpiCard, PageHeader, Tabs } from '../../components/ui/Misc';
import { Select } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { StockStatusBadge } from '../../components/ui/Badge';
import { OperationsTable } from '../../components/tables/OperationsTable';
import { EmptyState } from '../../components/ui/Feedback';
import { useDashboardKpis, useLowStock } from '../../hooks/useInventory';
import { useOperations } from '../../hooks/useOperations';
import { useCategories, useLocations, useWarehouses } from '../../hooks/useMasterData';
import { useAuth } from '../../hooks/useAuth';
import { OPERATION_LIST } from '../../utils/operations';
import { STATUS_META, STATUSES } from '../../utils/status';
import { formatQty } from '../../utils/format';

const EMPTY_FILTERS = { type: '', status: '', warehouseId: '', locationId: '', categoryId: '' };

export function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [tab, setTab] = useState('all'); // all | late | upcoming | waiting

  const { data: warehouses = [] } = useWarehouses();
  const { data: locations = [] } = useLocations(filters.warehouseId ? { warehouseId: filters.warehouseId } : {});
  const { data: categories = [] } = useCategories();

  const kpiFilters = useMemo(() => ({ warehouseId: filters.warehouseId, categoryId: filters.categoryId }), [filters.warehouseId, filters.categoryId]);
  const { data: kpis, isLoading: kpisLoading } = useDashboardKpis(kpiFilters);
  const { data: lowStock = [] } = useLowStock({ limit: 6 });

  const opFilters = useMemo(
    () => ({
      type: filters.type,
      status: tab === 'waiting' ? 'WAITING' : filters.status,
      warehouseId: filters.warehouseId,
      locationId: filters.locationId,
      categoryId: filters.categoryId,
      lateOnly: tab === 'late',
      upcomingOnly: tab === 'upcoming',
      limit: 200,
    }),
    [filters, tab]
  );
  const { data: operations = [], isLoading, isFetching, error, refetch } = useOperations(opFilters);

  const set = (k) => (e) => {
    const value = e.target.value;
    setFilters((f) => ({ ...f, [k]: value, ...(k === 'warehouseId' ? { locationId: '' } : {}) }));
  };
  const hasFilters = Object.values(filters).some(Boolean) || tab !== 'all';

  const kpiCards = [
    { label: 'Total Products in Stock', value: kpis?.total_products_in_stock, icon: Boxes, tone: 'brand', to: '/products?stock=IN_STOCK' },
    { label: 'Low Stock Items', value: kpis?.low_stock_items, icon: TrendingDown, tone: 'amber', to: '/products?stock=LOW_STOCK' },
    { label: 'Out of Stock Items', value: kpis?.out_of_stock_items, icon: PackageX, tone: 'red', to: '/products?stock=OUT_OF_STOCK' },
    { label: 'Pending Receipts', value: kpis?.pending_receipts, icon: ArrowDownToLine, tone: 'emerald', to: '/receipts' },
    { label: 'Pending Deliveries', value: kpis?.pending_deliveries, icon: ArrowUpFromLine, tone: 'red', hint: kpis?.waiting_deliveries ? `${kpis.waiting_deliveries} waiting for stock` : undefined, to: '/deliveries' },
    { label: 'Internal Transfers Scheduled', value: kpis?.transfers_scheduled, icon: ArrowLeftRight, tone: 'sky', to: '/transfers' },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}`}
        subtitle="Live inventory KPIs calculated from the database."
        actions={
          <>
            <Button variant="secondary" size="sm" to="/receipts/new" icon={ArrowDownToLine}>
              Receipt
            </Button>
            <Button variant="secondary" size="sm" to="/deliveries/new" icon={ArrowUpFromLine}>
              Delivery
            </Button>
            <Button variant="secondary" size="sm" to="/transfers/new" icon={ArrowLeftRight}>
              Transfer
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value ?? 0} hint={k.hint} icon={k.icon} tone={k.tone} loading={kpisLoading} onClick={() => navigate(k.to)} />
        ))}
      </div>

      {(kpis?.late_operations > 0 || kpis?.waiting_deliveries > 0) && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {kpis.late_operations > 0 && (
            <button type="button" onClick={() => setTab('late')} className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 font-medium text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-100">
              <Clock className="h-3.5 w-3.5" /> {kpis.late_operations} late operation{kpis.late_operations === 1 ? '' : 's'}
            </button>
          )}
          {kpis.waiting_deliveries > 0 && (
            <button type="button" onClick={() => setTab('waiting')} className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800 ring-1 ring-inset ring-amber-200 hover:bg-amber-100">
              <AlertTriangle className="h-3.5 w-3.5" /> {kpis.waiting_deliveries} deliver{kpis.waiting_deliveries === 1 ? 'y' : 'ies'} waiting for stock
            </button>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        {/* Operations with filters */}
        <div className="xl:col-span-2">
          <div className="mb-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Operations</h2>
              <Tabs
                value={tab}
                onChange={setTab}
                items={[
                  { value: 'all', label: 'All' },
                  { value: 'late', label: 'Late' },
                  { value: 'upcoming', label: 'Upcoming' },
                  { value: 'waiting', label: 'Waiting' },
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Select value={filters.type} onChange={set('type')} placeholder="All types" aria-label="Document type">
                {OPERATION_LIST.map((c) => (
                  <option key={c.type} value={c.type}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <Select value={filters.status} onChange={set('status')} placeholder="All statuses" aria-label="Status" disabled={tab === 'waiting'}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </Select>
              <Select value={filters.warehouseId} onChange={set('warehouseId')} placeholder="All warehouses" aria-label="Warehouse">
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </Select>
              <Select value={filters.locationId} onChange={set('locationId')} placeholder="All locations" aria-label="Location">
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.warehouse?.code} / {l.name}
                  </option>
                ))}
              </Select>
              <Select value={filters.categoryId} onChange={set('categoryId')} placeholder="All categories" aria-label="Product category">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            {hasFilters && (
              <div>
                <Button variant="ghost" size="sm" icon={X} onClick={() => { setFilters(EMPTY_FILTERS); setTab('all'); }}>
                  Clear filters
                </Button>
              </div>
            )}
          </div>
          <OperationsTable rows={operations} loading={isLoading || isFetching} error={error} onRetry={refetch} showType pageSize={10} />
        </div>

        {/* Alerts */}
        <div className="card self-start">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Stock alerts</h2>
            <Link to="/products?stock=LOW_STOCK" className="link text-xs">
              View all
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <EmptyState title="No alerts" description="All products are above their reorder level." className="py-8" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStock.map((p) => (
                <li key={p.product_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.sku} · on hand {formatQty(p.on_hand)} / reorder at {formatQty(p.reorder_level)}
                    </p>
                  </div>
                  <StockStatusBadge status={p.stock_status} />
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-slate-200 px-4 py-3">
            <Button size="sm" variant="secondary" to="/receipts/new" className="w-full" icon={ArrowDownToLine}>
              Receive stock
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
