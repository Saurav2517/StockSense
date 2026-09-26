import { createClient } from '@supabase/supabase-js';

// Only the public URL + publishable/anon key live in the frontend (README.md → Deployment).
// The secret / service-role key must NEVER be referenced here.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when the configured key is a privileged one that must never ship to browsers. */
function isPrivilegedKey(key = '') {
  if (key.startsWith('sb_secret_')) return true;
  // Legacy JWT keys: the service_role key carries {"role":"service_role"} in its payload.
  try {
    const payload = JSON.parse(atob(key.split('.')[1] || ''));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

const isPlaceholder = (v = '') => /your-project-ref|your-key|your-anon-public-key/i.test(v);

export const configError = !supabaseUrl || !supabaseAnonKey
  ? 'missing'
  : isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey)
    ? 'placeholder'
    : !/^https:\/\/[a-z0-9-]+\.[a-z0-9.-]+\/?$/i.test(supabaseUrl.trim())
      ? 'bad-url'
      : isPrivilegedKey(supabaseAnonKey)
        ? 'secret-key'
        : null;

export const isSupabaseConfigured = configError === null;

/** Host the frontend talks to — shown in connection errors so a wrong URL is obvious. */
export const supabaseHost = (() => {
  try {
    return new URL(supabaseUrl).host;
  } catch {
    return supabaseUrl || '';
  }
})();

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl.trim().replace(/\/$/, ''), supabaseAnonKey.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;

/**
 * Unwraps a supabase-js response `{ data, error }` and throws on error so
 * services can be written with plain async/await.
 */
export async function unwrap(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}
