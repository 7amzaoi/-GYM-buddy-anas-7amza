import { useContext, useRef, useState } from 'react';
import { icon } from '../icons.jsx';
import { Store } from '../store.js';
import { NavigateContext } from '../context/NavigateContext.jsx';
import { Toast, launchConfetti } from '../lib/interactions.js';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { loadUserIntoStore } from '../lib/authBootstrap.js';
import { isProbablyValidSignupEmail } from '../utils/emailValidation.js';
import { formatSupabaseAuthError } from '../utils/authErrors.js';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=1600&auto=format&fit=crop&q=80';

const GOAL_OPTIONS = [
  { id: 'muscle gain', label: 'Muscle Gain', emoji: '💪' },
  { id: 'fat loss',    label: 'Fat Loss',    emoji: '🔥' },
  { id: 'strength',    label: 'Strength',    emoji: '🏋️' },
  { id: 'cardio',      label: 'Cardio',      emoji: '🏃' },
];

export default function RegisterPage() {
  const navigateToPage = useContext(NavigateContext);
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [goal, setGoal] = useState('muscle gain');
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);
  const supabaseMode = !!(isSupabaseConfigured() && supabase);
  const allowLocalAuthFallback = import.meta.env.DEV === true;
  const emailGlowInvalid =
    supabaseMode &&
    email.trim().length >= 4 &&
    !isProbablyValidSignupEmail(email.trim());

  async function handleRegister(e) {
    e.preventDefault();
    if (submitLock.current) return;
    const form = e.target;
    const name = /** @type {HTMLInputElement} */ (form.querySelector('#reg-name')).value.trim();
    const trimmedEmail = /** @type {HTMLInputElement} */ (form.querySelector('#reg-email')).value.trim();
    const password = /** @type {HTMLInputElement} */ (form.querySelector('#reg-pass')).value;

    if (supabaseMode && !isProbablyValidSignupEmail(trimmedEmail)) {
      Toast.show('Use a valid email address (example@domain.com).', 'error', 4000);
      return;
    }

    if (!supabaseMode && !allowLocalAuthFallback) {
      Toast.show('Sign up is unavailable right now. Please contact support.', 'error', 5000);
      return;
    }

    try {
      if (isSupabaseConfigured() && supabase) {
        submitLock.current = true;
        setBusy(true);
        const { error, data } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { data: { name, display_name: name, goal } }
        });
        if (error) {
          Toast.show(formatSupabaseAuthError(error), 'error', 8000);
          return;
        }
        if (data.session?.user) {
          await loadUserIntoStore(data.session.user);
          Toast.show("🎉 Welcome to GymBuddy, " + name + '! Your account is ready.', 'success', 4000);
          launchConfetti(2000);
          navigateToPage?.('dashboard');
          return;
        }
        Toast.show('✉️ Check your email and confirm your account, then sign in.', 'info', 5000);
        navigateToPage?.('login');
        return;
      }

      Store.register(name, trimmedEmail, goal);
      Toast.show("🎉 Welcome to GymBuddy, " + name + "! Let's crush some goals!", 'success', 4000);
      launchConfetti(2000);
      navigateToPage?.('dashboard');
    } catch {
      Toast.show('Registration failed', 'error');
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="page login-v2 register-v2">
      <div className="login-v2-top-bar" aria-hidden="true" />

      <button
        type="button"
        className="login-v2-back"
        onClick={() => navigateToPage?.('landing')}
        aria-label="Back to home"
      >
        {icon('back', 18)}
        <span>Back</span>
      </button>

      <div className="login-v2-hero" aria-hidden="true">
        <img src={HERO_IMAGE} alt="" loading="eager" />
        <div className="login-v2-hero-overlay" />
        <div className="login-v2-hero-glow" />
      </div>

      <div className="login-v2-brand" aria-hidden="true">
        <span className="logo-dot" /> GymBuddy
      </div>

      <main className="login-v2-card animate-fade">
        <div className="login-v2-card-brand">
          <span className="logo-dot" /> GymBuddy
        </div>

        <h1 className="login-v2-title">Create Account</h1>
        <p className="login-v2-subtitle">Start your transformation today.</p>

        <form className="login-v2-form" onSubmit={handleRegister}>
          <div className="login-v2-field">
            <label htmlFor="reg-name">Full Name</label>
            <input
              className="login-v2-input"
              type="text"
              id="reg-name"
              autoComplete="name"
              placeholder="John Doe"
              required
            />
          </div>

          <div className="login-v2-field">
            <label htmlFor="reg-email">Email</label>
            <input
              className="login-v2-input"
              type="email"
              id="reg-email"
              name="email"
              autoComplete="email"
              placeholder="your@domain.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-invalid={emailGlowInvalid || undefined}
            />
            {emailGlowInvalid && (
              <p className="login-v2-error">
                Enter a valid email (real inbox — you&apos;ll verify it to use the account).
              </p>
            )}
          </div>

          <div className="login-v2-field">
            <label htmlFor="reg-pass">Password</label>
            <div className="login-v2-password-wrap">
              <input
                className="login-v2-input"
                type={showPassword ? 'text' : 'password'}
                id="reg-pass"
                placeholder={isSupabaseConfigured() ? 'Min 6 characters' : 'Any (offline mode)'}
                required
                minLength={isSupabaseConfigured() ? 6 : 1}
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

          <div className="login-v2-field">
            <label>Fitness Goal</label>
            <div className="login-v2-goal-row" role="radiogroup" aria-label="Fitness goal">
              {GOAL_OPTIONS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={goal === g.id}
                  className={`login-v2-goal-pill ${goal === g.id ? 'is-active' : ''}`}
                  onClick={() => setGoal(g.id)}
                >
                  <span className="login-v2-goal-emoji" aria-hidden="true">{g.emoji}</span>
                  <span>{g.label}</span>
                </button>
              ))}
            </div>
          </div>

          {!supabaseMode && !allowLocalAuthFallback && (
            <p className="login-v2-error">
              Account services are not configured on this deployment.
            </p>
          )}

          <button
            className="login-v2-submit"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Please wait…' : <>Create Account {icon('zap', 18)}</>}
          </button>
        </form>

        <div className="login-v2-trust">
          <span>{icon('check', 12)} Goal-based onboarding</span>
          <span>{icon('check', 12)} Personal records</span>
          <span>{icon('check', 12)} Smart planner</span>
        </div>

        <div className="login-v2-footer">
          Already have an account?{' '}
          <button type="button" className="login-v2-link" onClick={() => navigateToPage?.('login')}>
            Sign in
          </button>
        </div>
      </main>

      <div className="login-v2-bottom-bar" aria-hidden="true" />
    </div>
  );
}
