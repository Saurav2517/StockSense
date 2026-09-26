import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { classNames } from '../../utils/format';

const VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 focus-visible:ring-brand-600 disabled:bg-brand-700/60',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:ring-brand-600',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 disabled:bg-red-600/60',
  dangerOutline: 'bg-white text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50 focus-visible:ring-red-600',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-brand-600',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600 disabled:bg-emerald-600/60',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
  icon: 'h-9 w-9 p-0',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, children, className, to, type = 'button', disabled, ...props },
  ref
) {
  const classes = classNames(
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 whitespace-nowrap',
    VARIANTS[variant],
    SIZES[size],
    className
  );
  const content = (
    <>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </>
  );
  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} {...props}>
      {content}
    </button>
  );
});
