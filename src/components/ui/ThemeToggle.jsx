import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { classNames } from '../../utils/format';

export function ThemeToggle({ className, variant = 'icon' }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={classNames(
          'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          isDark
            ? 'border-slate-700 bg-slate-800 text-amber-300 hover:bg-slate-700 hover:text-amber-200'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900',
          className
        )}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? (
          <>
            <Sun className="h-4 w-4 text-amber-400" />
            <span>Light Mode</span>
          </>
        ) : (
          <>
            <Moon className="h-4 w-4 text-indigo-600" />
            <span>Dark Mode</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={classNames(
        'relative inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        isDark
          ? 'border-slate-700/80 bg-slate-800/90 text-amber-300 hover:bg-slate-700 hover:text-amber-200 shadow-xs'
          : 'border-slate-200/80 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 shadow-xs',
        className
      )}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDark ? (
        <Sun className="h-4.5 w-4.5 text-amber-300 transition-transform duration-300 hover:rotate-45" />
      ) : (
        <Moon className="h-4.5 w-4.5 text-slate-600 transition-transform duration-300 hover:-rotate-12" />
      )}
    </button>
  );
}
