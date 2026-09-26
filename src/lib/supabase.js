import { createClient } from '@supabase/supabase-js';

// Only the public URL + anon key live in the frontend (README.md → Deployment).
// The service-role key must NEVER be referenced here.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && /^https?:\/\//.test(supabaseUrl)
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
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
