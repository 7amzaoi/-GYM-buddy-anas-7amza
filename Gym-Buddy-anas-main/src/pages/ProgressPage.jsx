import { useEffect, useMemo, useReducer, useState } from 'react';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { renderLineChart, getWeightData, getStrengthData, calculateStrengthIndex, calculateStrengthIndexAt } from './progressCharts.js';
import { Toast } from '../lib/interactions.js';
import { initCounters } from '../lib/interactions.js';
import { logBodyMetricsRemote } from '../services/profilesApi.js';
import { refreshUserFromRemote } from '../lib/authBootstrap.js';

export default function ProgressPage() {
  const [logOpen, setLogOpen] = useState(false);
  const [, forceRender] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    Store.subscribe(() => forceRender());
  }, []);

  const progress = Store.get('progressData');
  const history = Store.get('workoutHistory') || [];
  const records = Store.get('records') || [];
  const metrics = Store.get('metricsLog') || [];
  const user = Store.get('user');
  const synced = !!(user?.source === 'supabase' && user?.id);

  const hasProfileWeight = Number.isFinite(Number(user?.weight_kg));
  const hasProfileBodyFat = Number.isFinite(Number(user?.body_fat_pct));
  const latestWeight = hasProfileWeight
    ? Number(user.weight_kg)
    : (metrics.length > 0 ? Number(metrics.at(-1).weight) : null);
  const latestBf = hasProfileBodyFat
    ? Number(user.body_fat_pct)
    : (metrics.length > 0 ? Number(metrics.at(-1).bodyFat) : null);

  const strengthIndex = useMemo(() => calculateStrengthIndex(records), [records]);
  const strengthIndexLastMonth = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return calculateStrengthIndexAt(records, cutoff);
  }, [records]);
  const strengthMonthChange = strengthIndexLastMonth > 0
    ? (((strengthIndex - strengthIndexLastMonth) / strengthIndexLastMonth) * 100)
    : null;

  const weightSeries = (metrics || [])
    .map((m) => Number(m?.weight))
    .filter((v) => Number.isFinite(v));
  if (Number.isFinite(latestWeight) && (weightSeries.length === 0 || Math.abs(weightSeries.at(-1) - latestWeight) > 0.0001)) {
    weightSeries.push(latestWeight);
  }
  const weightChange = weightSeries.length >= 2
    ? (((weightSeries.at(-1) - weightSeries.at(0)) / weightSeries.at(0)) * 100)
    : null;

  const bodyFatSeries = (metrics || [])
    .map((m) => Number(m?.bodyFat))
    .filter((v) => Number.isFinite(v));
  if (Number.isFinite(latestBf) && (bodyFatSeries.length === 0 || Math.abs(bodyFatSeries.at(-1) - latestBf) > 0.0001)) {
    bodyFatSeries.push(latestBf);
  }
  const bfChange = bodyFatSeries.length >= 2 ? (bodyFatSeries.at(-1) - bodyFatSeries.at(0)) : null;

  const weeklyCalories = (progress.calories || []).reduce((a, c) => a + (Number(c.value) || 0), 0);
  const totalVolume = Number(progress.totalVolume || 0);

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at)),
    [records]
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => initCounters());
    return () => cancelAnimationFrame(id);
  }, [latestWeight, latestBf]);

  function showLogMetrics() {
    setLogOpen(true);
  }

  async function handleLogMetrics(ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const weight = parseFloat(String(fd.get('lm-weight')));
    const bodyFat = parseFloat(String(fd.get('lm-bf'))) || 15;
    const notes = String(fd.get('lm-notes') || '');
    const entry = { date: new Date().toISOString(), weight, bodyFat, notes };

    Store.update('metricsLog', log => ([...(log || []), entry]));

    Store.update('progressData', p => {
      const nextWeight = [...(p.weight || []), { date: entry.date.split('T')[0], value: weight }];
      return {
        ...p,
        weight: nextWeight.slice(-30),
      };
    });

    Store.update('user', cur => cur ? ({
      ...cur,
      weight_kg: weight,
      body_fat_pct: bodyFat,
    }) : cur);

    if (synced && user) {
      const { error } = await logBodyMetricsRemote(user, {
        logged_at: entry.date,
        weight_kg: weight,
        body_fat_pct: bodyFat,
        notes,
      });
      if (error) {
        Toast.show('Saved locally. Cloud update will retry on next save.', 'warning', 3500);
      } else {
        Store.update('user', cur => cur ? ({
          ...cur,
          weight_kg: weight,
          body_fat_pct: bodyFat,
        }) : cur);
        void refreshUserFromRemote().catch(() => {});
      }
    }

    setLogOpen(false);
    Toast.show('Metrics logged successfully.', 'success');
  }

  const latestMetrics = metrics.at(-1) || {};
  const defaultWeightInput = hasProfileWeight ? Number(user.weight_kg) : (Number(latestMetrics.weight) || '');
  const defaultBodyFatInput = hasProfileBodyFat ? Number(user.body_fat_pct) : (Number(latestMetrics.bodyFat) || '');

  return (
    <>
      <div className="page-header animate-fade" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 900 }}>{icon('chart', 24)} Progress Analytics</h1>
          <p>Visualize your body transformation and strength gains.</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={showLogMetrics}>+ LOG METRICS</button>
      </div>

      <div className="grid grid-3 animate-slide-up delay-1" style={{ marginBottom: '28px' }}>
        <div className="progress-counter-card">
          <div className="progress-counter-header">
            <span className="progress-counter-label">Current Weight</span>
            <span className="progress-counter-icon">{icon('activity', 22)}</span>
          </div>
          {Number.isFinite(latestWeight) ? (
            <>
              <div className="progress-counter-value" data-counter={latestWeight} data-suffix=" kg">{latestWeight} kg</div>
              {weightChange !== null ? (
                <div className={`progress-counter-trend ${weightChange <= 0 ? 'trend-positive' : 'trend-negative'}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points={weightChange <= 0 ? '23 18 13.5 8.5 8.5 13.5 1 6' : '23 6 13.5 15.5 8.5 10.5 1 18'}></polyline>
                  </svg>
                  {weightChange >= 0 ? '+' : ''}{weightChange.toFixed(1)}% since first log
                </div>
              ) : (
                <div className="progress-counter-trend" style={{ color: 'var(--text-secondary)' }}>Log again to track change</div>
              )}
            </>
          ) : (
            <>
              <div className="progress-counter-value" style={{ color: 'var(--text-secondary)' }}>—</div>
              <div className="progress-counter-trend" style={{ color: 'var(--text-secondary)' }}>Log your weight to start</div>
            </>
          )}
        </div>

        <div className="progress-counter-card">
          <div className="progress-counter-header">
            <span className="progress-counter-label">Est. Body Fat</span>
            <span className="progress-counter-icon" style={{ color: '#FF4757' }}>{icon('target', 22)}</span>
          </div>
          {Number.isFinite(latestBf) ? (
            <>
              <div className="progress-counter-value" data-counter={latestBf} data-suffix="%">{latestBf}%</div>
              {bfChange !== null ? (
                <div className={`progress-counter-trend ${bfChange <= 0 ? 'trend-positive' : 'trend-negative'}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points={bfChange <= 0 ? '23 18 13.5 8.5 8.5 13.5 1 6' : '23 6 13.5 15.5 8.5 10.5 1 18'}></polyline>
                  </svg>
                  {bfChange >= 0 ? '+' : ''}{bfChange.toFixed(1)}% since first log
                </div>
              ) : (
                <div className="progress-counter-trend" style={{ color: 'var(--text-secondary)' }}>Log again to track change</div>
              )}
            </>
          ) : (
            <>
              <div className="progress-counter-value" style={{ color: 'var(--text-secondary)' }}>—</div>
              <div className="progress-counter-trend" style={{ color: 'var(--text-secondary)' }}>Log body fat to start</div>
            </>
          )}
        </div>

        <div className="progress-counter-card">
          <div className="progress-counter-header">
            <span className="progress-counter-label">Strength Index</span>
            <span className="progress-counter-icon" style={{ color: 'var(--accent)' }}>{icon('zap', 22)}</span>
          </div>
          {strengthIndex > 0 ? (
            <>
              <div className="progress-counter-value" style={{ color: 'var(--accent)' }} data-counter={strengthIndex}>{strengthIndex}</div>
              {strengthMonthChange !== null ? (
                <div className={`progress-counter-trend ${strengthMonthChange >= 0 ? 'trend-positive' : 'trend-negative'}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points={strengthMonthChange >= 0 ? '23 18 13.5 8.5 8.5 13.5 1 6' : '23 6 13.5 15.5 8.5 10.5 1 18'}></polyline>
                  </svg>
                  {strengthMonthChange >= 0 ? '+' : ''}{strengthMonthChange.toFixed(1)}% vs 30 days ago
                </div>
              ) : (
                <div className="progress-counter-trend" style={{ color: 'var(--text-secondary)' }}>Built from your PRs</div>
              )}
            </>
          ) : (
            <>
              <div className="progress-counter-value" style={{ color: 'var(--text-secondary)' }}>0</div>
              <div className="progress-counter-trend" style={{ color: 'var(--text-secondary)' }}>Log a PR to build your index</div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-4 animate-slide-up delay-1" style={{ marginBottom: '28px' }}>
        <div className="progress-counter-card progress-counter-mini">
          <div className="progress-counter-header">
            <span className="progress-counter-label">Total Workouts</span>
            <span className="progress-counter-icon-mini">{icon('dumbbell', 16)}</span>
          </div>
          <div className="progress-counter-value-mini" data-counter={progress.totalWorkouts}>{progress.totalWorkouts}</div>
          <div className="progress-counter-trend" style={{ fontSize: '.7rem', color: progress.workoutsThisWeek > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
            {progress.workoutsThisWeek > 0 ? `+${progress.workoutsThisWeek} this week` : 'No sessions this week'}
          </div>
        </div>
        <div className="progress-counter-card progress-counter-mini">
          <div className="progress-counter-header">
            <span className="progress-counter-label">Weekly Calories</span>
            <span className="progress-counter-icon-mini" style={{ color: '#FF4757' }}>{icon('fire', 16)}</span>
          </div>
          <div className="progress-counter-value-mini" data-counter={weeklyCalories} data-suffix=" cal">{weeklyCalories} cal</div>
          <div className="progress-counter-trend" style={{ fontSize: '.7rem', color: weeklyCalories > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
            {weeklyCalories > 0 ? <>{icon('fire', 12)} Last 7 days</> : 'Complete a session to log'}
          </div>
        </div>
        <div className="progress-counter-card progress-counter-mini">
          <div className="progress-counter-header">
            <span className="progress-counter-label">Current Streak</span>
            <span className="progress-counter-icon-mini" style={{ color: '#FFA502' }}>🔥</span>
          </div>
          <div className="progress-counter-value-mini" data-counter={progress.streak} data-suffix={progress.streak === 1 ? ' day' : ' days'}>{progress.streak} {progress.streak === 1 ? 'day' : 'days'}</div>
          <div className="progress-counter-trend" style={{ fontSize: '.7rem', color: progress.streak > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
            {progress.streak > 0 ? 'Keep going!' : 'Start a streak today'}
          </div>
        </div>
        <div className="progress-counter-card progress-counter-mini">
          <div className="progress-counter-header">
            <span className="progress-counter-label">Total Volume</span>
            <span className="progress-counter-icon-mini" style={{ color: 'var(--accent)' }}>{icon('chart', 16)}</span>
          </div>
          <div className="progress-counter-value-mini">{(totalVolume / 1000).toFixed(1)}<span className="progress-counter-unit"> t</span></div>
          <div className="progress-counter-trend" style={{ fontSize: '.7rem', color: totalVolume > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
            {totalVolume > 0 ? 'Lifetime lifted' : 'Log sets to track volume'}
          </div>
        </div>
      </div>

      <div className="grid grid-2 animate-slide-up delay-2" style={{ marginBottom: '20px' }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <h3 style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '.8rem', letterSpacing: '.5px', marginBottom: '12px' }}>Weight Journey</h3>
          <div style={{ maxHeight: '180px' }} dangerouslySetInnerHTML={{ __html: renderLineChart(getWeightData(metrics, progress), 'kg', '#D4FF00') }} />
        </div>
        <div className="card" style={{ padding: '18px 20px' }}>
          <h3 style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '.8rem', letterSpacing: '.5px', marginBottom: '12px' }}>Strength Progress</h3>
          <div style={{ maxHeight: '180px' }} dangerouslySetInnerHTML={{ __html: renderLineChart(getStrengthData(records), 'idx', '#2ED573') }} />
        </div>
      </div>

      <div className="grid grid-2 animate-slide-up delay-3" style={{ marginBottom: '20px' }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <h3 style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '.8rem', letterSpacing: '.5px', marginBottom: '14px' }}>Body Composition</h3>
          {Number.isFinite(latestWeight) && Number.isFinite(latestBf) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{ position: 'relative', width: '100px', height: '100px', flexShrink: 0 }}>
                <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--accent)" strokeWidth="10" strokeDasharray={`${((100 - latestBf) / 100) * 314} 314`} strokeLinecap="round" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#FF4757" strokeWidth="10" strokeDasharray={`${(latestBf / 100) * 314} 314`} strokeDashoffset={`${-((100 - latestBf) / 100) * 314}`} strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{latestBf}%</div>
                  <div style={{ fontSize: '.6rem', color: 'var(--text-secondary)' }}>Body Fat</div>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: '4px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent)' }}></span>
                      Lean Mass
                    </span>
                    <span style={{ fontWeight: 700 }}>{(latestWeight * (1 - latestBf / 100)).toFixed(1)} kg</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${100 - latestBf}%`, background: 'var(--accent)', borderRadius: '3px', transition: 'width .6s ease' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: '4px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF4757' }}></span>
                      Fat Mass
                    </span>
                    <span style={{ fontWeight: 700 }}>{(latestWeight * latestBf / 100).toFixed(1)} kg</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${latestBf}%`, background: '#FF4757', borderRadius: '3px', transition: 'width .6s ease' }} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>
              Log your weight and body fat % to see your composition.
            </p>
          )}
        </div>
        <div className="card" style={{ padding: '18px 20px' }}>
          <h3 style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '.8rem', letterSpacing: '.5px', marginBottom: '14px' }}>{icon('trophy', 18)} Personal Records</h3>
          {sortedRecords.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>
              Complete a workout or add a record to see your top lifts here.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sortedRecords.slice(0, 5).map((r) => {
                const reps = Number(r.secondary_value) || 0;
                const sets = Number(r.tertiary_value) || 0;
                const label = r.metric_type === 'weight'
                  ? `${Number(r.value) || 0} kg${reps ? ` × ${reps} reps` : ''}${sets ? ` • ${sets} sets` : ''}`
                  : r.metric_type === 'cardio_sets'
                    ? `${Number(r.value) || 0} sets${reps ? ` • ${reps} ${r.secondary_unit || 'min'}` : ''}`
                    : `${Number(r.value) || 0} ${r.unit || ''}`;
                return (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 600, fontSize: '.9rem' }}>{r.exercise_name}</span>
                    <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '1rem' }}>{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-2 animate-slide-up delay-4" style={{ marginBottom: '20px' }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <h3 style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '.8rem', letterSpacing: '.5px', marginBottom: '14px' }}>{icon('fire', 18)} Weekly Calories</h3>
          <div className="chart-bar-group" style={{ height: '130px' }}>
            {(() => {
              const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              const today = new Date();
              const days = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(today);
                d.setHours(0, 0, 0, 0);
                d.setDate(d.getDate() - (6 - i));
                return d;
              });
              const lookup = new Map((progress.calories || []).map(c => [c.date, Number(c.value) || 0]));
              const series = days.map(d => ({
                date: d,
                value: lookup.get(d.toISOString().slice(0, 10)) || 0
              }));
              const max = Math.max(...series.map(s => s.value), 1);
              return series.map((s, i) => {
                const h = Math.max((s.value / max) * 150, 4);
                return (
                  <div key={i} className="chart-bar" style={{ height: `${h}px` }} title={`${s.value} cal`}>
                    <span className="chart-bar-label">{dow[s.date.getDay()]}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
        <div className="card" style={{ padding: '18px 20px' }}>
          <h3 style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '.8rem', letterSpacing: '.5px', marginBottom: '14px' }}>{icon('activity', 18)} Workout Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="summary-row"><span>Total Workouts</span><span style={{ fontWeight: 800, color: 'var(--accent)' }}>{progress.totalWorkouts}</span></div>
            <div className="summary-row"><span>This Week</span><span style={{ fontWeight: 800 }}>{progress.workoutsThisWeek}</span></div>
            <div className="summary-row"><span>Current Streak</span><span style={{ fontWeight: 800, color: 'var(--accent)' }}>{progress.streak} {progress.streak === 1 ? 'day' : 'days'} {progress.streak > 0 ? '🔥' : ''}</span></div>
            <div className="summary-row"><span>Total Volume</span><span style={{ fontWeight: 800 }}>{(totalVolume / 1000).toFixed(1)}t</span></div>
            <div className="summary-row"><span>Weekly Calories</span><span style={{ fontWeight: 800, color: 'var(--accent)' }}>{weeklyCalories} cal</span></div>
          </div>
        </div>
      </div>

      <div className="card animate-slide-up delay-5">
        <h3 style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '.9rem', letterSpacing: '.5px', marginBottom: '16px' }}>{icon('calendar', 18)} Workout History</h3>
        {history.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>Complete your first workout to see history here!</p>
        ) : (
          history.slice(0, 10).map(w => (
            <div key={w.id || w.planName + w.date} className="exercise-item" style={{ marginBottom: '8px' }}>
              <div className="stat-icon">{icon('dumbbell', 18)}</div>
              <div className="exercise-info">
                <h4>{w.planName}</h4>
                <p>{new Date(w.date).toLocaleDateString()} · {w.duration || '?'} min · {w.calories} cal</p>
              </div>
              <span className="badge badge-success">{w.completed}/{w.exercises}</span>
            </div>
          ))
        )}
      </div>

      <div id="log-metrics-modal" className={logOpen ? '' : 'hidden'}>
        {logOpen ? (
          <div className="modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setLogOpen(false); }}>
            <div className="modal">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>+ Log Metrics</h2>
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => setLogOpen(false)}>{icon('x', 20)}</button>
              </div>
              <form onSubmit={handleLogMetrics} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="input-group"><label htmlFor="lm-weight">Weight (kg)</label><input className="input" type="number" step="0.1" name="lm-weight" id="lm-weight" defaultValue={defaultWeightInput} required /></div>
                <div className="input-group"><label htmlFor="lm-bf">Body Fat %</label><input className="input" type="number" step="0.1" name="lm-bf" id="lm-bf" defaultValue={defaultBodyFatInput} min={3} max={60} /></div>
                <div className="input-group"><label htmlFor="lm-notes">Notes</label><input className="input" name="lm-notes" id="lm-notes" placeholder="e.g. Feeling strong today!" /></div>
                <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>{icon('check', 16)} Save</button>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
