/** Turns Supabase Auth errors into something users can act on */
export function formatSupabaseAuthError(err) {
  if (!err) return 'Something went wrong';
  const raw = err.message || String(err);
  const msg = raw.toLowerCase();
  const code = String(err.code || err.status || '').toLowerCase();

  if (
    msg.includes('rate limit') ||
    msg.includes('email rate') ||
    (msg.includes('too many') && msg.includes('email')) ||
    code === 'over_email_send_rate_limit' ||
    code === 'email_send_rate_limit'
  ) {
    return 'Too many email requests right now. Please wait a bit and try again.';
  }

  if (msg.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }

  if (msg.includes('email not confirmed') || msg.includes('email not verified')) {
    return 'Please confirm your email first, then sign in.';
  }

  return 'Something went wrong. Please try again.';
}
