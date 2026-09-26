import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Ban, CheckCheck, CheckCircle2, ClipboardCheck, Package, Pencil, Printer, RefreshCw } from 'lucide-react';
import { PageHeader, DetailList } from '../../components/ui/Misc';
import { Button } from '../../components/ui/Button';
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Alert, ErrorState, LoadingBlock } from '../../components/ui/Feedback';
import { useToast } from '../../hooks/useToast';
import { useCancelOperation, useDeliveryProgress, useMarkReady, useOperation, useValidateOperation } from '../../hooks/useOperations';
import { useStockAtLocation } from '../../hooks/useInventory';
import { availableActions, getOperationConfig, operationPath } from '../../utils/operations';
import { classNames, formatDateTime, formatQty, toNumber } from '../../utils/format';
import { STATUS_META } from '../../utils/status';
import { getErrorMessage } from '../../utils/errors';

function StatusStepper({ flow, status }) {
  const canceled = status === 'CANCELED';
  const currentIndex = flow.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {flow.map((s, i) => {
        const reached = !canceled && i <= currentIndex;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={classNames(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ring-1 ring-inset',
                reached ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-500 ring-slate-200'
              )}
            >
              {reached && i < currentIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
              {STATUS_META[s].label}
            </span>
            {i < flow.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-300" />}
          </li>
        );
      })}
      {canceled && (
        <li>
          <StatusBadge status="CANCELED" />
        </li>
      )}
    </ol>
  );
}

