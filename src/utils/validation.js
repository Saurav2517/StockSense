// Validation rules from SystemDesign.md §5 (Sign Up) — enforced client-side
// for immediate feedback; uniqueness is enforced again by the database.

export function validateLoginId(value = '') {
  const v = value.trim();
  if (!v) return 'Login ID is required';
  if (v.length < 6 || v.length > 12) return 'Login ID must be 6–12 characters';
  if (!/^[A-Za-z0-9._-]+$/.test(v)) return 'Use letters, numbers, dot, dash or underscore only';
  return null;
}

export function validateEmail(value = '') {
  const v = value.trim();
  if (!v) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address';
  return null;
}

/**
 * "Password must contain lowercase, uppercase, special character, and be
 * longer than 8 characters."
 */
export function passwordChecks(value = '') {
  return [
    { id: 'length', label: 'More than 8 characters', ok: value.length > 8 },
    { id: 'lower', label: 'A lowercase letter', ok: /[a-z]/.test(value) },
    { id: 'upper', label: 'An uppercase letter', ok: /[A-Z]/.test(value) },
    { id: 'special', label: 'A special character', ok: /[^A-Za-z0-9]/.test(value) },
  ];
}

export function validatePassword(value = '') {
  const failed = passwordChecks(value).filter((c) => !c.ok);
  if (!value) return 'Password is required';
  if (failed.length) return `Password needs: ${failed.map((c) => c.label.toLowerCase()).join(', ')}`;
  return null;
}

export function validateRequired(value, label = 'This field') {
  if (value === null || value === undefined || String(value).trim() === '') return `${label} is required`;
  return null;
}

export function validatePositiveNumber(value, label = 'Quantity') {
  if (value === '' || value === null || value === undefined) return `${label} is required`;
  const n = Number(value);
  if (!Number.isFinite(n)) return `${label} must be a number`;
  if (n <= 0) return `${label} must be greater than 0`;
  return null;
}

export function validateNonNegativeNumber(value, label = 'Value') {
  if (value === '' || value === null || value === undefined) return `${label} is required`;
  const n = Number(value);
  if (!Number.isFinite(n)) return `${label} must be a number`;
  if (n < 0) return `${label} cannot be negative`;
  return null;
}
