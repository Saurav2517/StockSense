import { NavLink } from 'react-router-dom';
import { Building2, MapPin, Users } from 'lucide-react';
import { classNames } from '../../utils/format';

const TABS = [
  { to: '/settings/warehouses', label: 'Warehouses', icon: Building2 },
  { to: '/settings/locations', label: 'Locations', icon: MapPin },
  { to: '/settings/contacts', label: 'Suppliers & Customers', icon: Users },
];

/** Sub-navigation shared by the settings pages. */
export function SettingsTabs() {
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Settings">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            classNames(
              '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium',
              isActive ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-800'
            )
          }
        >
          <Icon className="h-4 w-4" /> {label}
        </NavLink>
      ))}
    </nav>
  );
}
