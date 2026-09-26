import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, UserPlus, X } from 'lucide-react';
import { AuthLayout, AuthLink } from './AuthLayout';
import { FormField, Input, PasswordInput, Select } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { useAuth } from '../../hooks/useAuth';
import { ConfirmEmailPanel } from './ConfirmEmailPanel';
import { getErrorMessage } from '../../utils/errors';
import { passwordChecks, validateEmail, validateLoginId, validatePassword } from '../../utils/validation';
import { ROLE_META } from '../../utils/status';
import { classNames } from '../../utils/format';

export function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ loginId: '', email: '', fullName: '', password: '', confirm: '', role: 'INVENTORY_MANAGER' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState(''); // account created, confirmation email sent
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function validate() {
    const next = {
      loginId: validateLoginId(form.loginId),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      confirm: form.confirm !== form.password ? 'Passwords do not match' : null,
    };
    setErrors(next);
    return !Object.values(next).some(Boolean);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await signUp(form);
      if (data.session) {
        // "Confirm email" is OFF in this project → signed in immediately
        navigate('/dashboard', { replace: true });
      } else {
        // Supabase default ("Confirm email" ON): the link in the email activates the account
        setPendingEmail(form.email.trim().toLowerCase());
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const checks = passwordChecks(form.password);

  if (pendingEmail) {
    return (
      <AuthLayout
        title="Almost there"
        subtitle="Your account was created."
        footer={
          <>
            Already confirmed? <AuthLink to="/login">Sign in</AuthLink>
          </>
        }
      >
        <ConfirmEmailPanel email={pendingEmail} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up a Login ID for quick sign-in."
      footer={
        <>
          Already registered? <AuthLink to="/login">Sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Login ID" htmlFor="loginId" required error={errors.loginId} hint="6–12 characters, unique">
            <Input id="loginId" value={form.loginId} onChange={set('loginId')} invalid={Boolean(errors.loginId)} autoComplete="username" />
          </FormField>
          <FormField label="Full name" htmlFor="fullName">
            <Input id="fullName" value={form.fullName} onChange={set('fullName')} autoComplete="name" />
          </FormField>
        </div>
        <FormField label="Email" htmlFor="email" required error={errors.email}>
          <Input id="email" type="email" value={form.email} onChange={set('email')} invalid={Boolean(errors.email)} autoComplete="email" />
        </FormField>
        <FormField label="Role" htmlFor="role" required hint="Inventory Managers manage products, warehouses and locations.">
          <Select id="role" value={form.role} onChange={set('role')}>
            {Object.entries(ROLE_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Password" htmlFor="password" required error={errors.password}>
            <PasswordInput id="password" value={form.password} onChange={set('password')} invalid={Boolean(errors.password)} autoComplete="new-password" />
          </FormField>
          <FormField label="Re-enter password" htmlFor="confirm" required error={errors.confirm}>
            <PasswordInput id="confirm" value={form.confirm} onChange={set('confirm')} invalid={Boolean(errors.confirm)} autoComplete="new-password" />
          </FormField>
        </div>
        <ul className="grid grid-cols-2 gap-1 text-xs">
          {checks.map((c) => (
            <li key={c.id} className={classNames('flex items-center gap-1.5', c.ok ? 'text-emerald-700' : 'text-slate-500')}>
              {c.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />} {c.label}
            </li>
          ))}
        </ul>
        <Button type="submit" className="w-full" loading={loading} icon={UserPlus}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
