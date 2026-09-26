import { cloneElement, forwardRef, isValidElement, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { classNames } from '../../utils/format';

/**
 * Label + control + hint/error wrapper used by every form.
 * When the child is a single control without an id, one is generated so the
 * label is always associated with it (screen readers, click-to-focus, tests).
 */
export function FormField({ label, hint, error, required, children, className, htmlFor }) {
  const generatedId = useId();
  const soleChild = isValidElement(children) ? children : null;
  const controlId = htmlFor || soleChild?.props?.id || generatedId;
  const content = soleChild && !htmlFor && !soleChild.props.id ? cloneElement(soleChild, { id: controlId }) : children;
  return (
    <div className={classNames('space-y-1.5', className)}>
      {label && (
        <label htmlFor={controlId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="ml-0.5 text-red-500 dark:text-red-400">*</span>}
        </label>
      )}
      {content}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return <input ref={ref} className={classNames('input', invalid && 'input-error', className)} {...props} />;
});

export const PasswordInput = forwardRef(function PasswordInput({ className, invalid, ...props }, ref) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={showPassword ? 'text' : 'password'}
        className={classNames('pr-10', className)}
        invalid={invalid}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-colors"
        title={showPassword ? 'Hide password' : 'Show password'}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ className, invalid, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={classNames('input', invalid && 'input-error', className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, invalid, children, placeholder, ...props }, ref) {
  return (
    <select ref={ref} className={classNames('input', invalid && 'input-error', className)} {...props}>
      {placeholder !== undefined && <option value="" className="dark:bg-slate-900">{placeholder}</option>}
      {children}
    </select>
  );
});

export function Checkbox({ label, className, ...props }) {
  const id = useId();
  return (
    <label htmlFor={id} className={classNames('inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none', className)}>
      <input id={id} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600 dark:border-slate-700 dark:bg-slate-900" {...props} />
      {label}
    </label>
  );
}
