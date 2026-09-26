// Turns Supabase / PostgREST / PostgreSQL errors into user-friendly text.
// Business-rule errors raised by the database functions already carry a
// readable message, so they are shown as-is.

const CODE_MESSAGES = {
  23505: 'A record with the same unique value already exists.',
  23503: 'This record is referenced by other data and cannot be changed.',
  23514: 'The value violates a business rule (check constraint).',
  42501: 'You do not have permission to perform this action.',
  PGRST301: 'Your session has expired. Please sign in again.',
};

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;

  const code = error.code || error.status;
  if (code === '23505' && error.details) {
    const m = /\((.+?)\)=\((.+?)\)/.exec(error.details);
    if (m) return `${humanize(m[1])} "${m[2]}" already exists.`;
  }
  if (code === '42501' && error.message?.includes('row-level security')) {
    return 'You do not have permission to perform this action (Inventory Manager role required).';
  }
  if (error.message && !/^(TypeError|Failed to fetch)/.test(error.message) && !isGenericPg(error.message)) {
    return error.message;
  }
  if (CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  if (/Failed to fetch|NetworkError/i.test(error.message || '')) {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  return error.message || fallback;
}

function isGenericPg(msg) {
  return /^(duplicate key value|new row violates|insert or update on table|null value in column)/.test(msg);
}

function humanize(column) {
  return column
    .split(',')
    .map((c) => c.trim().replace(/_id$/, '').replace(/_/g, ' '))
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
    .join(' + ');
}
