import { useEffect, useMemo, useReducer, useState, useRef } from 'react';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { renderLineChart, getWeightData, getStrengthData, calculateStrengthIndex, calculateStrengthIndexAt } from './progressCharts.js';
import { Toast } from '../lib/interactions.js';
import { initCounters } from '../lib/interactions.js';
import { logBodyMetricsRemote } from '../services/profilesApi.js';
import { refreshUserFromRemote } from '../lib/authBootstrap.js';
import { revealOnScroll } from '../lib/motion.js';
import { getExerciseById } from '../data.js';

/** Group raw muscle names into 6 major bands for the volume chart. */
const MUSCLE_BANDS = [
  { id: 'chest', label: 'Chest', match: /chest/i, color: '#ff4757' },
  { id: 'back', label: 'Back', match: /back|lat/i, color: '#58a6ff' },
  { id: 'shoulders', label: 'Shoulders', match: /shoulder|delt/i, color: '#ff9f43' },
  { id: 'arms', label: 'Arms', match: /biceps|triceps|forearm/i, color: '#dc269f' },
  { id: 'legs', label: 'Legs', match: /quad|hamstr|glute|legs|calf|calves/i, color: '#2ed573' },
  { id: 'core', label: 'Core', match: /core|abs/i, color: '#a78bfa' },
];

/** Sum total volume per muscle band over the last N days. */
function computeMuscleVolume(history, days = 7) {
  const cutoff = Date.now() - days * 86400000;
  const totals = Object.fromEntries(MUSCLE_BANDS.map((b) => [b.id, 0]));
  for (const h of history) {
    if (!h.date || Date.parse(h.date) < cutoff) continue;
    for (const log of (h.exerciseLog || [])) {
      const ex = getExerciseById(log.id);
      if (!ex || !ex.muscles || !log.volume) continue;
      for (const band of MUSCLE_BANDS) {
        if (band.match.test(ex.muscles)) totals[band.id] += log.volume;
      }
    }
  }
  return totals;
}

/** Build a 16-week calendar grid (oldest left → newest right). */
function buildHeatmapColumns(history, weeks = 16) {
  const dayMap = new Map();
  let maxVol = 0;
  for (const h of history) {
    if (!h.date) continue;
    const d = new Date(h.date);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    const cur = dayMap.get(key) || { volume: 0, count: 0 };
    cur.volume += Number(h.volume || 0);
    cur.count += 1;
    dayMap.set(key, cur);
    if (cur.volume > maxVol) maxVol = cur.volume;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Current week's Saturday — newest column ends here.
  const thisSat = new Date(today);
  thisSat.setDate(today.getDate() + (6 - today.getDay()));
  const columns = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(thisSat);
    weekStart.setDate(thisSat.getDate() - w * 7 - 6);
    const week = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + d);
      const future = day > today;
      const key = day.toISOString().slice(0, 10);
      const data = dayMap.get(key) || { volume: 0, count: 0 };
      let intensity = 0;
      if (!future && data.count > 0) {
        if (maxVol === 0 || data.volume === 0) intensity = 1;
        else if (data.volume < maxVol * 0.34) intensity = 2;
        else if (data.volume < maxVol * 0.67) intensity = 3;
        else intensity = 4;
      }
      week.push({ date: day, key, volume: data.volume, count: data.count, future, intensity });
    }
    columns.push(week);
  }
  return columns;
}

/** Small up/down trend pill — green when the change is "good". */
function Trend({ change, goodWhenNegative = false, suffix = '%', tail = '' }) {
  if (change === null || change === undefined) {
    return <div className="prog-trend prog-trend-muted">{tail}</div>;
  }
  const positive = goodWhenNegative ? change <= 0 : change >= 0;
  return (
    <div className={`prog-trend ${positive ? 'is-good' : 'is-bad'}`}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points={change <= 0 ? '23 18 13.5 8.5 8.5 13.5 1 6' : '23 6 13.5 15.5 8.5 10.5 1 18'} />
      </svg>
      {change >= 0 ? '+' : ''}{change.toFixed(1)}{suffix} {tail}
    </div>
  );
}

