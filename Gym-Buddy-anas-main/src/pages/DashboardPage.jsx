import { useMemo, useState, useContext, useEffect, useRef } from 'react';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { getRandomQuote } from '../data.js';
import { NavigateContext } from '../context/NavigateContext.jsx';
import { setWater } from '../lib/interactions.js';
import { renderPerfAreaChart } from './dashboardCharts.js';
import { revealOnScroll } from '../lib/motion.js';
import SmartBanner from '../components/SmartBanner.jsx';

const perfLabels = {
  strengthVolume: 'Strength Volume',
  caloriesBurned: 'Calories Burned',
  duration: 'Duration (min)',
};
const perfUnits = { strengthVolume: 'kg', caloriesBurned: 'cal', duration: 'min' };

/** Local-only BMI estimate — not persisted. */
function BMIBlock() {
  const [heightCm, setHeightCm] = useState(175);
  const [weightKg, setWeightKg] = useState(80);
  const [age, setAge] = useState(25);

  const bmiRaw = weightKg / Math.pow(heightCm / 100, 2);
  const bmiNum = Number.isFinite(bmiRaw) ? Number(bmiRaw.toFixed(1)) : NaN;
  const bmi = Number.isFinite(bmiNum) ? String(bmiNum) : '--';
  let category = '—';
  let color = 'var(--text-secondary)';
  if (Number.isFinite(bmiNum)) {
    if (bmiNum < 18.5) { category = 'Underweight'; color = '#FFA502'; }
    else if (bmiNum < 25) { category = 'Normal'; color = '#2ED573'; }
    else if (bmiNum < 30) { category = 'Overweight'; color = '#FFA502'; }
    else { category = 'Obese'; color = '#FF4757'; }
  }
  const pct = Number.isFinite(bmiNum) ? Math.min(Math.max(((bmiNum - 15) / 25) * 100, 0), 100) : 0;

  return (
    <div className="gx-card dash-bmi" data-reveal>
      <div className="gx-section-head" style={{ marginBottom: 'var(--space-4)' }}>
        <span className="gx-eyebrow">{icon('activity', 13)} Body Index</span>
        <h3 className="gx-title" style={{ fontSize: 'var(--text-xl)' }}>BMI Calculator</h3>
        <p className="gx-subtitle">Quick estimate only — nothing here is saved.</p>
      </div>
      <div className="dash-bmi-fields">
        {[
          { label: 'Height (cm)', value: heightCm, set: setHeightCm, min: 80, max: 250 },
          { label: 'Weight (kg)', value: weightKg, set: setWeightKg, min: 20, max: 400 },
          { label: 'Age', value: age, set: (v) => setAge(v), min: 10, max: 120 },
        ].map((f) => (
          <label key={f.label} className="dash-field">
            <span>{f.label}</span>
            <input
              type="number"
              min={f.min}
              max={f.max}
              value={f.value}
              onChange={(e) => f.set(Math.max(0, parseFloat(e.target.value) || 0))}
            />
          </label>
        ))}
      </div>
      <div className="dash-bmi-readout">
        <div className="dash-bmi-num" style={{ color }}>{bmi}</div>
        <div className="dash-bmi-cat" style={{ color }}>{category}</div>
      </div>
      <div className="dash-bmi-track">
        <div className="dash-bmi-marker" style={{ left: `${pct}%` }} />
      </div>
      <div className="dash-bmi-scale">
        <span>Under</span><span>Normal</span><span>Over</span><span>Obese</span>
      </div>
    </div>
  );
}

