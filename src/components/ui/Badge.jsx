import { classNames } from '../../utils/format';
import { MOVEMENT_META, STATUS_META, STOCK_STATUS_META, TONE_CLASSES } from '../../utils/status';

export function Badge({ tone = 'slate', children, className, dot = false }) {
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        TONE_CLASSES[tone] || TONE_CLASSES.slate,
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }) {
  const meta = STATUS_META[status] || { label: status, tone: 'slate' };
  return (
    <Badge tone={meta.tone} className={className} dot>
      {meta.label}
    </Badge>
  );
}

export function MovementBadge({ type, className }) {
  const meta = MOVEMENT_META[type] || { label: type, tone: 'slate' };
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}

export function StockStatusBadge({ status, className }) {
  const meta = STOCK_STATUS_META[status] || { label: status, tone: 'slate' };
  return (
    <Badge tone={meta.tone} className={className} dot>
      {meta.label}
    </Badge>
  );
}
