import { cloneElement, forwardRef, isValidElement, useId } from 'react';
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
        <label htmlFor={controlId} className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {content}
      {error ? (
        <p className="text-xs text-red-600" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return <input ref={ref} className={classNames('input', invalid && 'input-error', className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, invalid, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={classNames('input', invalid && 'input-error', className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, invalid, children, placeholder, ...props }, ref) {
  return (
    <select ref={ref} className={classNames('input', invalid && 'input-error', className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
});

export function Checkbox({ label, className, ...props }) {
  const id = useId();
  return (
    <label htmlFor={id} className={classNames('inline-flex items-center gap-2 text-sm text-slate-700', className)}>
      <input id={id} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600" {...props} />
      {label}
    </label>
  );
}
