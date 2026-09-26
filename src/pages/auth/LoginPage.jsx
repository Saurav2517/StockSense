import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { AuthLayout, AuthLink } from './AuthLayout';
import { FormField, Input } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { useAuth } from '../../hooks/useAuth';
import { ConfirmEmailPanel } from './ConfirmEmailPanel';
import { EMAIL_NOT_CONFIRMED } from '../../services/auth.service';
import { getErrorMessage } from '../../utils/errors';

/**
 * Supabase appends `error_code` / `error_description` to the redirect when an
 * emailed link is expired or was opened in another browser (PKCE). Surface it.
 */
function noticeFromUrl() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.search);
  const description = params.get('error_description');
  if (description) {
    const code = params.get('error_code') || '';
    return { kind: 'warning', text: /otp_expired/.test(code) ? 'That email link has expired. Request a new one below.' : description.replace(/\+/g, ' ') };
  }
  // A `code` without a session means the link was verified server-side but opened in a
  // different browser than the one that requested it (PKCE) — the account is confirmed.
  if (params.get('code')) return { kind: 'success', text: 'Email link verified. Sign in with your Login ID or email.' };
  return null;
}

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [urlNotice] = useState(noticeFromUrl);
  const notice = location.state?.notice || (location.state?.confirmed ? 'Email confirmed — you can sign in now.' : '');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.identifier.trim() || !form.password) {
      setError('Enter your Login ID / email and password');
      return;
    }
    setLoading(true);
    setUnconfirmedEmail('');
    try {
      await signIn(form);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      if (err?.code === EMAIL_NOT_CONFIRMED) setUnconfirmedEmail(err.email);
      else setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use your Login ID or email address."
      footer={
        <>
          New to StockSense? <AuthLink to="/signup">Create an account</AuthLink>
        </>
      }
    >
      {unconfirmedEmail && (
        <div className="mb-4">
          <ConfirmEmailPanel email={unconfirmedEmail} title="Confirm your email first">
            The account <strong>{unconfirmedEmail}</strong> exists but its email address has not been confirmed yet. Open the confirmation link we emailed you, then sign in.
          </ConfirmEmailPanel>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {notice && <Alert kind="success">{notice}</Alert>}
        {urlNotice && <Alert kind={urlNotice.kind}>{urlNotice.text}</Alert>}
        {error && <Alert kind="error">{error}</Alert>}
        <FormField label="Login ID / Email" htmlFor="identifier" required>
          <Input
            id="identifier"
            autoComplete="username"
            autoFocus
            value={form.identifier}
            onChange={(e) => setForm({ ...form, identifier: e.target.value })}
            placeholder="e.g. manager1 or you@company.com"
          />
        </FormField>
        <FormField label="Password" htmlFor="password" required>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </FormField>
        <div className="flex items-center justify-between text-sm">
          <AuthLink to="/forgot-password">Forgot password?</AuthLink>
        </div>
        <Button type="submit" className="w-full" loading={loading} icon={LogIn}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