export default function ProgressPage() {
  const rootRef = useRef(null);
  const [logOpen, setLogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [, forceRender] = useReducer((x) => x + 1, 0);

  useEffect(() => Store.subscribe(() => forceRender()), []);

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

  useEffect(() => {
    const cleanup = revealOnScroll(rootRef.current, '[data-reveal]', { y: 24, stagger: 0.05 });
    return cleanup;
  }, []);

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

    Store.update('metricsLog', (log) => ([...(log || []), entry]));
    Store.update('progressData', (p) => {
      const nextWeight = [...(p.weight || []), { date: entry.date.split('T')[0], value: weight }];
      return { ...p, weight: nextWeight.slice(-30) };
    });
    Store.update('user', (cur) => (cur ? { ...cur, weight_kg: weight, body_fat_pct: bodyFat } : cur));

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
        Store.update('user', (cur) => (cur ? { ...cur, weight_kg: weight, body_fat_pct: bodyFat } : cur));
        void refreshUserFromRemote().catch(() => {});
      }
    }

    setLogOpen(false);
    Toast.show('Metrics logged successfully.', 'success');
  }

  const latestMetrics = metrics.at(-1) || {};
  const defaultWeightInput = hasProfileWeight ? Number(user.weight_kg) : (Number(latestMetrics.weight) || '');
  const defaultBodyFatInput = hasProfileBodyFat ? Number(user.body_fat_pct) : (Number(latestMetrics.bodyFat) || '');

  // Weekly calorie bars
  const calBars = useMemo(() => {
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    const lookup = new Map((progress.calories || []).map((c) => [c.date, Number(c.value) || 0]));
    const series = days.map((d) => ({ day: dow[d.getDay()], value: lookup.get(d.toISOString().slice(0, 10)) || 0 }));
    const max = Math.max(...series.map((s) => s.value), 1);
    return series.map((s) => ({ ...s, pct: Math.max((s.value / max) * 100, 4) }));
  }, [progress.calories]);

  return (
    <div className="prog" ref={rootRef}>
      {/* ===== Header ===== */}
      <header className="prog-header" data-reveal>
        <div>
          <span className="gx-eyebrow">{icon('chart', 13)} Analytics</span>
          <h1 className="prog-h1">Progress Analytics</h1>
          <p className="gx-subtitle">Visualize your transformation and strength gains.</p>
        </div>
        <button type="button" className="gx-btn gx-btn-primary" onClick={showLogMetrics}>
          {icon('plus', 15)} Log Metrics
        </button>
      </header>

      {/* ===== 3 hero metrics ===== */}
      <div className="prog-hero-grid">
        <div className="gx-card" data-reveal>
          <div className="prog-metric-head">
            <span className="prog-metric-label">Current Weight</span>
            <span className="prog-metric-icon">{icon('activity', 20)}</span>
          </div>
          {Number.isFinite(latestWeight) ? (
            <>
              <div className="prog-metric-val" data-counter={latestWeight} data-suffix=" kg">{latestWeight} kg</div>
              <Trend change={weightChange} goodWhenNegative tail="since first log" />
            </>
          ) : (
            <>
              <div className="prog-metric-val is-empty">—</div>
              <div className="prog-trend prog-trend-muted">Log your weight to start</div>
            </>
          )}
        </div>

        <div className="gx-card" data-reveal>
          <div className="prog-metric-head">
            <span className="prog-metric-label">Est. Body Fat</span>
            <span className="prog-metric-icon" style={{ color: '#FF4757' }}>{icon('target', 20)}</span>
          </div>
          {Number.isFinite(latestBf) ? (
            <>
              <div className="prog-metric-val" data-counter={latestBf} data-suffix="%">{latestBf}%</div>
              <Trend change={bfChange} goodWhenNegative suffix="%" tail="since first log" />
            </>
          ) : (
            <>
              <div className="prog-metric-val is-empty">—</div>
              <div className="prog-trend prog-trend-muted">Log body fat to start</div>
            </>
          )}
        </div>

        <div className="gx-card" data-reveal>
          <div className="prog-metric-head">
            <span className="prog-metric-label">Strength Index</span>
            <span className="prog-metric-icon" style={{ color: 'var(--accent)' }}>{icon('zap', 20)}</span>
          </div>
          {strengthIndex > 0 ? (
            <>
              <div className="prog-metric-val prog-accent" data-counter={strengthIndex}>{strengthIndex}</div>
              <Trend change={strengthMonthChange} tail="vs 30 days ago" />
            </>
          ) : (
            <>
              <div className="prog-metric-val is-empty">0</div>
              <div className="prog-trend prog-trend-muted">Log a PR to build your index</div>
            </>
          )}
        </div>
      </div>

      {/* ===== 4 mini stats ===== */}
      <div className="prog-mini-grid">
        {[
          { label: 'Total Workouts', iconKey: 'dumbbell', value: progress.totalWorkouts, counter: progress.totalWorkouts, suffix: '',
            note: progress.workoutsThisWeek > 0 ? `+${progress.workoutsThisWeek} this week` : 'No sessions this week', good: progress.workoutsThisWeek > 0 },
          { label: 'Weekly Calories', iconKey: 'fire', value: `${weeklyCalories} cal`, counter: weeklyCalories, suffix: ' cal',
            note: weeklyCalories > 0 ? 'Last 7 days' : 'Complete a session to log', good: weeklyCalories > 0 },
          { label: 'Current Streak', iconKey: 'fire', value: `${progress.streak} ${progress.streak === 1 ? 'day' : 'days'}`, counter: progress.streak, suffix: progress.streak === 1 ? ' day' : ' days',
            note: progress.streak > 0 ? 'Keep going!' : 'Start a streak today', good: progress.streak > 0 },
          { label: 'Total Volume', iconKey: 'chart', value: `${(totalVolume / 1000).toFixed(1)} t`, counter: null, suffix: '',
            note: totalVolume > 0 ? 'Lifetime lifted' : 'Log sets to track volume', good: totalVolume > 0 },
        ].map((m) => (
          <div key={m.label} className="gx-card prog-mini" data-reveal>
            <div className="prog-mini-head">
              <span>{m.label}</span>
              <span className="prog-mini-icon">{icon(m.iconKey, 14)}</span>
            </div>
            {m.counter !== null ? (
              <div className="prog-mini-val" data-counter={m.counter} data-suffix={m.suffix}>{m.value}</div>
            ) : (
              <div className="prog-mini-val">{m.value}</div>
            )}
            <div className={`prog-mini-note ${m.good ? 'is-good' : ''}`}>{m.note}</div>
          </div>
        ))}
      </div>

      {/* ===== Charts row ===== */}
      <div className="prog-grid-2">
        <div className="gx-card" data-reveal>
          <span className="gx-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>{icon('activity', 13)} Weight Journey</span>
          <div className="prog-chart" dangerouslySetInnerHTML={{ __html: renderLineChart(getWeightData(metrics, progress), 'kg', 'var(--accent)') }} />
        </div>
        <div className="gx-card" data-reveal>
          <span className="gx-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>{icon('zap', 13)} Strength Progress</span>
          <div className="prog-chart" dangerouslySetInnerHTML={{ __html: renderLineChart(getStrengthData(records), 'idx', '#2ED573') }} />
        </div>
      </div>

      {/* ===== Calendar heatmap + Muscle volume ===== */}
      <div className="prog-grid-2">
        {(() => {
          const heatmap = buildHeatmapColumns(history, 16);
          const totalSessions = history.length;
          const monthLabels = [];
          let lastMonth = -1;
          heatmap.forEach((week, idx) => {
            const wkMonth = week[0].date.getMonth();
            if (wkMonth !== lastMonth) {
              monthLabels.push({ col: idx, label: week[0].date.toLocaleString(undefined, { month: 'short' }) });
              lastMonth = wkMonth;
            }
          });
          return (
            <div className="gx-card prog-heatmap-card" data-reveal>
              <div className="prog-heatmap-head">
                <span className="gx-eyebrow">{icon('calendar', 13)} Training Days</span>
                <span className="prog-heatmap-tally">{totalSessions} session{totalSessions === 1 ? '' : 's'} · last 16 weeks</span>
              </div>
              <div className="prog-heatmap-wrap">
                <div className="prog-heatmap-months">
                  {monthLabels.map((m, i) => (
                    <span key={i} style={{ gridColumn: m.col + 1 }}>{m.label}</span>
                  ))}
                </div>
                <div className="prog-heatmap-body">
                  <div className="prog-heatmap-rows" aria-hidden>
                    <span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /><span />
                  </div>
                  <div className="prog-heatmap-grid" role="img" aria-label="Calendar heatmap of workout days">
                    {heatmap.map((week, wi) => (
                      <div key={wi} className="prog-heatmap-col">
                        {week.map((cell) => (
                          <span
                            key={cell.key}
                            className={`prog-heatmap-cell level-${cell.intensity} ${cell.future ? 'is-future' : ''}`}
                            title={
                              cell.future
                                ? cell.date.toLocaleDateString()
                                : `${cell.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${
                                    cell.count
                                      ? `${cell.count} workout${cell.count > 1 ? 's' : ''} · ${Math.round(cell.volume).toLocaleString()} kg`
                                      : 'Rest day'
                                  }`
                            }
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="prog-heatmap-legend">
                  <span>Less</span>
                  <span className="prog-heatmap-cell level-0" />
                  <span className="prog-heatmap-cell level-1" />
                  <span className="prog-heatmap-cell level-2" />
                  <span className="prog-heatmap-cell level-3" />
                  <span className="prog-heatmap-cell level-4" />
                  <span>More</span>
                </div>
              </div>
            </div>
          );
        })()}

        {(() => {
          const totals = computeMuscleVolume(history, 7);
          const maxVol = Math.max(...Object.values(totals), 1);
          const hasAny = Object.values(totals).some((v) => v > 0);
          return (
            <div className="gx-card prog-muscles-card" data-reveal>
              <div className="prog-heatmap-head">
                <span className="gx-eyebrow">{icon('zap', 13)} Volume by Muscle</span>
                <span className="prog-heatmap-tally">Last 7 days</span>
              </div>
              {hasAny ? (
                <div className="prog-muscles-list">
                  {MUSCLE_BANDS.map((band) => {
                    const v = totals[band.id];
                    const pct = (v / maxVol) * 100;
                    return (
                      <div key={band.id} className="prog-muscle-row">
                        <span className="prog-muscle-name">{band.label}</span>
                        <div className="prog-muscle-bar-track">
                          <div
                            className="prog-muscle-bar-fill"
                            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${band.color}, ${band.color}cc)` }}
                          />
                        </div>
                        <span className="prog-muscle-val">{Math.round(v).toLocaleString()} kg</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="prog-muscles-empty">
                  <span className="dash-empty-icon">{icon('activity', 22)}</span>
                  <p>Log a workout to see your muscle distribution.</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ===== Body comp + PRs ===== */}
      <div className="prog-grid-2">
        <div className="gx-card" data-reveal>
          <span className="gx-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>{icon('user', 13)} Body Composition</span>
          {Number.isFinite(latestWeight) && Number.isFinite(latestBf) ? (
            <div className="prog-comp">
              <div className="prog-donut">
                <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--glass-border)" strokeWidth="11" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--accent)" strokeWidth="11"
                          strokeDasharray={`${((100 - latestBf) / 100) * 314} 314`} strokeLinecap="round" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#FF4757" strokeWidth="11"
                          strokeDasharray={`${(latestBf / 100) * 314} 314`}
                          strokeDashoffset={`${-((100 - latestBf) / 100) * 314}`} strokeLinecap="round" />
                </svg>
                <div className="prog-donut-center">
                  <div className="prog-donut-num">{latestBf}%</div>
                  <div className="prog-donut-cap">Body Fat</div>
                </div>
              </div>
              <div className="prog-comp-bars">
                <div className="prog-comp-bar">
                  <div className="prog-comp-bar-head">
                    <span><span className="prog-dot" style={{ background: 'var(--accent)' }} /> Lean Mass</span>
                    <strong>{(latestWeight * (1 - latestBf / 100)).toFixed(1)} kg</strong>
                  </div>
                  <div className="prog-bar-track">
                    <div className="prog-bar-fill" style={{ width: `${100 - latestBf}%`, background: 'var(--accent)' }} />
                  </div>
                </div>
                <div className="prog-comp-bar">
                  <div className="prog-comp-bar-head">
                    <span><span className="prog-dot" style={{ background: '#FF4757' }} /> Fat Mass</span>
                    <strong>{(latestWeight * latestBf / 100).toFixed(1)} kg</strong>
                  </div>
                  <div className="prog-bar-track">
                    <div className="prog-bar-fill" style={{ width: `${latestBf}%`, background: '#FF4757' }} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="dash-empty">
              <span className="dash-empty-icon">{icon('user', 26)}</span>
              <p>Log your weight and body fat % to see your composition.</p>
            </div>
          )}
        </div>

        <div className="gx-card" data-reveal>
          <span className="gx-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>{icon('trophy', 13)} Personal Records</span>
          {sortedRecords.length === 0 ? (
            <div className="dash-empty">
              <span className="dash-empty-icon">{icon('trophy', 26)}</span>
              <p>Complete a workout or add a record to see your top lifts.</p>
            </div>
          ) : (
            <div className="dash-list">
              {sortedRecords.slice(0, 5).map((r) => {
                const reps = Number(r.secondary_value) || 0;
                const sets = Number(r.tertiary_value) || 0;
                const label = r.metric_type === 'weight'
                  ? `${Number(r.value) || 0} kg${reps ? ` × ${reps} reps` : ''}${sets ? ` • ${sets} sets` : ''}`
                  : r.metric_type === 'cardio_sets'
                    ? `${Number(r.value) || 0} sets${reps ? ` • ${reps} ${r.secondary_unit || 'min'}` : ''}`
                    : `${Number(r.value) || 0} ${r.unit || ''}`;
                return (
                  <div key={r.id} className="dash-pr-row">
                    <span>{r.exercise_name}</span>
                    <span className="dash-pr-val">{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===== Weekly calories + summary ===== */}
      <div className="prog-grid-2">
        <div className="gx-card" data-reveal>
          <span className="gx-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>{icon('fire', 13)} Weekly Calories</span>
          <div className="prog-cal-bars">
            {calBars.map((b, i) => (
              <div key={i} className="prog-cal-col" title={`${b.value} cal`}>
                <div className="prog-cal-bar" style={{ height: `${b.pct}%` }} />
                <span className="prog-cal-day">{b.day}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="gx-card" data-reveal>
          <span className="gx-eyebrow" style={{ marginBottom: 'var(--space-4)' }}>{icon('activity', 13)} Workout Summary</span>
          <div className="prog-summary">
            <div className="prog-sum-row"><span>Total Workouts</span><strong className="prog-accent">{progress.totalWorkouts}</strong></div>
            <div className="prog-sum-row"><span>This Week</span><strong>{progress.workoutsThisWeek}</strong></div>
            <div className="prog-sum-row"><span>Current Streak</span><strong className="prog-accent">{progress.streak} {progress.streak === 1 ? 'day' : 'days'}</strong></div>
            <div className="prog-sum-row"><span>Total Volume</span><strong>{(totalVolume / 1000).toFixed(1)} t</strong></div>
            <div className="prog-sum-row"><span>Weekly Calories</span><strong className="prog-accent">{weeklyCalories} cal</strong></div>
          </div>
        </div>
      </div>

      {/* ===== History ===== */}
      <div className="gx-card hist-card" data-reveal>
        <button
          type="button"
          className="hist-toggle"
          onClick={() => setHistoryOpen((v) => !v)}
          aria-expanded={historyOpen}
          aria-controls="hist-panel"
        >
          <span className="hist-toggle-label">
            <span className="gx-eyebrow hist-toggle-eyebrow">
              {icon('calendar', 13)} Workout History
            </span>
            <span className="hist-toggle-meta">
              {history.length === 0
                ? 'No workouts yet'
                : `${history.length} session${history.length === 1 ? '' : 's'} logged`}
            </span>
          </span>
          <span className={`hist-toggle-chev ${historyOpen ? 'is-open' : ''}`} aria-hidden="true">
            {icon('arrow', 14)}
          </span>
        </button>

        {historyOpen && (
          <div id="hist-panel" className="hist-panel">
        {history.length === 0 ? (
          <div className="dash-empty">
            <span className="dash-empty-icon">{icon('calendar', 26)}</span>
            <p>Complete your first workout to see history here.</p>
          </div>
        ) : (
          <div className="hist-list">
            {history.slice(0, 10).map((w) => {
              const key = w.id || w.planName + w.date;
              const isOpen = expandedHistoryId === key;
              const name = (w.planName && w.planName.trim()) || 'Freestyle Workout';
              const date = new Date(w.date);
              const completion = w.exercises > 0 ? Math.round((w.completed / w.exercises) * 100) : 0;
              const isFreestyle = !w.planId;
              return (
                <div key={key} className={`hist-item ${isOpen ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="hist-row"
                    onClick={() => setExpandedHistoryId(isOpen ? null : key)}
                    aria-expanded={isOpen}
                  >
                    <span className="hist-row-icon">{icon(isFreestyle ? 'activity' : 'dumbbell', 16)}</span>
                    <div className="hist-row-info">
                      <h4>{name}</h4>
                      <p>
                        {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}
                        {w.duration ? `${w.duration} min` : 'No duration'}
                        {' · '}
                        {Math.round(w.calories || 0)} cal
                      </p>
                    </div>
                    <span className="gx-badge is-accent hist-row-badge">{w.completed}/{w.exercises}</span>
                    <span className={`hist-row-chev ${isOpen ? 'is-open' : ''}`} aria-hidden="true">
                      {icon('arrow', 14)}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="hist-detail">
                      <div className="hist-detail-grid">
                        <div className="hist-detail-stat">
                          <span className="hist-detail-stat-lbl">Date</span>
                          <span className="hist-detail-stat-val">
                            {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          <span className="hist-detail-stat-sub">
                            {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="hist-detail-stat">
                          <span className="hist-detail-stat-lbl">Duration</span>
                          <span className="hist-detail-stat-val">
                            {w.duration ? `${w.duration}` : '—'}
                            {w.duration ? <small> min</small> : null}
                          </span>
                        </div>
                        <div className="hist-detail-stat">
                          <span className="hist-detail-stat-lbl">Volume</span>
                          <span className="hist-detail-stat-val">
                            {Number(w.volume || 0).toLocaleString()}
                            <small> kg</small>
                          </span>
                        </div>
                        <div className="hist-detail-stat">
                          <span className="hist-detail-stat-lbl">Calories</span>
                          <span className="hist-detail-stat-val">
                            {Math.round(w.calories || 0)}
                            <small> cal</small>
                          </span>
                        </div>
                      </div>

                      <div className="hist-detail-bar">
                        <div className="hist-detail-bar-track">
                          <div className="hist-detail-bar-fill" style={{ width: `${completion}%` }} />
                        </div>
                        <div className="hist-detail-bar-meta">
                          <span>{w.completed} of {w.exercises} exercises completed</span>
                          <span className="hist-detail-bar-pct">{completion}%</span>
                        </div>
                      </div>

                      <div className="hist-detail-footer">
                        <span className={`hist-detail-tag ${isFreestyle ? 'is-freestyle' : 'is-plan'}`}>
                          {isFreestyle ? (
                            <>{icon('activity', 12)} Freestyle</>
                          ) : (
                            <>{icon('dumbbell', 12)} From plan</>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
          </div>
        )}
      </div>

      {/* ===== Log Metrics modal ===== */}
      {logOpen && (
        <div
          className="gx-modal-overlay"
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) setLogOpen(false); }}
        >
          <div className="gx-modal" role="dialog" aria-modal="true" aria-label="Log metrics">
            <div className="gx-modal-head">
              <h2>Log Metrics</h2>
              <button type="button" className="gx-modal-close" onClick={() => setLogOpen(false)} aria-label="Close">
                {icon('x', 18)}
              </button>
            </div>
            <form className="gx-modal-form" onSubmit={handleLogMetrics}>
              <label className="prof-field">
                <span>Weight (kg)</span>
                <input type="number" step="0.1" name="lm-weight" defaultValue={defaultWeightInput} required />
              </label>
              <label className="prof-field">
                <span>Body Fat %</span>
                <input type="number" step="0.1" name="lm-bf" defaultValue={defaultBodyFatInput} min={3} max={60} />
              </label>
              <label className="prof-field">
                <span>Notes</span>
                <input name="lm-notes" placeholder="e.g. Feeling strong today!" />
              </label>
              <button type="submit" className="gx-btn gx-btn-primary" style={{ width: '100%' }}>
                {icon('check', 15)} Save
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
