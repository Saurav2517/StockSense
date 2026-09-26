import { Link } from 'react-router-dom';

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <div className="hidden flex-1 flex-col justify-between bg-brand-800 p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-10 w-10 rounded-xl" />
          <span className="text-xl font-bold tracking-tight">StockSense</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-bold leading-tight">Every stock operation updates inventory and leaves an auditable movement record.</h2>
          <ul className="mt-6 space-y-2 text-brand-100">
            <li>• Receipts, Delivery Orders, Transfers, Adjustments</li>
            <li>• Multi-warehouse, multi-location inventory</li>
            <li>• Stock Ledger / Move History for every change</li>
            <li>• Low-stock alerts and live dashboard KPIs</li>
          </ul>
        </div>
        <p className="text-xs text-brand-200">Progressive Web App · React + Supabase</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <img src="/favicon.svg" alt="" className="h-10 w-10 rounded-xl" />
            <span className="text-xl font-bold tracking-tight text-slate-900">StockSense</span>
          </div>
          <div className="card p-6 sm:p-8">
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <p className="mt-4 text-center text-sm text-slate-600">{footer}</p>}
        </div>
      </div>
    </div>
  );
}

export function AuthLink({ to, children }) {
  return (
    <Link to={to} className="link">
      {children}
    </Link>
  );
}
