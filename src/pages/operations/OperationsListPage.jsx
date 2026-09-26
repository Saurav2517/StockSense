import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader, SearchInput, Tabs } from '../../components/ui/Misc';
import { Select } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { OperationsTable } from '../../components/tables/OperationsTable';
import { EmptyState } from '../../components/ui/Feedback';
import { useOperations } from '../../hooks/useOperations';
import { useWarehouses } from '../../hooks/useMasterData';
import { useDebounce } from '../../hooks/useDebounce';
import { getOperationConfig } from '../../utils/operations';
import { STATUS_META } from '../../utils/status';

export function OperationsListPage({ type }) {
  const cfg = getOperationConfig(type);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const debounced = useDebounce(search);
  const status = params.get('status') || '';
  const warehouseId = params.get('warehouse') || '';
  const late = params.get('late') === '1';

  const filters = useMemo(
    () => ({ type, search: debounced, warehouseId, status: status === 'LATE' ? '' : status, lateOnly: status === 'LATE' || late }),
    [type, debounced, warehouseId, status, late]
  );
  const { data: rows = [], isLoading, error, refetch, isFetching } = useOperations(filters);
  const { data: all = [] } = useOperations({ type, warehouseId });
  const { data: warehouses = [] } = useWarehouses();

  const counts = useMemo(() => {
    const c = { '': all.length, LATE: all.filter((r) => r.is_late).length };
    for (const s of cfg.statuses) c[s] = all.filter((r) => r.status === s).length;
    return c;
  }, [all, cfg.statuses]);

  function setParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'q') next.delete('late');
    setParams(next, { replace: true });
  }

  const tabs = [
    { value: '', label: 'All', count: counts[''] },
    ...cfg.statuses.map((s) => ({ value: s, label: STATUS_META[s].label, count: counts[s] })),
    { value: 'LATE', label: 'Late', count: counts.LATE },
  ];

  return (
    <div>
      <PageHeader
        title={cfg.plural}
        subtitle={cfg.description}
        actions={
          <Button to={`${cfg.path}/new`} icon={Plus}>
            New {cfg.label}
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs items={tabs} value={late ? 'LATE' : status} onChange={(v) => setParam('status', v)} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={warehouseId} onChange={(e) => setParam('warehouse', e.target.value)} placeholder="All warehouses" className="sm:w-48" aria-label="Warehouse">
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </Select>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setParam('q', v); }} placeholder="Search reference or contact…" className="sm:w-72" />
        </div>
      </div>

      <OperationsTable
        rows={rows}
        loading={isLoading || isFetching}
        error={error}
        onRetry={refetch}
        empty={
          <EmptyState
            title={`No ${cfg.plural.toLowerCase()} found`}
            description={status || search ? 'Try clearing the filters.' : `Create your first ${cfg.label.toLowerCase()} to get started.`}
            action={!status && !search ? <Button to={`${cfg.path}/new`} icon={Plus}>New {cfg.label}</Button> : null}
          />
        }
      />
    </div>
  );
}
