import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { AuthLayout, AuthLink } from './AuthLayout';
import { FormField, Input, PasswordInput } from '../../components/ui/FormField';
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
  if (params.get('code')) return { kind: 'success', text: 'Email link verified. Sign in with your Login ID or email.' };
  return null;
}

export function LoginPage() {
  const { signIn, requestLoginOtp, verifyLoginOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mode: 'password' | 'otp'
  const [authMode, setAuthMode] = useState('password');

  // Password state
  const [form, setForm] = useState({ identifier: '', password: '' });

  // OTP state
  const [otpIdentifier, setOtpIdentifier] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [error, setError] = useState('');
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [urlNotice] = useState(noticeFromUrl);
  const notice = location.state?.notice || (location.state?.confirmed ? 'Email confirmed — you can sign in now.' : '');

  // Handle standard password login
  async function onSubmitPassword(e) {
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

  // Handle requesting OTP code via email
  async function handleSendOtp(e) {
    if (e) e.preventDefault();
    setError('');
    if (!otpIdentifier.trim()) {
      setError('Enter your Login ID or email address');
      return;
    }
    setLoading(true);
    setUnconfirmedEmail('');
    try {
      const email = await requestLoginOtp(otpIdentifier);
      setOtpEmail(email);
      setOtpSent(true);
    } catch (err) {
      if (err?.code === EMAIL_NOT_CONFIRMED) setUnconfirmedEmail(err.email);
      else setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  // Handle verifying OTP code
  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    if (!otpToken.trim()) {
      setError('Enter the 6-digit OTP code');
      return;
    }
    setLoading(true);
    try {
      await verifyLoginOtp({ email: otpEmail, token: otpToken });
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in to StockSense"
      subtitle={authMode === 'password' ? 'Sign in using your password or switch to OTP authentication.' : 'Sign in using a one-time OTP code sent to your email.'}
      footer={
        <>
          New to StockSense? <AuthLink to="/signup">Create an account</AuthLink>
        </>
      }
    >
      {/* Auth Mode Toggle Tabs */}
      <div className="mb-6 flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800/80">
        <button
          type="button"
          onClick={() => { setAuthMode('password'); setError(''); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
            authMode === 'password'
              ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Password Login
        </button>
        <button
          type="button"
          onClick={() => { setAuthMode('otp'); setError(''); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
            authMode === 'otp'
              ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Mail className="h-3.5 w-3.5" />
          OTP Authentication
        </button>
      </div>

      {unconfirmedEmail && (
        <div className="mb-4">
          <ConfirmEmailPanel email={unconfirmedEmail} title="Confirm your email first">
            The account <strong>{unconfirmedEmail}</strong> exists but its email address has not been confirmed yet. Open the confirmation link we emailed you, then sign in.
          </ConfirmEmailPanel>
        </div>
      )}

      {notice && <Alert kind="success" className="mb-4">{notice}</Alert>}
      {urlNotice && <Alert kind={urlNotice.kind} className="mb-4">{urlNotice.text}</Alert>}
      {error && <Alert kind="error" className="mb-4">{error}</Alert>}

      {authMode === 'password' ? (
        /* Password Sign In Form */
        <form onSubmit={onSubmitPassword} className="space-y-4" noValidate>
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
            <PasswordInput
              id="password"
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
      ) : !otpSent ? (
        /* OTP Request Form */
        <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
          <FormField label="Login ID / Email" htmlFor="otp-identifier" required hint="We will send a 6-digit OTP verification code to your registered email.">
            <Input
              id="otp-identifier"
              autoComplete="username"
              autoFocus
              value={otpIdentifier}
              onChange={(e) => setOtpIdentifier(e.target.value)}
              placeholder="e.g. manager1 or you@company.com"
            />
          </FormField>
          <Button type="submit" className="w-full" loading={loading} icon={Mail}>
            Send OTP Code
          </Button>
        </form>
      ) : (
        /* OTP Verification Form */
        <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
          <Alert kind="info" icon={ShieldCheck} title="Check your inbox">
            We sent a 6-digit OTP code to <strong>{otpEmail}</strong>. Enter the code below to log in.
          </Alert>
          <FormField label="6-Digit OTP Code" htmlFor="otp-token" required>
            <Input
              id="otp-token"
              inputMode="numeric"
              autoFocus
              value={otpToken}
              onChange={(e) => setOtpToken(e.target.value)}
              placeholder="123456"
              maxLength={8}
            />
          </FormField>
          <Button type="submit" className="w-full" loading={loading} icon={LogIn}>
            Verify & Sign in
          </Button>
          <div className="flex flex-col items-center gap-2 pt-2 text-xs text-slate-500 dark:text-slate-400">
            <button type="button" onClick={handleSendOtp} className="link">
              Resend OTP Code
            </button>
            <button type="button" onClick={() => { setOtpSent(false); setOtpToken(''); }} className="hover:underline">
              Use a different Login ID / Email
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
