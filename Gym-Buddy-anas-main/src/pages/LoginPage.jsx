import { useContext, useRef, useState } from 'react';
import { icon } from '../icons.jsx';
import { NavigateContext } from '../context/NavigateContext.jsx';
import { Toast } from '../lib/interactions.js';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { loadUserIntoStore } from '../lib/authBootstrap.js';
import { isProbablyValidSignupEmail } from '../utils/emailValidation.js';
import { formatSupabaseAuthError } from '../utils/authErrors.js';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=1600&auto=format&fit=crop&q=80';

async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export default function LoginPage() {
  const navigateToPage = useContext(NavigateContext);
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const submitLock = useRef(false);
  /* Real accounts only. There used to be a dev-mode fallback here that called
     Store.login() when Supabase was unconfigured — it accepted ANY email with
     ANY password, checked nothing and stored nothing, which made the app look
     signed-in while no account existed. Sign-in now always goes through
     Supabase Auth (bcrypt-hashed passwords in auth.users). */
  const supabaseMode = !!(isSupabaseConfigured() && supabase);
  const emailGlowInvalid =
    supabaseMode &&
    email.trim().length >= 4 &&
    !isProbablyValidSignupEmail(email.trim());

  async function handleLogin(e) {
    e.preventDefault();
    if (submitLock.current) return;
    const form = e.target;
    const trimmed = /** @type {HTMLInputElement} */ (form.querySelector('#login-email')).value.trim();
    const password = /** @type {HTMLInputElement} */ (form.querySelector('#login-pass')).value;

    if (supabaseMode && !isProbablyValidSignupEmail(trimmed)) {
      Toast.show('Use a valid email address (example@domain.com).', 'error', 4000);
      return;
    }

    if (!supabaseMode) {
      Toast.show(
        'Accounts are not connected yet. Add VITE_SUPABASE_URL and ' +
        'VITE_SUPABASE_ANON_KEY to .env.local, then restart the dev server.',
        'error',
        8000
      );
      return;
    }

    try {
      submitLock.current = true;
      setBusy(true);
      const { error, data } = await withTimeout(
        supabase.auth.signInWithPassword({ email: trimmed, password }),
        12000,
        'Sign in'
      );
      if (error) {
        Toast.show(formatSupabaseAuthError(error), 'error', 8000);
        return;
      }
      await loadUserIntoStore(data.user);
      Toast.show('👋 Welcome back!', 'success');
      navigateToPage?.('dashboard');
    } catch {
      Toast.show('Sign in failed. Please try again.', 'error');
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }

  async function handleResendConfirmation() {
    const trimmed = email.trim();
    if (!supabaseMode || !supabase) return;
    if (!isProbablyValidSignupEmail(trimmed)) {
      Toast.show('Type the same email you used to register, then retry.', 'error', 4000);
      return;
    }

    try {
      setResendBusy(true);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: trimmed,
      });
      if (error) {
        Toast.show(formatSupabaseAuthError(error), 'error', 8000);
        return;
      }
      Toast.show('Verification email re-sent. Check Inbox, Spam, and Promotions.', 'success', 6000);
    } finally {
      setResendBusy(false);
    }
  }

  return (
    <div className="page login-v2 brand-lock">
      {/* Back button — returns to landing */}
      <button
        type="button"
        className="login-v2-back"
        onClick={() => navigateToPage?.('landing')}
        aria-label="Back to home"
      >
        {icon('back', 18)}
        <span>Back</span>
      </button>

      {/* Full-bleed hero background */}
      <div className="login-v2-hero" aria-hidden="true">
        <img src={HERO_IMAGE} alt="" loading="eager" />
        <div className="login-v2-hero-overlay" />
        <div className="login-v2-hero-glow" />
      </div>

      {/* Brand wordmark — sits over the hero on the left */}
      <div className="login-v2-brand" aria-hidden="true">
        <span className="logo-dot" /> GymBuddy
      </div>

      {/* Centered floating glass card */}
      <main className="login-v2-card animate-fade">
        <div className="login-v2-card-brand">
          <span className="logo-dot" /> GymBuddy
        </div>

        <h1 className="login-v2-title">Welcome Back</h1>
        <p className="login-v2-subtitle">Sign in to continue your training journey.</p>

        <form className="login-v2-form" onSubmit={handleLogin}>
          <div className="login-v2-field">
            <label htmlFor="login-email">Email</label>
            <input
              className="login-v2-input"
              type="email"
              id="login-email"
              name="email"
              autoComplete="email"
              placeholder="your@domain.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-invalid={emailGlowInvalid || undefined}
            />
            {emailGlowInvalid && (
              <p className="login-v2-error">Enter a valid email address.</p>
            )}
          </div>

          <div className="login-v2-field">
            <div className="login-v2-field-row">
              <label htmlFor="login-pass">Password</label>
              <button
                type="button"
                className="login-v2-link login-v2-link-sm"
                onClick={() => Toast.show('Password reset is coming soon — contact support for now.', 'info', 4000)}
              >
                Forgot password?
              </button>
            </div>
            <div className="login-v2-password-wrap">
              <input
                className="login-v2-input"
                type={showPassword ? 'text' : 'password'}
                id="login-pass"
                placeholder="••••••••"
                required
                minLength={6}
              />
              <button
                type="button"
                className="login-v2-pass-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {!supabaseMode && (
            <p className="login-v2-error">
              Accounts aren’t connected. Set VITE_SUPABASE_URL and
              VITE_SUPABASE_ANON_KEY in .env.local, then restart the dev server.
            </p>
          )}

          <button
            className="login-v2-submit"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Signing in…' : <>Sign In {icon('arrow', 18)}</>}
          </button>

          {supabaseMode && (
            <button
              type="button"
              className="login-v2-resend"
              disabled={resendBusy}
              onClick={handleResendConfirmation}
            >
              {resendBusy ? 'Resending…' : 'Resend confirmation email'}
            </button>
          )}
        </form>

        <div className="login-v2-trust">
          <span>{icon('check', 12)} Fast sign in</span>
          <span>{icon('check', 12)} Secure account</span>
          <span>{icon('check', 12)} Synced progress</span>
        </div>

        <div className="login-v2-footer">
          Don&apos;t have an account?{' '}
          <button type="button" className="login-v2-link" onClick={() => navigateToPage?.('register')}>
            Create one
          </button>
        </div>
      </main>
    </div>
  );
}
