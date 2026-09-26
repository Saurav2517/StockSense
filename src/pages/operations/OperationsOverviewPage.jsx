import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ChevronRight, Plus, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '../../components/ui/Misc';
import { Button } from '../../components/ui/Button';
import { OperationsTable } from '../../components/tables/OperationsTable';
import { useOperations } from '../../hooks/useOperations';
import { OPERATION_LIST } from '../../utils/operations';
import { PENDING_STATUSES } from '../../utils/status';

const ICONS = { RECEIPT: ArrowDownToLine, DELIVERY: ArrowUpFromLine, TRANSFER: ArrowLeftRight, ADJUSTMENT: SlidersHorizontal };
const TONES = {
  RECEIPT: 'bg-emerald-50 text-emerald-700',
  DELIVERY: 'bg-red-50 text-red-700',
  TRANSFER: 'bg-sky-50 text-sky-700',
  ADJUSTMENT: 'bg-amber-50 text-amber-700',
};

/** Compact entry point to the four operation types (used by the mobile nav). */
export function OperationsOverviewPage() {
  const { data: rows = [], isLoading, error, refetch } = useOperations({ limit: 100 });
  const pending = rows.filter((r) => PENDING_STATUSES.includes(r.status));

  return (
    <div>
      <PageHeader title="Operations" subtitle="Receipts, Delivery Orders, Internal Transfers and Inventory Adjustments." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {OPERATION_LIST.map((cfg) => {
          const Icon = ICONS[cfg.type];
          const count = pending.filter((r) => r.operation_type === cfg.type).length;
          return (
            <div key={cfg.type} className="card flex items-center gap-4 p-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${TONES[cfg.type]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <Link to={cfg.path} className="flex items-center gap-1 font-semibold text-slate-900 hover:text-brand-700">
                  {cfg.plural} <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
                <p className="truncate text-xs text-slate-500">{count} pending</p>
              </div>
              <Button size="sm" variant="secondary" icon={Plus} to={`${cfg.path}/new`}>
                New
              </Button>
            </div>
          );
        })}
      </div>
      <h2 className="mb-2 text-sm font-semibold text-slate-900">Recent activity</h2>
      <OperationsTable rows={rows.slice(0, 50)} loading={isLoading} error={error} onRetry={refetch} showType pageSize={10} />
    </div>
  );
}
