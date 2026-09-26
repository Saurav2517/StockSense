// Formatting helpers shared by every page. Quantities are numeric(12,3) in the
// database and arrive as strings from PostgREST, so always coerce first.

export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const qtyFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });
const moneyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export function formatQty(value, { signed = false } = {}) {
  const n = toNumber(value);
  const text = qtyFormatter.format(Math.abs(n));
  if (signed) return n < 0 ? `-${text}` : n > 0 ? `+${text}` : text;
  return n < 0 ? `-${text}` : text;
}

export function formatMoney(value) {
  return moneyFormatter.format(toNumber(value));
}

export function formatDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Value for <input type="datetime-local"> in local time. */
export function toDateTimeLocal(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Converts a datetime-local string back to ISO (or null). */
export function fromDateTimeLocal(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isPast(value) {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

export function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0].toUpperCase())
      .join('') || '?'
  );
}

export function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}
