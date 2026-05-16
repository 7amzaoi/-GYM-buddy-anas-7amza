import { useMemo, useState, useContext } from 'react';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { getRandomQuote } from '../data.js';
import { NavigateContext } from '../context/NavigateContext.jsx';
import { setWater } from '../lib/interactions.js';
import { renderPerfAreaChart } from './dashboardCharts.js';

const perfLabels = {
  strengthVolume: 'Strength Volume',
  caloriesBurned: 'Calories Burned',
  duration: 'Duration (min)'
};
const perfUnits = {
  strengthVolume: 'kg',
  caloriesBurned: 'cal',
  duration: 'min'
};

/** Local-only calculator — not persisted (no Store / DB). */
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
    <div className="card animate-slide-up delay-4" style={{ marginBottom: '24px' }}>
      <h3 style={{ marginBottom: '16px' }}>📏 BMI Calculator</h3>
      <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
        Quick estimate only. Age isn&apos;t part of the BMI formula — it&apos;s just for your notes. Nothing here is saved.
      </p>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="input-group" style={{ flex: 1, minWidth: '120px' }}>
          <label>Height (cm)</label>
          <input
            className="input"
            type="number"
            min={80}
            max={250}
            value={heightCm}
            onChange={ev => setHeightCm(Math.max(0, parseFloat(ev.target.value) || 0))}
          />
        </div>
        <div className="input-group" style={{ flex: 1, minWidth: '120px' }}>
          <label>Weight (kg)</label>
          <input
            className="input"
            type="number"
            min={20}
            max={400}
            value={weightKg}
            onChange={ev => setWeightKg(Math.max(0, parseFloat(ev.target.value) || 0))}
          />
        </div>
        <div className="input-group" style={{ flex: 1, minWidth: '120px' }}>
          <label>Age</label>
          <input
            className="input"
            type="number"
            min={10}
            max={120}
            value={age}
            onChange={ev => setAge(Math.max(0, parseInt(ev.target.value, 10) || 0))}
          />
        </div>
      </div>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '2.5rem', fontWeight: 800, color }}>{bmi}</div>
        <div style={{ fontSize: '.9rem', color, fontWeight: 600 }}>{category}</div>
      </div>
      <div
        style={{
          position: 'relative',
          height: '8px',
          background: 'linear-gradient(90deg,#0EA5E9,#2ED573,#FFA502,#FF4757)',
          borderRadius: '4px'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-4px',
            left: `${pct}%`,
            width: '16px',
            height: '16px',
            background: '#fff',
            borderRadius: '50%',
            transform: 'translateX(-50%)',
            boxShadow: '0 2px 8px rgba(0,0,0,.3)',
            transition: 'left .5s ease'
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '.7rem',
          color: 'var(--text-secondary)',
          marginTop: '6px'
        }}
      >
        <span>Underweight</span>
        <span>Normal</span>
        <span>Overweight</span>
        <span>Obese</span>
      </div>
    </div>
  );
}

function WaterCompact() {
  const water = Store.get('waterIntake') || 0;
  const goal = 8;
  const pct = Math.min((water / goal) * 100, 100);
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3>💧 Water Intake</h3>
        <span className={`badge ${water >= goal ? 'badge-success' : 'badge-accent'}`}>
          {water}/{goal}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {Array.from({ length: goal }, (_, i) => (
          <div
            key={i}
            role="presentation"
            onClick={() => setWater(i + 1)}
            style={{
              flex: 1,
              height: '36px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all .3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '.75rem',
              background: i < water ? 'linear-gradient(to top, #0EA5E9, #38BDF8)' : 'var(--bg-card)',
              border: `1px solid ${i < water ? '#0EA5E9' : 'var(--border)'}`,
              color: i < water ? '#fff' : 'var(--text-secondary)'
            }}
          >
            {i < water ? '💧' : String(i + 1)}
          </div>
        ))}
      </div>
      <div style={{ height: '5px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg,#0EA5E9,#38BDF8)',
            borderRadius: '3px',
            transition: 'width .6s ease'
          }}
        />
      </div>
    </>
  );
}

