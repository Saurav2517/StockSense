import { supabase, unwrap } from '../lib/supabase';

export const INVALID_CREDENTIALS = 'Invalid Login ID or Password';

/**
 * Login with "Login ID / email" + password (SystemDesign.md §5).
 * Supabase Auth signs in by email, so a Login ID is resolved server-side first.
 */
export async function signIn({ identifier, password }) {
  const id = identifier.trim();
  let email = id;
  if (!id.includes('@')) {
    const { data, error } = await supabase.rpc('email_for_login_id', { p_login_id: id });
    if (error || !data) throw new Error(INVALID_CREDENTIALS);
    email = data;
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password });
  if (error) {
    if (/invalid login credentials|invalid_credentials/i.test(error.message)) throw new Error(INVALID_CREDENTIALS);
    throw error;
  }
  return data;
}

export async function isLoginIdAvailable(loginId) {
  return unwrap(supabase.rpc('login_id_available', { p_login_id: loginId.trim() }));
}

/** Sign up. Profile row is created by the database trigger from this metadata. */
export async function signUp({ loginId, email, password, fullName, role }) {
  const available = await isLoginIdAvailable(loginId);
  if (!available) throw new Error('This Login ID is already taken');
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { login_id: loginId.trim(), full_name: fullName?.trim() || null, role },
      emailRedirectTo: `${window.location.origin}/login`,
    },
  });
  if (error) throw error;
  // Supabase returns an "obfuscated" user without identities when the email already exists.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('An account with this email already exists');
  }
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Sends the password-reset email (link + 6-digit code when the template includes {{ .Token }}). */
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

/** Verifies an emailed recovery code (OTP) and opens a recovery session. */
export async function verifyRecoveryCode({ email, token }) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'recovery',
  });
  if (error) throw error;
  return data;
}

export async function updatePassword(password) {
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getProfile(userId) {
  return unwrap(supabase.from('profiles').select('*').eq('id', userId).maybeSingle());
}

export async function updateProfile(userId, { full_name }) {
  return unwrap(supabase.from('profiles').update({ full_name }).eq('id', userId).select('*').single());
}

export async function listProfiles() {
  return unwrap(supabase.from('profiles').select('id,full_name,login_id,role,email').order('full_name'));
}
