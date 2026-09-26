import { supabaseHost } from '../lib/supabase';

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

// Supabase Auth's built-in email service (no custom SMTP configured) has two hard limits:
// it only delivers to the project's team-member addresses and sends ~2 emails per hour.
const AUTH_EMAIL_MESSAGES = [
  [/email address not authorized|not authorized/i, 'This email address cannot receive Supabase emails yet: without custom SMTP, Supabase only delivers to the project team\'s addresses. Sign up with the project owner\'s email, or ask the admin to configure SMTP.'],
  [/error sending (confirmation|recovery|magic link) email/i, 'Supabase could not send the email. Its built-in mailer only delivers to the project team\'s addresses (2 emails/hour) — use the project owner\'s email or configure custom SMTP.'],
  [/rate limit exceeded|over_email_send_rate_limit/i, 'Email limit reached — Supabase\'s built-in mailer allows about 2 emails per hour. Please try again later.'],
  [/for security purposes, you can only request this after/i, 'Please wait a minute before requesting another email.'],
];

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;

  const code = error.code || error.status;
  for (const [pattern, text] of AUTH_EMAIL_MESSAGES) {
    if (pattern.test(error.message || '') || pattern.test(String(error.code || ''))) return text;
  }
  if (code === '23505' && error.details) {
    const m = /\((.+?)\)=\((.+?)\)/.exec(error.details);
    if (m) return `${humanize(m[1])} "${m[2]}" already exists.`;
  }
  if (code === '42501' && error.message?.includes('row-level security')) {
    return 'You do not have permission to perform this action (Inventory Manager role required).';
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(error.message || '')) {
    return `Cannot reach the Supabase project at ${supabaseHost || 'the configured URL'}. Check your internet connection, and that VITE_SUPABASE_URL in .env.local is exactly the Project URL from the dashboard (use its copy button — the page shows it truncated), then restart npm run dev.`;
  }
  if (error.message && !/^(TypeError|Failed to fetch)/.test(error.message) && !isGenericPg(error.message)) {
    return error.message;
  }
  if (CODE_MESSAGES[code]) return CODE_MESSAGES[code];
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