function WaterCard() {
  const water = Store.get('waterIntake') || 0;
  const goal = 8;
  const pct = Math.min((water / goal) * 100, 100);
  return (
    <div className="gx-card" data-reveal>
      <div className="dash-card-head">
        <span className="gx-eyebrow">{icon('activity', 13)} Hydration</span>
        <span className={`gx-badge ${water >= goal ? 'is-accent' : ''}`}>{water}/{goal} glasses</span>
      </div>
      <div className="dash-water-row">
        {Array.from({ length: goal }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`dash-water-cell ${i < water ? 'is-filled' : ''}`}
            onClick={() => setWater(i + 1)}
            aria-label={`Set water to ${i + 1}`}
          >
            {i < water ? icon('check', 13) : i + 1}
          </button>
        ))}
      </div>
      <div className="dash-progress-track">
        <div className="dash-progress-fill dash-progress-water" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigateToPage = useContext(NavigateContext);
  const rootRef = useRef(null);
  const [perfMetric, setPerfMetric] = useState('strengthVolume');
  const [quote] = useState(() => getRandomQuote());

  const user = Store.get('user');
  const progress = Store.get('progressData');
  const history = Store.get('workoutHistory');
  const metricsLog = Store.get('metricsLog') || [];
  Store.get('waterIntake');

  const currentWeight = Number.isFinite(Number(user?.weight_kg))
    ? Number(user.weight_kg)
    : (metricsLog.at(-1)?.weight ?? progress.weight.at(-1)?.value ?? null);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();
  const firstName = (user?.name || 'Athlete').trim().split(/\s+/)[0];

  const perf = progress?.weeklyPerformance || {
    strengthVolume: [0, 0, 0, 0, 0, 0, 0],
    caloriesBurned: [0, 0, 0, 0, 0, 0, 0],
    duration: [0, 0, 0, 0, 0, 0, 0],
  };
  const chartMarkup = useMemo(
    () => renderPerfAreaChart(perf[perfMetric], perfUnits[perfMetric]),
    [perfMetric, perf]
  );

  // Personalized weekly summary line
  const weekVol = (perf.strengthVolume || []).reduce((a, b) => a + b, 0);
  const summary =
    progress.workoutsThisWeek >= 4
      ? 'Strong week — you are ahead of most athletes. Keep the streak alive.'
      : progress.workoutsThisWeek >= 1
        ? 'Solid start this week. One more session pushes you into the top tier.'
        : 'Fresh week, clean slate. Log a session to get the momentum going.';

  const stats = [
    { icon: 'fire', value: progress.calories.at(-1)?.value || 0, suffix: ' cal', label: 'Calories Today' },
    { icon: 'activity', value: progress.workoutsThisWeek, suffix: '', label: 'Workouts This Week' },
    { icon: 'target', value: progress.totalWorkouts, suffix: '', label: 'Total Workouts' },
  ];

  useEffect(() => {
    const cleanup = revealOnScroll(rootRef.current, '[data-reveal]', { y: 28, stagger: 0.06 });
    return cleanup;
  }, []);

  return (
    <div className="dash" ref={rootRef}>
      {/* ===== Hero header ===== */}
      <header className="dash-hero" data-reveal>
        <div className="dash-hero-glow" aria-hidden="true" />
        <div className="dash-hero-main">
          <span className="gx-eyebrow">{greeting}</span>
          <h1 className="dash-hero-title">
            Hey <span className="dash-accent">{firstName}</span>
          </h1>
          <p className="dash-hero-quote">{quote}</p>
        </div>
        <div className="dash-streak-chip" title="Current streak">
          <span className="dash-streak-icon">{icon('fire', 22)}</span>
          <span className="dash-streak-num">{progress.streak}</span>
          <span className="dash-streak-label">day streak</span>
        </div>
      </header>

      {/* ===== Smart notification ===== */}
      <SmartBanner />

      {/* ===== Weekly summary banner ===== */}
      <div className="dash-summary" data-reveal>
        <span className="dash-summary-icon">{icon('zap', 18)}</span>
        <p>{summary}</p>
        <button type="button" className="gx-btn gx-btn-primary dash-summary-cta" onClick={() => navigateToPage?.('planner')}>
          {icon('dumbbell', 16)} Start a Workout
        </button>
      </div>

      {/* ===== Stat bento ===== */}
      <div className="dash-stats">
        {stats.map((s) => (
          <div key={s.label} className="gx-card dash-stat-card" data-reveal>
            <span className="dash-stat-icon">{icon(s.icon, 20)}</span>
            <div className="gx-stat-value" data-counter={s.value} data-suffix={s.suffix}>0</div>
            <div className="gx-stat-label">{s.label}</div>
          </div>
        ))}
        <div className="gx-card dash-stat-card" data-reveal>
          <span className="dash-stat-icon">{icon('chart', 20)}</span>
          <div className="gx-stat-value">
            {currentWeight ?? '--'}<span className="dash-stat-unit"> kg</span>
          </div>
          <div className="gx-stat-label">Current Weight</div>
        </div>
      </div>

      {/* ===== Weekly performance chart ===== */}
      <div className="gx-card dash-chart-card" data-reveal id="perf-chart-card">
        <div className="dash-card-head">
          <div>
            <span className="gx-eyebrow">{icon('chart', 13)} This Week</span>
            <h3 className="gx-title dash-chart-title">{perfLabels[perfMetric]}</h3>
          </div>
          <div className="dash-tabs">
            {[
              ['strengthVolume', 'Volume'],
              ['caloriesBurned', 'Calories'],
              ['duration', 'Duration'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`dash-tab ${perfMetric === key ? 'is-active' : ''}`}
                onClick={() => setPerfMetric(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div
          id="perf-chart-container"
          className="dash-chart-area"
          dangerouslySetInnerHTML={{ __html: chartMarkup }}
        />
        <div className="dash-chart-foot">
          Total volume this week: <strong>{weekVol.toLocaleString()} kg</strong>
        </div>
      </div>

      {/* ===== Streak + Water ===== */}
      <div className="dash-grid-2">
        <div className="gx-card" data-reveal>
          <div className="dash-card-head">
            <span className="gx-eyebrow">{icon('fire', 13)} Activity Streak</span>
            <span className="gx-badge is-accent">{icon('trophy', 11)} Keep going</span>
          </div>
          <div className="dash-streak-week">
            {days.map((d, i) => {
              const isDone = i <= today && i >= today - progress.streak + 1;
              const isToday = i === today;
              return (
                <div
                  key={d}
                  className={`dash-day ${isDone ? 'is-done' : ''} ${isToday && !isDone ? 'is-today' : ''}`}
                >
                  {d}
                </div>
              );
            })}
          </div>
        </div>
        <WaterCard />
      </div>

      {/* ===== Recent workouts + PRs ===== */}
      <div className="dash-grid-2">
        <div className="gx-card" data-reveal>
          <div className="dash-card-head">
            <span className="gx-eyebrow">{icon('clock', 13)} Recent Workouts</span>
            <button type="button" className="dash-link" onClick={() => navigateToPage?.('progress')}>
              View all {icon('arrow', 12)}
            </button>
          </div>
          {history.length === 0 ? (
            <div className="dash-empty">
              <span className="dash-empty-icon">{icon('dumbbell', 26)}</span>
              <p>No workouts yet — your first session starts the streak.</p>
            </div>
          ) : (
            <div className="dash-list">
              {history.slice(0, 3).map((w) => (
                <div key={w.id || w.planName + w.date} className="dash-workout-row">
                  <span className="dash-workout-icon">{icon('dumbbell', 16)}</span>
                  <div className="dash-workout-info">
                    <h4>{w.planName}</h4>
                    <p>{w.duration || '?'} min · {w.calories} cal</p>
                  </div>
                  <span className="gx-badge is-accent">{icon('check', 11)} Done</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="gx-card" data-reveal>
          <div className="dash-card-head">
            <span className="gx-eyebrow">{icon('trophy', 13)} Personal Records</span>
          </div>
          {Object.keys(progress.personalRecords || {}).length === 0 ? (
            <div className="dash-empty">
              <span className="dash-empty-icon">{icon('trophy', 26)}</span>
              <p>No PRs logged yet. They appear here automatically.</p>
            </div>
          ) : (
            <div className="dash-list">
              {Object.entries(progress.personalRecords || {}).map(([name, val]) => (
                <div key={name} className="dash-pr-row">
                  <span>{name}</span>
                  <span className="dash-pr-val">{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BMIBlock />
    </div>
  );
}
