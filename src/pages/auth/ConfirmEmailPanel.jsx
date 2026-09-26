import { useEffect, useState } from 'react';
import { MailCheck, RefreshCw } from 'lucide-react';
import { Alert } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { resendConfirmation } from '../../services/auth.service';
import { getErrorMessage } from '../../utils/errors';

const COOLDOWN_SECONDS = 60; // Supabase refuses a second email to the same address within ~60 s

/**
 * Shown when an account exists but the confirmation link has not been opened yet
 * (Supabase default: "Confirm email" ON). Offers to re-send the email.
 */
export function ConfirmEmailPanel({ email, title = 'Confirm your email', children }) {
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState({ kind: null, text: '' });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    setSending(true);
    setStatus({ kind: null, text: '' });
    try {
      await resendConfirmation(email);
      setStatus({ kind: 'success', text: `A new confirmation email was sent to ${email}.` });
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      setStatus({ kind: 'error', text: getErrorMessage(err) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Alert kind="info" icon={MailCheck} title={title}>
        {children || (
          <>
            We sent a confirmation link to <strong>{email}</strong>. Open it to activate your account, then sign in.
          </>
        )}
      </Alert>
      {status.kind && <Alert kind={status.kind}>{status.text}</Alert>}
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>Open the email from Supabase Auth (check spam).</li>
        <li>Click <em>Confirm your mail</em> — it verifies the account and returns to the app.</li>
        <li>Sign in with your Login ID or email.</li>
      </ol>
      <Button variant="secondary" className="w-full" icon={RefreshCw} onClick={resend} loading={sending} disabled={cooldown > 0}>
        {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend confirmation email'}
      </Button>
    </div>
  );
}
