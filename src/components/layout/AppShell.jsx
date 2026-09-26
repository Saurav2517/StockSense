import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Download, LogOut, Menu, User, WifiOff, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { ThemeToggle } from '../ui/ThemeToggle';
import { classNames, initials } from '../../utils/format';
import { ROLE_META } from '../../utils/status';
import { MOBILE_NAV, NAV_SECTIONS } from './navigation';

function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg shadow-xs" />
      {!compact && (
        <div className="leading-tight">
          <p className="text-base font-bold tracking-tight text-slate-900 dark:text-white">StockSense</p>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Inventory Management</p>
        </div>
      )}
    </div>
  );
}

function SidebarNav({ onNavigate }) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section, i) => (
        <div key={section.title || i}>
          {section.title && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{section.title}</p>}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    classNames(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-brand-50 text-brand-800 shadow-xs dark:bg-brand-950/70 dark:text-brand-300'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
                    )
                  }
                >
                  <item.icon className="h-4.5 w-4.5 shrink-0" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserMenu() {
  const { profile, user, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { canInstall, install } = useInstallPrompt();
  const [open, setOpen] = useState(false);

  const name = profile?.full_name || profile?.login_id || user?.email || 'User';

  async function handleSignOut() {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error('Could not sign out', err.message);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white shadow-xs">{initials(name)}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[10rem] truncate text-sm font-medium text-slate-800 dark:text-slate-200">{name}</span>
          <span className="block text-[11px] text-slate-500 dark:text-slate-400">{ROLE_META[profile?.role]?.label || '—'}</span>
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900" role="menu">
            <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
            </div>
            <button type="button" role="menuitem" onClick={() => { setOpen(false); navigate('/profile'); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <User className="h-4 w-4 text-slate-400" /> My Profile
            </button>
            {canInstall && (
              <button type="button" role="menuitem" onClick={() => { setOpen(false); install(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Download className="h-4 w-4 text-slate-400" /> Install app
              </button>
            )}
            <button type="button" role="menuitem" onClick={handleSignOut} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const online = useOnlineStatus();
  // The drawer is "open for a given path": navigating elsewhere closes it without an effect.
  const [drawerPath, setDrawerPath] = useState(null);
  const drawerOpen = drawerPath === location.pathname;
  const setDrawerOpen = (open) => setDrawerPath(open ? location.pathname : null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900/95 lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200/80 dark:border-slate-800 px-5">
          <Brand />
        </div>
        <SidebarNav />
        <div className="border-t border-slate-200/80 dark:border-slate-800 p-3 text-[11px] text-slate-400 dark:text-slate-500">Every stock change leaves a ledger entry.</div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white dark:bg-slate-900 shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4">
              <Brand />
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="no-print sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-900/80 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setDrawerOpen(true)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="lg:hidden">
              <Brand compact />
            </div>
          </div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <ThemeToggle />
            {!online && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800/60">
                <WifiOff className="h-3.5 w-3.5" /> Offline
              </span>
            )}
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-5 pb-24 sm:px-6 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden">
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              classNames('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors', isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400')
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => setDrawerOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <Menu className="h-5 w-5" />
          More
        </button>
      </nav>
    </div>
  );
}
