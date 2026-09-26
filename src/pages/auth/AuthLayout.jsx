import { Link } from 'react-router-dom';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100 lg:flex-row">
      <div className="absolute right-4 top-4 z-30 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-800 via-teal-900 to-slate-900 p-10 text-white lg:flex">
        {/* Subtle decorative glow */}
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-10 w-10 rounded-xl shadow-lg ring-2 ring-white/20" />
          <span className="text-2xl font-black tracking-tight text-white">StockSense</span>
        </div>
        <div className="relative z-10 max-w-md space-y-4">
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
            Real-time Inventory Management & Stock Audit Ledger
          </h2>
          <p className="text-sm text-brand-100/90 leading-relaxed">
            Track stock movements atomically with strict integrity, multi-warehouse support, and complete audit history.
          </p>
          <ul className="space-y-2.5 pt-2 text-sm text-brand-100">
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500/30 text-teal-300 text-xs font-bold">✓</span>
              Receipts, Delivery Orders, Transfers, Adjustments
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500/30 text-teal-300 text-xs font-bold">✓</span>
              Multi-warehouse & location level stock tracking
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500/30 text-teal-300 text-xs font-bold">✓</span>
              Immutable Stock Ledger / Move History for every change
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500/30 text-teal-300 text-xs font-bold">✓</span>
              Live low-stock alerts and operational KPI dashboard
            </li>
          </ul>
        </div>
        <p className="relative z-10 text-xs text-brand-200/80">Progressive Web App · Built with React & Supabase</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <img src="/favicon.svg" alt="" className="h-10 w-10 rounded-xl shadow-md" />
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">StockSense</span>
          </div>
          <div className="card p-6 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <p className="mt-5 text-center text-sm text-slate-600 dark:text-slate-400">{footer}</p>}
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