export function OperationDetailPage({ type }) {
  const cfg = getOperationConfig(type);
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: op, isLoading, error, refetch } = useOperation(type, id);

  const markReady = useMarkReady(type);
  const validate = useValidateOperation(type);
  const cancel = useCancelOperation(type);
  const progress = useDeliveryProgress();

  const [confirm, setConfirm] = useState(null); // 'validate' | 'cancel'
  const [shortages, setShortages] = useState(null);

  const sourceLocationId = op?.source_location_id || (type === 'ADJUSTMENT' ? op?.location_id : null);
  const needsAvailability = op && (cfg.showAvailability || cfg.linesMode === 'count') && ['DRAFT', 'WAITING'].includes(op.status);
  const { data: stockAt = {}, isSuccess: stockLoaded } = useStockAtLocation(needsAvailability ? sourceLocationId : null);

  const actions = useMemo(() => (op ? availableActions(type, op.status) : []), [op, type]);

  async function run(label, fn) {
    try {
      const res = await fn();
      return res;
    } catch (err) {
      toast.error(`${label} failed`, getErrorMessage(err));
      return null;
    }
  }

  async function onReady() {
    setShortages(null);
    const res = await run('Mark Ready', () => markReady.mutateAsync(id));
    if (!res) return;
    if (res.status === 'WAITING') {
      setShortages(res.shortages || []);
      toast.warning(`${res.reference} is waiting for stock`, 'Requested quantity exceeds available stock for the highlighted lines.');
    } else {
      toast.success(`${res.reference} is Ready`, type === 'DELIVERY' ? 'Stock has been reserved for this delivery.' : 'You can now validate it.');
    }
  }

  async function onValidate() {
    const res = await run('Validation', () => validate.mutateAsync(id));
    setConfirm(null);
    if (res) toast.success(`${res.reference} validated`, `Inventory updated and ${res.lines} ledger ${res.lines === 1 ? 'entry' : 'entries'} recorded.`);
  }

  async function onCancel() {
    const res = await run('Cancel', () => cancel.mutateAsync(id));
    setConfirm(null);
    if (res) toast.info(`${res.reference} canceled`);
  }

  async function onProgress(stage) {
    const res = await run(stage === 'PICK' ? 'Pick' : 'Pack', () => progress.mutateAsync({ id, stage }));
    if (res) toast.success(`${res.reference} ${stage === 'PICK' ? 'picked' : 'packed'}`);
  }

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!op) return null;

  const flow = cfg.statuses.filter((s) => s !== 'CANCELED' && (s !== 'WAITING' || op.status === 'WAITING'));
  const items = [...(op.items || [])].sort((a, b) => (a.product?.name || '').localeCompare(b.product?.name || ''));
  const contact = op.supplier || op.customer;
  const fromLoc = op.source || (type === 'DELIVERY' ? op.location : null);
  const toLoc = op.destination || (type === 'RECEIPT' ? op.location : null);
  const shortageIds = new Set((shortages || []).map((s) => s.product_id));

  const details = [
    contact && { label: cfg.contact.label, value: contact.name },
    op.warehouse && { label: 'Warehouse', value: `${op.warehouse.code} — ${op.warehouse.name}` },
    fromLoc && { label: 'From location', value: `${fromLoc.warehouse?.code ? fromLoc.warehouse.code + ' / ' : ''}${fromLoc.name}` },
    toLoc && { label: 'To location', value: `${toLoc.warehouse?.code ? toLoc.warehouse.code + ' / ' : ''}${toLoc.name}` },
    type === 'ADJUSTMENT' && op.location && { label: 'Location', value: `${op.location.warehouse?.code} / ${op.location.name}` },
    type === 'ADJUSTMENT' && { label: 'Reason', value: op.reason },
    { label: 'Schedule date', value: formatDateTime(op.schedule_date) },
    { label: 'Responsible', value: op.responsible?.full_name || op.responsible?.login_id || '—' },
    { label: 'Created', value: `${formatDateTime(op.created_at)}${op.creator ? ` · ${op.creator.full_name || op.creator.login_id}` : ''}` },
    op.completed_at && { label: 'Completed', value: formatDateTime(op.completed_at) },
    contact?.address && { label: 'Address', value: contact.address },
  ];

  const totalQty = items.reduce((s, it) => s + toNumber(cfg.linesMode === 'count' ? it.difference : it.quantity), 0);

  return (
    <div>
      <PageHeader
        breadcrumb={
          <Link to={cfg.path} className="link">
            {cfg.plural}
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {op.reference}
            <StatusBadge status={op.status} />
          </span>
        }
        subtitle={cfg.label}
        actions={
          <>
            {actions.includes('edit') && (
              <Button variant="secondary" icon={Pencil} to={`${operationPath(type, id)}/edit`}>
                Edit
              </Button>
            )}
            {actions.includes('ready') && (
              <Button icon={ClipboardCheck} onClick={onReady} loading={markReady.isPending}>
                {type === 'DELIVERY' ? 'Check stock & Mark Ready' : 'Mark as Ready'}
              </Button>
            )}
            {actions.includes('recheck') && (
              <Button icon={RefreshCw} onClick={onReady} loading={markReady.isPending}>
                Check availability
              </Button>
            )}
            {actions.includes('pick') && (
              <Button variant="secondary" icon={Package} onClick={() => onProgress('PICK')} loading={progress.isPending}>
                Pick
              </Button>
            )}
            {actions.includes('pack') && (
              <Button variant="secondary" icon={CheckCheck} onClick={() => onProgress('PACK')} loading={progress.isPending}>
                Pack
              </Button>
            )}
            {actions.includes('validate') && (
              <Button variant="success" icon={CheckCircle2} onClick={() => setConfirm('validate')}>
                Validate
              </Button>
            )}
            {actions.includes('print') && (
              <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
                Print
              </Button>
            )}
            {actions.includes('cancel') && (
              <Button variant="dangerOutline" icon={Ban} onClick={() => setConfirm('cancel')}>
                Cancel
              </Button>
            )}
          </>
        }
      />

      <div className="no-print mb-4">
        <StatusStepper flow={flow} status={op.status} />
      </div>

      {op.status === 'WAITING' && (
        <Alert kind="warning" title="Waiting for stock" className="mb-4">
          Requested quantity exceeds available stock at the source location. Receive or transfer stock into{' '}
          <strong>{fromLoc?.name}</strong> — the delivery becomes Ready automatically — or click <em>Check availability</em>.
        </Alert>
      )}
      {op.status === 'READY' && type === 'DELIVERY' && (
        <Alert kind="info" title="Stock reserved" className="mb-4 no-print" icon={CheckCircle2}>
          The requested quantities are reserved at {fromLoc?.name}. Validating will decrease inventory and record OUT movements.
        </Alert>
      )}
      {op.status === 'DONE' && (
        <Alert kind="success" title="Completed" className="mb-4 no-print" icon={CheckCircle2}>
          Inventory has been updated. See the movements in{' '}
          <Link className="link" to={`/move-history?q=${encodeURIComponent(op.reference)}`}>
            Move History
          </Link>
          .
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Details</h2>
          <DetailList items={details} columns={1} />
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Products ({items.length})</h2>
            <Badge tone="slate">
              {cfg.linesMode === 'count' ? 'Net difference' : 'Total'}: {formatQty(totalQty, { signed: cfg.linesMode === 'count' })}
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Product</th>
                  <th className="th">UoM</th>
                  {cfg.linesMode === 'count' ? (
                    <>
                      <th className="th text-right">Recorded</th>
                      <th className="th text-right">Counted</th>
                      <th className="th text-right">Difference</th>
                    </>
                  ) : (
                    <>
                      {needsAvailability && <th className="th text-right">Free to use</th>}
                      <th className="th text-right">Quantity</th>
                      {type === 'DELIVERY' && <th className="th text-right hidden sm:table-cell">Picked / Packed</th>}
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it) => {
                  const free = toNumber(stockAt[it.product_id]?.free_to_use);
                  const short =
                    needsAvailability && cfg.linesMode !== 'count' && (shortageIds.has(it.product_id) || (stockLoaded && toNumber(it.quantity) > free));
                  const diff = toNumber(it.difference);
                  return (
                    <tr key={it.id} className={classNames(short && 'bg-red-50')}>
                      <td className="td">
                        <p className="font-medium text-slate-900">{it.product?.name}</p>
                        <p className="text-xs text-slate-500">{it.product?.sku}</p>
                      </td>
                      <td className="td text-slate-500">{it.product?.unit_of_measure}</td>
                      {cfg.linesMode === 'count' ? (
                        <>
                          <td className="td text-right tabular-nums">{formatQty(op.status === 'DONE' ? it.recorded_quantity : (stockAt[it.product_id] ? stockAt[it.product_id].quantity : it.recorded_quantity))}</td>
                          <td className="td text-right tabular-nums font-medium">{formatQty(it.counted_quantity)}</td>
                          <td className={classNames('td text-right font-semibold tabular-nums', diff > 0 ? 'text-emerald-700' : diff < 0 ? 'text-red-700' : 'text-slate-500')}>
                            {formatQty(op.status === 'DONE' ? diff : toNumber(it.counted_quantity) - toNumber(stockAt[it.product_id]?.quantity ?? it.recorded_quantity), { signed: true })}
                          </td>
                        </>
                      ) : (
                        <>
                          {needsAvailability && (
                            <td className={classNames('td text-right tabular-nums', short ? 'font-semibold text-red-700' : 'text-slate-600')}>{formatQty(free)}</td>
                          )}
                          <td className={classNames('td text-right font-semibold tabular-nums', short && 'text-red-700')}>
                            {formatQty(it.quantity)}
                            {short && <span className="ml-1 text-xs font-normal">(unavailable)</span>}
                          </td>
                          {type === 'DELIVERY' && (
                            <td className="td text-right tabular-nums text-slate-500 hidden sm:table-cell">
                              {formatQty(it.picked_quantity)} / {formatQty(it.packed_quantity)}
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'validate'}
        onClose={() => setConfirm(null)}
        onConfirm={onValidate}
        loading={validate.isPending}
        variant="success"
        title={`Validate ${op.reference}?`}
        confirmLabel="Validate"
        description={
          type === 'RECEIPT'
            ? 'Inventory will increase by the received quantities and IN movements will be recorded.'
            : type === 'DELIVERY'
              ? 'Inventory will decrease by the delivered quantities and OUT movements will be recorded.'
              : type === 'TRANSFER'
                ? 'Stock moves from the source to the destination location. Total stock stays the same.'
                : 'Inventory will be set to the counted quantities and the differences recorded as ADJUSTMENT movements.'
        }
      >
        <p className="text-sm text-slate-600">This runs as one atomic database transaction and cannot be undone.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        onConfirm={onCancel}
        loading={cancel.isPending}
        variant="danger"
        title={`Cancel ${op.reference}?`}
        confirmLabel="Cancel operation"
        description={op.status === 'READY' && type === 'DELIVERY' ? 'Reserved stock will be released. No inventory movement is recorded.' : 'The document is closed without moving any stock.'}
      />

      <div className="no-print mt-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(cfg.path)}>
          ← Back to {cfg.plural}
        </Button>
      </div>
    </div>
  );
}
