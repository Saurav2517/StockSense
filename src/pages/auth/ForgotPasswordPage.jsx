import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { AuthLayout, AuthLink } from './AuthLayout';
import { FormField, Input } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { requestPasswordReset } from '../../services/auth.service';
import { getErrorMessage } from '../../utils/errors';
import { validateEmail } from '../../utils/validation';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const v = validateEmail(email);
    if (v) return setError(v);
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a reset link and a one-time code."
      footer={
        <>
          Remembered it? <AuthLink to="/login">Back to sign in</AuthLink>
        </>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <Alert kind="success" icon={MailCheck} title="Check your inbox">
            If an account exists for <strong>{email}</strong>, a password reset email is on its way. Open the link, or enter the code from the email on the next screen.
          </Alert>
          <Button className="w-full" onClick={() => navigate('/reset-password', { state: { email } })}>
            I have a code
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Alert kind="error">{error}</Alert>}
          <FormField label="Email" htmlFor="email" required>
            <Input id="email" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </FormField>
          <Button type="submit" className="w-full" loading={loading}>
            Send reset email
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
