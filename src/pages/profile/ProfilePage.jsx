import { useState } from 'react';
import { KeyRound, Save, Wifi, WifiOff } from 'lucide-react';
import { PageHeader, DetailList } from '../../components/ui/Misc';
import { Button } from '../../components/ui/Button';
import { FormField, Input, PasswordInput } from '../../components/ui/FormField';
import { Alert } from '../../components/ui/Feedback';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import * as authService from '../../services/auth.service';
import { getErrorMessage } from '../../utils/errors';
import { passwordChecks, validatePassword } from '../../utils/validation';
import { ROLE_META } from '../../utils/status';
import { formatDateTime } from '../../utils/format';

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const online = useOnlineStatus();
  const { canInstall, install, installed } = useInstallPrompt();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ password: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  async function saveName(e) {
    e.preventDefault();
    setSavingName(true);
    try {
      await authService.updateProfile(user.id, { full_name: fullName.trim() || null });
      await refreshProfile();
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Could not update profile', getErrorMessage(err));
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    const err = validatePassword(pw.password);
    if (err) return setPwError(err);
    if (pw.password !== pw.confirm) return setPwError('Passwords do not match');
    setPwError('');
    setSavingPw(true);
    try {
      await authService.updatePassword(pw.password);
      setPw({ password: '', confirm: '' });
      toast.success('Password changed');
    } catch (e2) {
      setPwError(getErrorMessage(e2));
    } finally {
      setSavingPw(false);
    }
  }

  const checks = passwordChecks(pw.password);
  const role = { tone: 'brand', ...(ROLE_META[profile?.role] || { label: profile?.role || 'User' }) };

  return (
    <div>
      <PageHeader title="My profile" subtitle="Account details and application preferences." />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card space-y-5 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-lg font-semibold text-white">
              {(profile?.full_name || profile?.login_id || '?').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">{profile?.full_name || profile?.login_id}</p>
              <Badge tone={role.tone}>{role.label}</Badge>
            </div>
          </div>
          <DetailList
            columns={1}
            items={[
              { label: 'Login ID', value: profile?.login_id },
              { label: 'Email', value: profile?.email || user?.email },
              { label: 'Member since', value: formatDateTime(profile?.created_at) },
            ]}
          />
          <form onSubmit={saveName} className="space-y-3">
            <FormField label="Full name" htmlFor="pf-name">
              <Input id="pf-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
            </FormField>
            <Button type="submit" icon={Save} loading={savingName} disabled={fullName === (profile?.full_name || '')}>
              Save
            </Button>
          </form>
        </div>

        <div className="space-y-5">
          <div className="card space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <KeyRound className="h-4 w-4" /> Change password
            </h2>
            <form onSubmit={savePassword} className="space-y-3" noValidate>
              {pwError && <Alert kind="error">{pwError}</Alert>}
              <FormField label="New password" htmlFor="pf-pw">
                <PasswordInput id="pf-pw" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
              </FormField>
              <ul className="grid grid-cols-2 gap-1 text-xs">
                {checks.map((c) => (
                  <li key={c.label} className={c.ok ? 'text-emerald-700' : 'text-slate-500'}>
                    {c.ok ? '✓' : '○'} {c.label}
                  </li>
                ))}
              </ul>
              <FormField label="Confirm password" htmlFor="pf-pw2">
                <PasswordInput id="pf-pw2" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
              </FormField>
              <Button type="submit" variant="secondary" loading={savingPw} disabled={!pw.password}>
                Update password
              </Button>
            </form>
          </div>

          <div className="card space-y-3 p-5">
            <h2 className="text-sm font-semibold text-slate-900">App</h2>
            <p className="flex items-center gap-2 text-sm text-slate-600">
              {online ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-red-600" />}
              {online ? 'Online — changes sync immediately.' : 'Offline — inventory actions need a connection.'}
            </p>
            {installed ? (
              <p className="text-sm text-slate-600">StockSense is installed on this device.</p>
            ) : canInstall ? (
              <Button variant="secondary" onClick={install}>
                Install StockSense app
              </Button>
            ) : (
              <p className="text-xs text-slate-500">To install, use your browser's "Add to Home Screen" / "Install app" option.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
