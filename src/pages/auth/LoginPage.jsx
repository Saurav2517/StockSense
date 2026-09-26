import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { AuthLayout, AuthLink } from './AuthLayout';
import { FormField, Input } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/errors';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const notice = location.state?.notice;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.identifier.trim() || !form.password) {
      setError('Enter your Login ID / email and password');
      return;
    }
    setLoading(true);
    try {
      await signIn(form);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
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
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {notice && <Alert kind="success">{notice}</Alert>}
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
