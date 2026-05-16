import { useContext, useState, useEffect } from 'react';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { NavigateContext } from '../context/NavigateContext.jsx';
import { Toast } from '../lib/interactions.js';
import { saveBodyMetricsRemote, upsertProfile } from '../services/profilesApi.js';
import { refreshUserFromRemote } from '../lib/authBootstrap.js';

const goalIcons = { 'muscle gain': '💪', 'fat loss': '🔥', 'strength': '🏋️', 'cardio': '🏃' };

export default function ProfilePage() {
  const navigateToPage = useContext(NavigateContext);
  const user = Store.get('user');
  const progress = Store.get('progressData');
  const records = Store.get('records') || [];

  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [age, setAge] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHeight(user?.height_cm != null && user.height_cm !== '' ? String(user.height_cm) : '');
    setWeight(user?.weight_kg != null && user.weight_kg !== '' ? String(user.weight_kg) : '');
    setAge(user?.age != null && user.age !== '' ? String(user.age) : '');
    setBodyFat(user?.body_fat_pct != null && user.body_fat_pct !== '' ? String(user.body_fat_pct) : '');
  }, [user]);

  if (!user) return null;

  const daysSinceJoin = Math.max(1, Math.floor((Date.now() - new Date(user.joinDate).getTime()) / 86400000));
  const synced = !!(user.source === 'supabase' && user.id);

  const badges = [
    { icon: '🏆', name: 'First Workout', unlocked: progress.totalWorkouts >= 1 },
    { icon: '🔥', name: '3-Day Streak', unlocked: progress.streak >= 3 },
    { icon: '⚡', name: '10 Workouts', unlocked: progress.totalWorkouts >= 10 },
    { icon: '💎', name: '25 Workouts', unlocked: progress.totalWorkouts >= 25 },
    { icon: '👑', name: '50 Workouts', unlocked: progress.totalWorkouts >= 50 },
    { icon: '🌟', name: '7-Day Streak', unlocked: progress.streak >= 7 },
  ];
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

  async function updateGoal(goal) {
    Store.update('user', cur => ({ ...cur, goal }));
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
      Store.update('user', cur => ({
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
        Store.update('progressData', p => {
          const nextWeight = [...(p.weight || []), { date: nowIso.slice(0, 10), value: parsedWeight }];
          return { ...p, weight: nextWeight.slice(-30) };
        });
      }
      if (parsedWeight != null && Number.isFinite(parsedWeight)) {
        Store.update('metricsLog', log => [
          ...(log || []),
          { date: nowIso, weight: parsedWeight, bodyFat: Number.isFinite(parsedBodyFat) ? parsedBodyFat : null, notes: '' }
        ]);
      }

      if (!synced) {
        Toast.show('Body metrics saved.', 'success', 3200);
        return;
      }
      const merged = Store.get('user');
      const metricsPatch = {
        height_cm: height,
        weight_kg: weight,
        age,
        body_fat_pct: bodyFat,
      };
      const { error: saveErr } = await saveBodyMetricsRemote(merged, metricsPatch);
      if (saveErr) {
        console.error('[profile.saveBodyMetrics]', saveErr);
        const msg = String(saveErr?.message || saveErr || '').toLowerCase();
        const authIssue =
          msg.includes('jwt') ||
          msg.includes('token') ||
          msg.includes('session') ||
          msg.includes('not authenticated') ||
          msg.includes('auth');
        if (authIssue) {
          Toast.show('Your login expired. Please sign in again.', 'error', 4000);
        } else {
          Toast.show('Could not save body metrics. Please try again.', 'error', 5500);
        }
      } else {
        void refreshUserFromRemote().catch(() => {});
        Toast.show('Body metrics saved.', 'success');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header animate-fade">
        <h1>{icon('user', 24)} Profile</h1>
        <p>Manage your account and fitness goals</p>
      </div>

      <div className="card animate-slide-up delay-1" style={{ marginBottom: '24px' }}>
        <div className="profile-header">
          <div className="profile-avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div className="profile-info">
            <h2>{user.name}</h2>
            <p>{user.email}</p>
            <span className="badge badge-accent" style={{ marginTop: '8px' }}>
              {goalIcons[user.goal] || '🎯'}{' '}{user.goal?.charAt(0).toUpperCase() + user.goal?.slice(1)}
            </span>
          </div>
        </div>
      </div>

      <div className="card animate-slide-up delay-2" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>📐 Body metrics</h3>
        <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Fill in your details and press save.
        </p>
        <form style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '480px' }} onSubmit={saveBodyMetrics}>
          <div className="grid grid-2">
            <div className="input-group">
              <label>Height (cm)</label>
              <input className="input" type="number" step="0.1" placeholder="175" value={height} onChange={e => setHeight(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Weight (kg)</label>
              <input className="input" type="number" step="0.1" placeholder="78" value={weight} onChange={e => setWeight(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-2">
            <div className="input-group">
              <label>Age</label>
              <input className="input" type="number" placeholder="26" value={age} onChange={e => setAge(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Body fat %</label>
              <input className="input" type="number" step="0.1" placeholder="15" value={bodyFat} onChange={e => setBodyFat(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy} style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
            {busy ? 'Saving…' : '💾 Save body metrics'}
          </button>
        </form>
      </div>

      <div className="grid grid-2 animate-slide-up delay-2" style={{ marginBottom: '24px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>{icon('chart', 18)} Your Stats</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Member Since</span><span style={{ fontWeight: 600 }}>{new Date(user.joinDate).toLocaleDateString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Total Workouts</span><span style={{ fontWeight: 600, color: 'var(--accent)' }}>{progress.totalWorkouts}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Current Streak</span><span style={{ fontWeight: 600 }}>{progress.streak} days</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Days Active</span><span style={{ fontWeight: 600 }}>{daysSinceJoin}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Avg Workouts/Week</span><span style={{ fontWeight: 600 }}>{(progress.totalWorkouts / Math.max(1, daysSinceJoin / 7)).toFixed(1)}</span></div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>{icon('target', 18)} Fitness Goal</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(['muscle gain', 'fat loss', 'strength', 'cardio']).map(g => (
              <button key={g} type="button" className={`btn ${user.goal === g ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => updateGoal(g)} style={{ width: '100%' }}>
                {goalIcons[g]} {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card animate-slide-up delay-3" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ margin: 0 }}>{icon('trophy', 18)} Personal Records</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigateToPage?.('records')}>
            Open Records
          </button>
        </div>
        {topRecords.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>
            No records yet. Complete a session or add one from the Records page.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topRecords.map((r) => (
              <div key={r.id} className="exercise-item">
                <div className="stat-icon">{icon('trophy', 14)}</div>
                <div className="exercise-info">
                  <h4>{r.exercise_name}</h4>
                  <p>{new Date(r.recorded_at).toLocaleDateString()}</p>
                </div>
                <span className="badge badge-accent">
                  {formatRecordBadge(r)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card animate-slide-up delay-4" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>{icon('trophy', 18)} Achievements</h3>
        <div className="grid grid-3">
          {badges.map(b => (
            <div
              key={b.name}
              style={{
                textAlign: 'center',
                padding: '20px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${b.unlocked ? 'var(--accent)' : 'var(--border)'}`,
                opacity: b.unlocked ? 1 : 0.4
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{b.icon}</div>
              <div style={{ fontSize: '.85rem', fontWeight: 600 }}>{b.name}</div>
              <div style={{ fontSize: '.75rem', color: b.unlocked ? 'var(--accent)' : 'var(--text-secondary)', marginTop: '4px' }}>{b.unlocked ? '✓ Unlocked' : 'Locked'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card animate-slide-up delay-5">
        <h3 style={{ marginBottom: '16px', color: 'var(--danger)' }}>{icon('logout', 18)} Account</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { if (window.confirm('Clear all data?')) { localStorage.clear(); window.location.reload(); } }}>
            {icon('trash', 14)} Reset All Data
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => { Store.logout(); navigateToPage?.('landing'); }}>
            {icon('logout', 14)} Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
