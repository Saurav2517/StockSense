import { KeyRound, ShieldAlert } from 'lucide-react';
import { configError } from '../lib/supabase';

/** Shown when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing or unsafe. */
export function SetupRequiredPage() {
  const secretKey = configError === 'secret-key';
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="card w-full max-w-lg p-8">
        <div className="mb-4 flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-10 w-10 rounded-lg" />
          <div>
            <h1 className="text-lg font-bold text-slate-900">{secretKey ? 'Unsafe Supabase key detected' : 'StockSense needs a Supabase project'}</h1>
            <p className="text-sm text-slate-500">
              {secretKey
                ? 'The app refused to start.'
                : configError === 'bad-url'
                  ? 'VITE_SUPABASE_URL must look like https://<project-ref>.supabase.co (no “…”, spaces or paths).'
                  : configError === 'placeholder'
                    ? '.env.local still contains the example values — replace them with your project’s URL and publishable key.'
                    : 'The frontend is not configured yet.'}
            </p>
          </div>
        </div>
        {secretKey && (
          <p className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <code className="rounded bg-white/70 px-1">VITE_SUPABASE_ANON_KEY</code> contains a <strong>secret / service-role</strong> key. That key bypasses Row Level Security and would be
              exposed to every visitor. Replace it with the <strong>publishable</strong> (<code className="rounded bg-white/70 px-1">sb_publishable_…</code>) or legacy <strong>anon</strong> key.
            </span>
          </p>
        )}
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>Create a Supabase project and run the SQL files in <code className="rounded bg-slate-100 px-1">supabase/migrations/</code> (in order).</li>
          <li>Copy <code className="rounded bg-slate-100 px-1">.env.example</code> to <code className="rounded bg-slate-100 px-1">.env.local</code> and fill in:</li>
        </ol>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
{`VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...   (or the legacy anon key)`}
        </pre>
        <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
          <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Only the publishable / anon key belongs in the frontend. Never use the secret or service-role key here. On Vercel, set the same two variables in Project → Settings → Environment Variables, then restart the dev server after editing .env.local.
        </p>
      </div>
    </div>
  );
}
