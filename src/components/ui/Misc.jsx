import { Search, X } from 'lucide-react';
import { classNames } from '../../utils/format';

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={classNames('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9 pr-8"
        aria-label={placeholder}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600" aria-label="Clear search">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Pill tabs. items: [{ value, label, count? }] */
export function Tabs({ items, value, onChange, className }) {
  return (
    <div className={classNames('flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1', className)} role="tablist">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={classNames(
              'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            {it.label}
            {it.count !== undefined && (
              <span className={classNames('rounded-full px-1.5 text-xs', active ? 'bg-brand-50 text-brand-800' : 'bg-slate-200 text-slate-600')}>{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, breadcrumb, className }) {
  return (
    <div className={classNames('mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1 text-xs text-slate-500">{breadcrumb}</div>}
        <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function KpiCard({ label, value, hint, icon: Icon, tone = 'brand', onClick, loading }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    sky: 'bg-sky-50 text-sky-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={classNames('card flex items-center gap-4 p-4 text-left', onClick && 'transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600')}
    >
      {Icon && (
        <div className={classNames('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className={classNames('text-2xl font-bold text-slate-900', loading && 'animate-pulse text-slate-300')}>{loading ? '—' : value}</p>
        {hint && <p className="truncate text-xs text-slate-500">{hint}</p>}
      </div>
    </Comp>
  );
}

/** Definition list for detail pages. items: [{ label, value }] */
export function DetailList({ items, className, columns = 2 }) {
  return (
    <dl className={classNames('grid gap-x-6 gap-y-3', columns === 3 ? 'sm:grid-cols-3' : columns === 1 ? 'grid-cols-1' : 'sm:grid-cols-2', className)}>
      {items
        .filter((it) => it && it.value !== undefined && it.value !== null && it.value !== '')
        .map((it) => (
          <div key={it.label} className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{it.label}</dt>
            <dd className="mt-0.5 break-words text-sm text-slate-900">{it.value}</dd>
          </div>
        ))}
    </dl>
  );
}
