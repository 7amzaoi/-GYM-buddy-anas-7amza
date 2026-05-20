import { useContext, useState, useEffect, useRef } from 'react';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { NavigateContext } from '../context/NavigateContext.jsx';
import { Toast } from '../lib/interactions.js';
import { saveBodyMetricsRemote, upsertProfile } from '../services/profilesApi.js';
import { refreshUserFromRemote } from '../lib/authBootstrap.js';
import { revealOnScroll } from '../lib/motion.js';
import { ACCENTS, applyAccent, getStoredAccentId } from '../lib/personalization.js';

const GOALS = [
  { id: 'muscle gain', label: 'Muscle Gain', iconKey: 'dumbbell' },
  { id: 'fat loss',    label: 'Fat Loss',    iconKey: 'fire' },
  { id: 'strength',    label: 'Strength',    iconKey: 'trophy' },
  { id: 'cardio',      label: 'Cardio',      iconKey: 'activity' },
];

export default function ProfilePage() {
  const navigateToPage = useContext(NavigateContext);
  const rootRef = useRef(null);
  const user = Store.get('user');
  const progress = Store.get('progressData');
  const records = Store.get('records') || [];

  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [age, setAge] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [busy, setBusy] = useState(false);
  const [accentId, setAccentId] = useState(getStoredAccentId());

  useEffect(() => {
    setHeight(user?.height_cm != null && user.height_cm !== '' ? String(user.height_cm) : '');
    setWeight(user?.weight_kg != null && user.weight_kg !== '' ? String(user.weight_kg) : '');
    setAge(user?.age != null && user.age !== '' ? String(user.age) : '');
    setBodyFat(user?.body_fat_pct != null && user.body_fat_pct !== '' ? String(user.body_fat_pct) : '');
  }, [user]);

  useEffect(() => {
    const cleanup = revealOnScroll(rootRef.current, '[data-reveal]', { y: 26, stagger: 0.05 });
    return cleanup;
  }, []);

  if (!user) return null;

  const daysSinceJoin = Math.max(1, Math.floor((Date.now() - new Date(user.joinDate).getTime()) / 86400000));
  const synced = !!(user.source === 'supabase' && user.id);

  const badges = [
    { iconKey: 'check',    name: 'First Workout', unlocked: progress.totalWorkouts >= 1 },
    { iconKey: 'fire',     name: '3-Day Streak',  unlocked: progress.streak >= 3 },
    { iconKey: 'dumbbell', name: '10 Workouts',   unlocked: progress.totalWorkouts >= 10 },
    { iconKey: 'zap',      name: '25 Workouts',   unlocked: progress.totalWorkouts >= 25 },
    { iconKey: 'trophy',   name: '50 Workouts',   unlocked: progress.totalWorkouts >= 50 },
    { iconKey: 'star',     name: '7-Day Streak',  unlocked: progress.streak >= 7 },
  ];
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  const topRecords = [...records]
    .sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at))
    .slice(0, 3);
  const formatRecordBadge = (r) => {
    if (r.category === 'cardio') {
      const dist = r.tertiary_value ? ` • ${r.tertiary_value} ${r.tertiary_unit || 'km'}` : '';
      return `${r.value} sets • ${r.secondary_value || 0} ${r.secondary_unit || 'min'}${dist}`;
    }
    if (r.metric_type === 'weight') {
      return `${r.value} kg${r.secondary_value ? ` x ${r.secondary_value} reps` : ''}`;
    }
    return `${r.value} ${r.unit || ''}`.trim();
  };

  const initials = (user.name || 'G')
    .trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');

  function pickAccent(id) {
    setAccentId(id);
    applyAccent(id);
    Toast.show('Accent updated.', 'success', 2200);
  }

  async function updateGoal(goal) {
    Store.update('user', (cur) => ({ ...cur, goal }));
    if (!synced) {
      Toast.show('Goal saved.', 'success');
      return;
    }
    const uNow = Store.get('user');
    const { error } = await upsertProfile(uNow, { goal });
    if (error) Toast.show('Could not save your goal. Please try again.', 'error');
    else {
      await refreshUserFromRemote();
      Toast.show('Goal updated successfully.', 'success');
    }
  }

  async function saveBodyMetrics(ev) {
    ev.preventDefault();
    setBusy(true);
    try {
      Store.update('user', (cur) => ({
        ...cur,
        height_cm: height === '' ? null : Number(height),
        weight_kg: weight === '' ? null : Number(weight),
        age: age === '' ? null : Math.round(Number(age)),
        body_fat_pct: bodyFat === '' ? null : Number(bodyFat),
      }));

      const nowIso = new Date().toISOString();
      const parsedWeight = weight === '' ? null : Number(weight);
      const parsedBodyFat = bodyFat === '' ? null : Number(bodyFat);
      if (parsedWeight != null && Number.isFinite(parsedWeight)) {
        Store.update('progressData', (p) => {
          const nextWeight = [...(p.weight || []), { date: nowIso.slice(0, 10), value: parsedWeight }];
          return { ...p, weight: nextWeight.slice(-30) };
        });
        Store.update('metricsLog', (log) => [
          ...(log || []),
          { date: nowIso, weight: parsedWeight, bodyFat: Number.isFinite(parsedBodyFat) ? parsedBodyFat : null, notes: '' },
        ]);
      }

      if (!synced) {
        Toast.show('Body metrics saved.', 'success', 3200);
        return;
      }
      const merged = Store.get('user');
      const metricsPatch = { height_cm: height, weight_kg: weight, age, body_fat_pct: bodyFat };
      const { error: saveErr } = await saveBodyMetricsRemote(merged, metricsPatch);
      if (saveErr) {
        console.error('[profile.saveBodyMetrics]', saveErr);
        const msg = String(saveErr?.message || saveErr || '').toLowerCase();
        const authIssue =
          msg.includes('jwt') || msg.includes('token') ||
          msg.includes('session') || msg.includes('not authenticated') || msg.includes('auth');
        Toast.show(
          authIssue ? 'Your login expired. Please sign in again.' : 'Could not save body metrics. Please try again.',
          'error',
          authIssue ? 4000 : 5500
        );
      } else {
        void refreshUserFromRemote().catch(() => {});
        Toast.show('Body metrics saved.', 'success');
      }
    } finally {
      setBusy(false);
    }
  }

  const avgPerWeek = (progress.totalWorkouts / Math.max(1, daysSinceJoin / 7)).toFixed(1);

  return (
    <div className="prof" ref={rootRef}>
      {/* ===== Identity hero ===== */}
      <header className="prof-hero" data-reveal>
        <div className="prof-hero-glow" aria-hidden="true" />
        <div className="prof-avatar">{initials}</div>
        <div className="prof-identity">
          <h1 className="prof-name">{user.name}</h1>
          <p className="prof-email">{user.email}</p>
          <div className="prof-tags">
            <span className="gx-badge is-accent">
              {icon(GOALS.find((g) => g.id === user.goal)?.iconKey || 'target', 12)}
              {user.goal ? user.goal.charAt(0).toUpperCase() + user.goal.slice(1) : 'No goal'}
            </span>
            {synced && <span className="gx-badge">{icon('check', 11)} Synced</span>}
          </div>
        </div>
        <div className="prof-hero-stats">
          <div className="prof-mini-stat">
            <span className="prof-mini-num">{progress.totalWorkouts}</span>
            <span className="prof-mini-label">Workouts</span>
          </div>
          <div className="prof-mini-stat">
            <span className="prof-mini-num">{progress.streak}</span>
            <span className="prof-mini-label">Streak</span>
          </div>
          <div className="prof-mini-stat">
            <span className="prof-mini-num">{daysSinceJoin}</span>
            <span className="prof-mini-label">Days</span>
          </div>
        </div>
      </header>

      {/* ===== Appearance (personalization) ===== */}
      <div className="gx-card" data-reveal>
        <div className="gx-section-head" style={{ marginBottom: 'var(--space-4)' }}>
          <span className="gx-eyebrow">{icon('zap', 13)} Appearance</span>
          <h3 className="gx-title" style={{ fontSize: 'var(--text-lg)' }}>Accent color</h3>
          <p className="gx-subtitle">Recolors the whole app instantly. Saved to this device.</p>
        </div>
        <div className="prof-accents">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`prof-accent ${accentId === a.id ? 'is-selected' : ''}`}
              onClick={() => pickAccent(a.id)}
              aria-label={a.label}
            >
              <span className="prof-accent-dot" style={{ background: a.hex }} />
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ===== Body metrics ===== */}
      <div className="gx-card" data-reveal>
        <div className="gx-section-head" style={{ marginBottom: 'var(--space-4)' }}>
          <span className="gx-eyebrow">{icon('activity', 13)} Body Metrics</span>
          <h3 className="gx-title" style={{ fontSize: 'var(--text-lg)' }}>Your measurements</h3>
          <p className="gx-subtitle">Fill in your details and press save.</p>
        </div>
        <form className="prof-form" onSubmit={saveBodyMetrics}>
          <div className="prof-form-grid">
            {[
              { label: 'Height (cm)', value: height, set: setHeight, ph: '175', step: '0.1' },
              { label: 'Weight (kg)', value: weight, set: setWeight, ph: '78', step: '0.1' },
              { label: 'Age', value: age, set: setAge, ph: '26', step: '1' },
              { label: 'Body fat %', value: bodyFat, set: setBodyFat, ph: '15', step: '0.1' },
            ].map((f) => (
              <label key={f.label} className="prof-field">
                <span>{f.label}</span>
                <input
                  type="number"
                  step={f.step}
                  placeholder={f.ph}
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                />
              </label>
            ))}
          </div>
          <button type="submit" className="gx-btn gx-btn-primary" disabled={busy}>
            {busy ? 'Saving…' : <>{icon('check', 15)} Save metrics</>}
          </button>
        </form>
      </div>

      {/* ===== Stats + Goal ===== */}
      <div className="prof-grid-2">
        <div className="gx-card" data-reveal>
          <div className="gx-section-head" style={{ marginBottom: 'var(--space-4)' }}>
            <span className="gx-eyebrow">{icon('chart', 13)} Lifetime Stats</span>
          </div>
          <div className="prof-stat-list">
            <div className="prof-stat-row"><span>Member since</span><strong>{new Date(user.joinDate).toLocaleDateString()}</strong></div>
            <div className="prof-stat-row"><span>Total workouts</span><strong className="prof-accent-text">{progress.totalWorkouts}</strong></div>
            <div className="prof-stat-row"><span>Current streak</span><strong>{progress.streak} days</strong></div>
            <div className="prof-stat-row"><span>Days active</span><strong>{daysSinceJoin}</strong></div>
            <div className="prof-stat-row"><span>Avg workouts / week</span><strong>{avgPerWeek}</strong></div>
          </div>
        </div>

        <div className="gx-card" data-reveal>
          <div className="gx-section-head" style={{ marginBottom: 'var(--space-4)' }}>
            <span className="gx-eyebrow">{icon('target', 13)} Fitness Goal</span>
          </div>
          <div className="prof-goal-list">
            {GOALS.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`prof-goal ${user.goal === g.id ? 'is-active' : ''}`}
                onClick={() => updateGoal(g.id)}
              >
                <span className="prof-goal-icon">{icon(g.iconKey, 18)}</span>
                <span>{g.label}</span>
                {user.goal === g.id && <span className="prof-goal-check">{icon('check', 14)}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Personal records ===== */}
      <div className="gx-card" data-reveal>
        <div className="dash-card-head">
          <span className="gx-eyebrow">{icon('trophy', 13)} Recent Records</span>
          <button type="button" className="dash-link" onClick={() => navigateToPage?.('records')}>
            Open records {icon('arrow', 12)}
          </button>
        </div>
        {topRecords.length === 0 ? (
          <div className="dash-empty">
            <span className="dash-empty-icon">{icon('trophy', 26)}</span>
            <p>No records yet. Complete a session or add one from Records.</p>
          </div>
        ) : (
          <div className="dash-list">
            {topRecords.map((r) => (
              <div key={r.id} className="dash-workout-row">
                <span className="dash-workout-icon">{icon('trophy', 16)}</span>
                <div className="dash-workout-info">
                  <h4>{r.exercise_name}</h4>
                  <p>{new Date(r.recorded_at).toLocaleDateString()}</p>
                </div>
                <span className="gx-badge is-accent">{formatRecordBadge(r)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Achievements ===== */}
      <div className="gx-card" data-reveal>
        <div className="dash-card-head">
          <span className="gx-eyebrow">{icon('trophy', 13)} Achievements</span>
          <span className="gx-badge is-accent">{unlockedCount}/{badges.length} unlocked</span>
        </div>
        <div className="prof-badges">
          {badges.map((b) => (
            <div key={b.name} className={`prof-badge ${b.unlocked ? 'is-unlocked' : ''}`}>
              <span className="prof-badge-icon">{icon(b.iconKey, 22)}</span>
              <span className="prof-badge-name">{b.name}</span>
              <span className="prof-badge-state">
                {b.unlocked ? <>{icon('check', 11)} Unlocked</> : 'Locked'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Account ===== */}
      <div className="gx-card prof-account" data-reveal>
        <div className="gx-section-head" style={{ marginBottom: 'var(--space-4)' }}>
          <span className="gx-eyebrow" style={{ color: 'var(--danger)' }}>{icon('logout', 13)} Account</span>
        </div>
        <div className="prof-account-actions">
          <button
            type="button"
            className="gx-btn gx-btn-glass"
            onClick={() => {
              if (window.confirm('Clear all local data? This cannot be undone.')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
          >
            {icon('trash', 14)} Reset all data
          </button>
          <button
            type="button"
            className="gx-btn prof-signout"
            onClick={() => { Store.logout(); navigateToPage?.('landing'); }}
          >
            {icon('logout', 14)} Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
