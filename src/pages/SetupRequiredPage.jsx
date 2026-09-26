import { KeyRound } from 'lucide-react';

/** Shown when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. */
export function SetupRequiredPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="card w-full max-w-lg p-8">
        <div className="mb-4 flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-10 w-10 rounded-lg" />
          <div>
            <h1 className="text-lg font-bold text-slate-900">StockSense needs a Supabase project</h1>
            <p className="text-sm text-slate-500">The frontend is not configured yet.</p>
          </div>
        </div>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>Create a Supabase project and run the SQL files in <code className="rounded bg-slate-100 px-1">supabase/migrations/</code> (in order).</li>
          <li>Copy <code className="rounded bg-slate-100 px-1">.env.example</code> to <code className="rounded bg-slate-100 px-1">.env.local</code> and fill in:</li>
        </ol>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
{`VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>`}
        </pre>
        <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
          <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Only the public anon key belongs in the frontend. Never use the service-role key here. On Vercel, set the same two variables in Project → Settings → Environment Variables.
        </p>
      </div>
    </div>
  );
}
