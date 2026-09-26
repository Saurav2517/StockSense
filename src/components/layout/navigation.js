import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Boxes,
  ClipboardList,
  Contact,
  History,
  LayoutDashboard,
  MapPin,
  Package,
  SlidersHorizontal,
  Warehouse,
} from 'lucide-react';

// Navigation follows README.md "Main Modules".
export const NAV_SECTIONS = [
  {
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Operations',
    items: [
      { to: '/receipts', label: 'Receipts', icon: ArrowDownToLine },
      { to: '/deliveries', label: 'Delivery Orders', icon: ArrowUpFromLine },
      { to: '/transfers', label: 'Transfers', icon: ArrowLeftRight },
      { to: '/adjustments', label: 'Adjustments', icon: SlidersHorizontal },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { to: '/products', label: 'Products', icon: Package },
      { to: '/stock', label: 'Stock', icon: Boxes },
      { to: '/move-history', label: 'Move History', icon: History },
    ],
  },
  {
    title: 'Settings',
    items: [
      { to: '/settings/warehouses', label: 'Warehouses', icon: Warehouse },
      { to: '/settings/locations', label: 'Locations', icon: MapPin },
      { to: '/settings/contacts', label: 'Contacts', icon: Contact },
    ],
  },
];

export const MOBILE_NAV = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/operations', label: 'Operations', icon: ClipboardList },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/stock', label: 'Stock', icon: Boxes },
];
