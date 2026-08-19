import { useState } from 'react';
import { icon } from '../icons.jsx';

/**
 * Local-only BMI estimate — not persisted.
 *
 * Extracted verbatim from DashboardPage when the Dashboard became the
 * athletic-editorial "Today" screen (which has no room for it). Kept as a
 * standalone component so the feature survives the redesign; it is mounted on
 * Profile rather than deleted.
 */
export default function BMIBlock() {
  const [heightCm, setHeightCm] = useState(175);
  const [weightKg, setWeightKg] = useState(80);
  const [age, setAge] = useState(25);

  const bmiRaw = weightKg / Math.pow(heightCm / 100, 2);
  const bmiNum = Number.isFinite(bmiRaw) ? Number(bmiRaw.toFixed(1)) : NaN;
  const bmi = Number.isFinite(bmiNum) ? String(bmiNum) : '--';
  let category = '—';
  let color = 'var(--text-secondary)';
  if (Number.isFinite(bmiNum)) {
    if (bmiNum < 18.5) { category = 'Underweight'; color = 'var(--status-warn)'; }
    else if (bmiNum < 25) { category = 'Normal'; color = 'var(--status-ok)'; }
    else if (bmiNum < 30) { category = 'Overweight'; color = 'var(--status-warn)'; }
    else { category = 'Obese'; color = 'var(--status-bad)'; }
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
