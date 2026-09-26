import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { classNames } from '../../utils/format';
import { getErrorMessage } from '../../utils/errors';

export function Spinner({ className }) {
  return <Loader2 className={classNames('h-5 w-5 animate-spin text-brand-700', className)} />;
}

export function LoadingBlock({ label = 'Loading…', className }) {
  return (
    <div className={classNames('flex items-center justify-center gap-2 py-12 text-sm text-slate-500', className)}>
      <Spinner /> {label}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, action, className }) {
  return (
    <div className={classNames('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Could not load data', className }) {
  return (
    <div className={classNames('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 rounded-full bg-red-50 p-3 text-red-500">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

const ALERT_STYLES = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-900',
};

export function Alert({ kind = 'info', title, children, className, icon: Icon = AlertTriangle }) {
  return (
    <div className={classNames('flex gap-3 rounded-lg border p-3 text-sm', ALERT_STYLES[kind], className)} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
    </div>
  );
}
