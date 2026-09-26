import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { FormField, Input } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { useAuth } from '../../hooks/useAuth';
import { updatePassword, verifyRecoveryCode } from '../../services/auth.service';
import { getErrorMessage } from '../../utils/errors';
import { validateEmail, validatePassword } from '../../utils/validation';

/**
 * Two supported paths (SystemDesign.md §5 — password reset):
 *  1. The user clicked the emailed link → Supabase opened a recovery session.
 *  2. The user types the emailed one-time code → verifyOtp(type: 'recovery').
 * Either way the new password is saved with auth.updateUser.
 */
export function ResetPasswordPage() {
  const { session, recovery, clearRecovery, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(session && recovery ? 'password' : 'code');
  const [form, setForm] = useState({ email: location.state?.email || '', token: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // If the recovery session arrives after mount (link flow), move to the password step.
  if (session && recovery && step === 'code') setStep('password');

  async function backToSignIn() {
    clearRecovery();
    if (session) await signOut();
    navigate('/login', { replace: true });
  }

  async function verifyCode(e) {
    e.preventDefault();
    const v = validateEmail(form.email);
    if (v) return setError(v);
    if (!/^\d{6,8}$/.test(form.token.trim())) return setError('Enter the 6-digit code from the email');
    setError('');
    setLoading(true);
    try {
      await verifyRecoveryCode({ email: form.email, token: form.token });
      setStep('password');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    const v = validatePassword(form.password);
    if (v) return setError(v);
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setError('');
    setLoading(true);
    try {
      await updatePassword(form.password);
      clearRecovery();
      await signOut();
      navigate('/login', { replace: true, state: { notice: 'Password updated. Please sign in with your new password.' } });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={step === 'code' ? 'Open your reset email' : 'Choose a new password'}
      subtitle={
        step === 'code'
          ? 'Click the link in the reset email — it opens this page with a secure session. If your email shows a 6-digit code instead, enter it below.'
          : 'Must be longer than 8 characters with upper, lower and special characters.'
      }
      footer={
        <button type="button" className="link" onClick={backToSignIn}>
          Back to sign in
        </button>
      }
    >
      {error && <Alert kind="error" className="mb-4">{error}</Alert>}
      {step === 'code' ? (
        <form onSubmit={verifyCode} className="space-y-4" noValidate>
          <FormField label="Email" htmlFor="email" required>
            <Input id="email" type="email" value={form.email} onChange={set('email')} autoComplete="email" />
          </FormField>
          <FormField label="One-time code" htmlFor="token" required hint="Only present when the Supabase 'Reset password' email template includes {{ .Token }}; otherwise use the link.">
            <Input id="token" inputMode="numeric" value={form.token} onChange={set('token')} placeholder="123456" />
          </FormField>
          <Button type="submit" className="w-full" loading={loading}>
            Verify code
          </Button>
        </form>
      ) : (
        <form onSubmit={savePassword} className="space-y-4" noValidate>
          <FormField label="New password" htmlFor="password" required>
            <Input id="password" type="password" autoFocus value={form.password} onChange={set('password')} autoComplete="new-password" />
          </FormField>
          <FormField label="Re-enter password" htmlFor="confirm" required>
            <Input id="confirm" type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
          </FormField>
          <Button type="submit" className="w-full" loading={loading}>
            Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