export default function DashboardPage() {
  const navigateToPage = useContext(NavigateContext);
  const [perfMetric, setPerfMetric] = useState('strengthVolume');
  const [quote] = useState(() => getRandomQuote());

  const user = Store.get('user');
  const progress = Store.get('progressData');
  const history = Store.get('workoutHistory');
  const metricsLog = Store.get('metricsLog') || [];
  Store.get('waterIntake');
  Store.get('bmiData');

  const currentWeight = Number.isFinite(Number(user?.weight_kg))
    ? Number(user.weight_kg)
    : (metricsLog.at(-1)?.weight ?? progress.weight.at(-1)?.value ?? null);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();

  const perf = progress?.weeklyPerformance || {
    strengthVolume: [0, 0, 0, 0, 0, 0, 0],
    caloriesBurned: [0, 0, 0, 0, 0, 0, 0],
    duration: [0, 0, 0, 0, 0, 0, 0]
  };

  const chartMarkup = useMemo(
    () => renderPerfAreaChart(perf[perfMetric], perfUnits[perfMetric]),
    [perfMetric, perf]
  );

  return (
    <>
      <div className="page-header animate-fade">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>
              {greeting},{' '}
              <span style={{ color: 'var(--accent)' }}>{user?.name || 'Athlete'}</span> 👋
            </h1>
            <p>{quote}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {icon('fire', 20)}
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)' }}>{progress.streak}</span>
            <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>day streak</span>
          </div>
        </div>
      </div>

      <div className="grid grid-4 animate-slide-up delay-1" style={{ marginBottom: '24px' }}>
        <div className="card stat-card card-tilt" data-tooltip="Total calories burned today">
          <div className="stat-icon">{icon('fire', 22)}</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }} data-counter={progress.calories.at(-1)?.value || 0} data-suffix=" cal">
            0
          </div>
          <div className="stat-label">Calories Today</div>
        </div>
        <div className="card stat-card card-tilt" data-tooltip="Workouts completed this week">
          <div className="stat-icon">{icon('activity', 22)}</div>
          <div className="stat-value" data-counter={progress.workoutsThisWeek}>0</div>
          <div className="stat-label">Workouts This Week</div>
        </div>
        <div className="card stat-card card-tilt" data-tooltip="Lifetime workout count">
          <div className="stat-icon">{icon('target', 22)}</div>
          <div className="stat-value" data-counter={progress.totalWorkouts}>0</div>
          <div className="stat-label">Total Workouts</div>
        </div>
        <div className="card stat-card card-tilt" data-tooltip="Your current body weight">
          <div className="stat-icon">{icon('zap', 22)}</div>
          <div className="stat-value">
            {currentWeight ?? '--'}
            <span style={{ fontSize: '.9rem', fontWeight: 400 }}> kg</span>
          </div>
          <div className="stat-label">Current Weight</div>
        </div>
      </div>

      <div className="card animate-slide-up delay-2" style={{ marginBottom: '24px', padding: '28px 28px 20px' }} id="perf-chart-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <h3 style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', fontSize: '1rem' }}>Weekly Performance</h3>
            <span className="badge badge-accent" style={{ textTransform: 'uppercase', fontSize: '.7rem', letterSpacing: '.5px' }}>
              {perfLabels[perfMetric]}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button type="button" className={`perf-tab ${perfMetric === 'strengthVolume' ? 'active' : ''}`} onClick={() => setPerfMetric('strengthVolume')}>
              Volume
            </button>
            <button type="button" className={`perf-tab ${perfMetric === 'caloriesBurned' ? 'active' : ''}`} onClick={() => setPerfMetric('caloriesBurned')}>
              Calories
            </button>
            <button type="button" className={`perf-tab ${perfMetric === 'duration' ? 'active' : ''}`} onClick={() => setPerfMetric('duration')}>
              Duration
            </button>
          </div>
        </div>
        <div
          id="perf-chart-container"
          style={{ position: 'relative', height: '260px', cursor: 'crosshair' }}
          dangerouslySetInnerHTML={{ __html: chartMarkup }}
        />
      </div>

      <div className="grid grid-2 animate-slide-up delay-3" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>{icon('fire', 18)} Activity Streak</h3>
            <span className="badge badge-accent">
              {icon('trophy', 12)} Keep it up!
            </span>
          </div>
          <div className="streak-bar">
            {days.map((d, i) => {
              const isDone = i <= today && i >= today - progress.streak + 1 && i <= today;
              const isToday = i === today;
              return (
                <div key={d} className={`streak-day ${isDone ? 'done' : ''} ${isToday && !isDone ? 'today' : ''}`}>{d}</div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <WaterCompact />
        </div>
      </div>

      <div className="grid grid-2 animate-slide-up delay-4" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>{icon('clock', 18)} Recent Workouts</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigateToPage?.('progress')} style={{ fontSize: '.75rem' }}>
              View All →
            </button>
          </div>
          {history.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No workouts yet. Start your first session!</p>
          ) : (
            history.slice(0, 3).map(w => (
              <div key={w.id || w.planName + w.date} className="exercise-item" style={{ marginBottom: '8px' }}>
                <div className="stat-icon">{icon('dumbbell', 18)}</div>
                <div className="exercise-info">
                  <h4>{w.planName}</h4>
                  <p>{w.duration || '?'} min · {w.calories} cal</p>
                </div>
                <span className="badge badge-success">{icon('check', 12)} Done</span>
              </div>
            ))
          )}
        </div>
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>{icon('trophy', 18)} Personal Records</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(progress.personalRecords || {}).map(([name, val]) => (
              <div key={name} className="summary-row">
                <span>{name}</span>
                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BMIBlock />
    </>
  );
}
