import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';
import { classNames } from '../../utils/format';

const ToastContext = createContext(null);

const ICONS = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
  error: <XCircle className="h-5 w-5 text-red-600" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-600" />,
  info: <Info className="h-5 w-5 text-sky-600" />,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (toast) => {
      const id = ++idRef.current;
      const item = { id, kind: 'info', duration: 4500, ...toast };
      setToasts((t) => [...t, item]);
      if (item.duration > 0) setTimeout(() => dismiss(id), item.duration);
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      push,
      dismiss,
      success: (title, description) => push({ kind: 'success', title, description }),
      error: (title, description) => push({ kind: 'error', title, description, duration: 7000 }),
      warning: (title, description) => push({ kind: 'warning', title, description, duration: 6000 }),
      info: (title, description) => push({ kind: 'info', title, description }),
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 sm:items-end sm:px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={classNames(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white p-3 shadow-lg ring-1 ring-black/5',
              t.kind === 'error' ? 'border-red-200' : t.kind === 'success' ? 'border-emerald-200' : t.kind === 'warning' ? 'border-amber-200' : 'border-slate-200'
            )}
          >
            <div className="mt-0.5 shrink-0">{ICONS[t.kind]}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-slate-600 break-words">{t.description}</p>}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
