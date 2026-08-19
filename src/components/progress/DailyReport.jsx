import { useMemo, useState } from 'react';
import { Store } from '../../store.js';
import { icon } from '../../icons.jsx';

/**
 * DAILY REPORT — the "how am I doing" summary at the top of Progress.
 *
 * Every figure is derived from data the app already records: workoutHistory,
 * progressData.weeklyPerformance and the logged weight series. The reference
 * design showed blood pressure and heart rate; those have no home in the data
 * model and are deliberately NOT faked — the metric tiles show the real
 * measures this app actually captures instead.
 *
 * Health Grade is an honest composite of three things the app can observe:
 *   consistency  (sessions this week vs the user's own weekly goal)  — 50%
 *   streak       (current streak, saturating at 7 days)              — 25%
 *   workload     (this week's volume vs the previous week)           — 25%
 * It is presented as a grade out of 100 with the inputs spelled out beneath, so
 * it never reads as a mystery number.
 */

const RANGES = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

function compact(n) {
  const v = Math.round(Number(n) || 0);
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(v);
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function DailyReport() {
  const [range, setRange] = useState('week');

  const rawProgress = Store.get('progressData');
  const rawHistory = Store.get('workoutHistory');
  const rawGoal = Store.get('weeklyGoal');

  const model = useMemo(() => {
    // Read inside the memo: the `|| {}` fallbacks would otherwise be fresh
    // objects on every render and defeat memoisation entirely.
    const progress = rawProgress || {};
    const history = rawHistory || [];
    const weeklyGoal = Number(rawGoal) || 5;
    const perf = progress.weeklyPerformance || {};
    const volSeries = perf.strengthVolume || [0, 0, 0, 0, 0, 0, 0];
    const calSeries = perf.caloriesBurned || [0, 0, 0, 0, 0, 0, 0];
    const durSeries = perf.duration || [0, 0, 0, 0, 0, 0, 0];

    const todayStart = startOfDay(new Date()).getTime();
    const dayMs = 86400000;

    const inWindow = (h, from, to) => {
      const t = startOfDay(new Date(h.date)).getTime();
      return t >= from && t <= to;
    };
    const thisWeek = history.filter((h) => inWindow(h, todayStart - 6 * dayMs, todayStart));
    const prevWeek = history.filter((h) => inWindow(h, todayStart - 13 * dayMs, todayStart - 7 * dayMs));
    const sum = (list, k) => list.reduce((a, h) => a + (Number(h[k]) || 0), 0);

    const volThis = sum(thisWeek, 'volume');
    const volPrev = sum(prevWeek, 'volume');

    // --- Health Grade -------------------------------------------------
    const consistency = Math.min(1, (progress.workoutsThisWeek || 0) / Math.max(1, weeklyGoal));
    const streakScore = Math.min(1, (progress.streak || 0) / 7);
    const workload = volPrev > 0
      ? Math.min(1, volThis / volPrev)
      : (volThis > 0 ? 1 : 0);
    const grade = Math.round((consistency * 0.5 + streakScore * 0.25 + workload * 0.25) * 100);

    const todaysSessions = history.filter(
      (h) => startOfDay(new Date(h.date)).getTime() === todayStart
    );

    const weights = progress.weight || [];
    const latestWeight = weights.length ? Number(weights.at(-1).value) : null;
    const prevWeight = weights.length > 1 ? Number(weights.at(-2).value) : null;

    // Chart series: last 7 days, or 4 weekly buckets for the month view.
    let series;
    let labels;
    if (range === 'week') {
      series = volSeries.slice();
      labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const todayIdx = new Date().getDay();
      labels = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(todayStart - (6 - i) * dayMs);
        return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
      });
      void todayIdx;
    } else {
      series = Array.from({ length: 4 }, (_, i) => {
        const to = todayStart - (3 - i) * 7 * dayMs;
        const from = to - 6 * dayMs;
        return sum(history.filter((h) => inWindow(h, from, to)), 'volume');
      });
      labels = ['W-3', 'W-2', 'W-1', 'Now'];
    }

    return {
      grade,
      sessionsThisWeek: progress.workoutsThisWeek || 0,
      streak: progress.streak || 0,
      weeklyGoal,
      consistency,
      streakScore,
      workload,
      volThis,
      volPrev,
      calToday: sum(todaysSessions, 'calories'),
      durToday: sum(todaysSessions, 'duration'),
      setsThisWeek: thisWeek.reduce((a, h) => a + (Number(h.completed) || 0), 0),
      latestWeight,
      weightDelta: latestWeight != null && prevWeight != null ? latestWeight - prevWeight : null,
      series,
      labels,
      calSeries,
      durSeries,
    };
  }, [rawProgress, rawHistory, rawGoal, range]);

  const gradeLabel =
    model.grade >= 80 ? 'Excellent' :
    model.grade >= 60 ? 'On track' :
    model.grade >= 35 ? 'Building' : 'Get started';

  const max = Math.max(...model.series, 1);
  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <section className="dr" data-reveal>
      {/* ---- Health grade ---- */}
      <div className="gx-card dr-grade">
        <div className="dr-grade-text">
          <span className="m1-eyebrow">Health grade</span>
          <h3 className="m1-display dr-grade-title">{gradeLabel}</h3>
          <p className="dr-grade-sub">
            {model.sessionsThisWeek}/{model.weeklyGoal} sessions · {model.streak} day streak
            {model.volPrev > 0 && (
              <> · {model.volThis >= model.volPrev ? 'volume up' : 'volume down'} vs last week</>
            )}
          </p>
        </div>
        <div className="dr-ring" role="img" aria-label={`Health grade ${model.grade} out of 100`}>
          <svg viewBox="0 0 80 80" width="80" height="80">
            <circle cx="40" cy="40" r={R} className="dr-ring-track" />
            <circle
              cx="40" cy="40" r={R}
              className="dr-ring-fill"
              style={{ strokeDasharray: C, strokeDashoffset: C * (1 - model.grade / 100) }}
            />
          </svg>
          <span className="dr-ring-num">{model.grade}</span>
        </div>
      </div>

      {/* ---- Real metric tiles ---- */}
      <h4 className="dr-heading">Health metrics</h4>
      <div className="dr-metrics">
        <Metric iconKey="fire"     label="Calories"   value={compact(model.calToday)} unit="kcal today" />
        <Metric iconKey="chart"    label="Weight"     value={model.latestWeight ?? '--'} unit="kg"
                delta={model.weightDelta} />
        <Metric iconKey="zap"      label="Volume"     value={compact(model.volThis)} unit="kg this week" />
        <Metric iconKey="check"    label="Sets done"  value={model.setsThisWeek} unit="this week" />
      </div>

      {/* ---- Workload chart ---- */}
      <div className="gx-card dr-chart">
        <div className="dr-chart-head">
          <span className="m1-eyebrow is-muted">Workload</span>
          <div className="m1-seg dr-range">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                className={range === r.id ? 'is-active' : ''}
                onClick={() => setRange(r.id)}
                aria-pressed={range === r.id}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {model.series.every((v) => !v) ? (
          <p className="dr-empty">No volume logged yet — finish a session to start the chart.</p>
        ) : (
          <div className="dr-bars">
            {model.series.map((v, i) => (
              <div className="dr-bar-col" key={i}>
                <span className="dr-bar-val">{v ? compact(v) : ''}</span>
                <span className="dr-bar" style={{ height: `${Math.max(3, (v / max) * 100)}%` }} />
                <span className="dr-bar-lbl">{model.labels[i]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ iconKey, label, value, unit, delta }) {
  return (
    <div className="gx-card dr-metric">
      <div className="dr-metric-head">
        <span className="dr-metric-lbl">{label}</span>
        <span className="dr-metric-icon">{icon(iconKey, 15)}</span>
      </div>
      <div className="dr-metric-val">{value}</div>
      <div className="dr-metric-unit">
        {unit}
        {delta != null && delta !== 0 && (
          <span className={`dr-metric-delta ${delta < 0 ? 'is-down' : 'is-up'}`}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}
