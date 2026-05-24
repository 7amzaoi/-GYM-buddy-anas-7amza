import { icon } from '../../icons.jsx';
import { getExerciseById } from '../../data.js';
import {
  BAR_OPTIONS, CATEGORY_TABS, MUSCLE_GROUPS,
  calculatePlates, formatTime,
} from './helpers.js';

/* ============================================================
   PickerModal — choose an exercise to add to the active session.
   ============================================================ */
export function PickerModal({
  open, onClose,
  query, setQuery, cat, setCat, muscle, setMuscle,
  filteredExercises, muscleCounts, quickPicks, onPick,
}) {
  if (!open) return null;
  const hasActiveFilters = cat !== 'all' || muscle || query;
  return (
    <div className="gx-modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="gx-modal gx-modal-wide" role="dialog" aria-modal="true" aria-label="Pick exercise">
        <div className="gx-modal-head">
          <h2>Add Exercise</h2>
          <button type="button" className="gx-modal-close" onClick={onClose} aria-label="Close">
            {icon('x', 18)}
          </button>
        </div>
        <div className="wko-picker-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises or muscles..."
            autoFocus
          />
        </div>

        {!query && cat === 'all' && quickPicks.length > 0 && (
          <div className="wko-picker-quick">
            <span className="wko-picker-quick-label">Quick picks</span>
            <div className="wko-picker-quick-row">
              {quickPicks.map((e) => (
                <button key={e.id} type="button" className="wko-picker-chip" onClick={() => onPick(e.id)}>
                  {icon('plus', 11)} {e.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="wko-picker-tabs">
          {CATEGORY_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`wko-picker-tab ${cat === t.id ? 'is-active' : ''}`}
              onClick={() => setCat(t.id)}
            >
              {icon(t.iconKey, 12)} {t.label}
            </button>
          ))}
        </div>

        <div className="wko-picker-muscles" role="tablist" aria-label="Filter by muscle">
          <button
            type="button"
            className={`wko-picker-muscle ${muscle === null ? 'is-active' : ''}`}
            onClick={() => setMuscle(null)}
          >
            All muscles
          </button>
          {MUSCLE_GROUPS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`wko-picker-muscle ${muscle === m.id ? 'is-active' : ''}`}
              onClick={() => setMuscle(muscle === m.id ? null : m.id)}
              disabled={muscleCounts[m.id] === 0}
            >
              {m.label}
              <span className="wko-picker-muscle-count">{muscleCounts[m.id]}</span>
            </button>
          ))}
        </div>

        <div className="wko-picker-meta">
          <span>{filteredExercises.length} exercise{filteredExercises.length === 1 ? '' : 's'}</span>
          {hasActiveFilters && (
            <button
              type="button"
              className="wko-picker-clear"
              onClick={() => { setCat('all'); setMuscle(null); setQuery(''); }}
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="wko-picker-list">
          {filteredExercises.length === 0 ? (
            <div className="wko-picker-empty">No exercises match.</div>
          ) : filteredExercises.map((e) => (
            <button key={e.id} type="button" className="wko-picker-item" onClick={() => onPick(e.id)}>
              <span className="wko-picker-item-info">
                <span className="wko-picker-item-name">{e.name}</span>
                <span className="wko-picker-item-muscles">{e.muscles}</span>
              </span>
              <span className="wko-picker-item-cta">{icon('plus', 15)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PlateModal — visual plate breakdown for a barbell weight.
   ============================================================ */
export function PlateModal({ value, onChange, onClose }) {
  if (!value) return null;
  const result = calculatePlates(value.weight, value.bar);
  return (
    <div className="gx-modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="gx-modal gx-modal-sm wko-plate-modal" role="dialog" aria-modal="true" aria-label="Plate calculator">
        <div className="gx-modal-head">
          <h2>Plate Calculator</h2>
          <button type="button" className="gx-modal-close" onClick={onClose} aria-label="Close">
            {icon('x', 18)}
          </button>
        </div>
        <div className="wko-plate-form">
          <label className="prof-field">
            <span>Target weight (kg)</span>
            <input
              type="number"
              step="0.5"
              min="0"
              value={value.weight}
              onChange={(e) => onChange({ ...value, weight: e.target.value })}
              autoFocus
            />
          </label>
          <div className="prof-field">
            <span>Bar</span>
            <div className="wko-plate-bars">
              {BAR_OPTIONS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`wko-plate-bar ${value.bar === b.kg ? 'is-active' : ''}`}
                  onClick={() => onChange({ ...value, bar: b.kg })}
                >
                  <strong>{b.kg} kg</strong>
                  <span>{b.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="wko-plate-result">
          <div className="wko-plate-perside">
            <span className="wko-plate-label">Per side</span>
            <span className="wko-plate-val">{result.perSide.toFixed(2).replace(/\.?0+$/, '')} kg</span>
          </div>
          {result.plates.length > 0 ? (
            <div className="wko-plate-visual" aria-hidden>
              {result.plates.map((p, i) => (
                <span
                  key={i}
                  className={`wko-plate-disk plate-${String(p).replace('.', '_')}`}
                  style={{ height: `${20 + p * 2.2}px` }}
                >
                  {p}
                </span>
              ))}
            </div>
          ) : (
            <p className="wko-plate-empty">Bar only — no plates needed.</p>
          )}
          {result.plates.length > 0 && (
            <div className="wko-plate-breakdown">
              {result.plates.join(' + ')} kg <small>per side</small>
            </div>
          )}
          {!result.ok && result.plates.length > 0 && (
            <p className="wko-plate-warn">
              {icon('zap', 11)} Closest possible — {Math.abs(result.leftover).toFixed(2)} kg off target.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DiscardModal — confirm before throwing away an active session.
   ============================================================ */
export function DiscardModal({ open, onClose, onConfirm }) {
  if (!open) return null;
  return (
    <div className="gx-modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="gx-modal gx-modal-sm" role="dialog" aria-modal="true" aria-label="Discard workout">
        <div className="sess-end-icon">{icon('trash', 24)}</div>
        <h2 className="sess-end-title">Discard this workout?</h2>
        <p className="sess-end-desc">Your sets and timer will be lost.</p>
        <div className="sess-end-actions">
          <button type="button" className="gx-btn gx-btn-ghost" onClick={onClose}>
            Keep Going
          </button>
          <button type="button" className="gx-btn gx-btn-primary wko-discard-btn" onClick={onConfirm}>
            {icon('trash', 14)} Yes, Discard
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SummaryModal — celebratory recap shown after Finish, before save.
   ============================================================ */
export function SummaryModal({
  open, onClose, onConfirm, session, liveStats, elapsedSec,
  saveAsTemplate, setSaveAsTemplate, templateName, setTemplateName,
}) {
  if (!open) return null;
  return (
    <div className="gx-modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="gx-modal gx-modal-wide wko-summary" role="dialog" aria-modal="true" aria-label="Workout summary">
        <div className="wko-summary-hero">
          <div className="wko-summary-trophy">{icon('trophy', 30)}</div>
          <h2 className="wko-summary-title">Great work!</h2>
          <p className="wko-summary-sub">Here&apos;s how your session went.</p>
        </div>

        <div className="wko-summary-grid">
          <SummaryStat iconKey="clock"    val={formatTime(elapsedSec)}                       label="Duration" />
          <SummaryStat iconKey="check"    val={liveStats.doneSets}                           label="Sets done" />
          <SummaryStat iconKey="activity" val={liveStats.totalReps}                          label="Total reps" />
          <SummaryStat iconKey="zap"      val={liveStats.totalVolume.toLocaleString()}       label="Volume (kg)" />
        </div>

        <div className="wko-summary-section-title">Exercises completed</div>
        <ul className="wko-summary-list">
          {session.exercises.map((ex) => {
            const data = getExerciseById(ex.id);
            if (!data) return null;
            const done = (ex.sets || []).filter((s) => s.done);
            if (done.length === 0) return null;
            const best = done.reduce((b, ls) => {
              const w = parseFloat(ls.weight) || 0;
              if (!b || w > b.w) return { w, r: parseInt(ls.reps, 10) || 0 };
              return b;
            }, null);
            return (
              <li key={ex.id} className="wko-summary-row">
                <span className="wko-summary-row-name">{data.name}</span>
                <span className="wko-summary-row-best">
                  {done.length} sets {best ? `· best ${best.w}kg × ${best.r}` : ''}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="wko-summary-template">
          <label className="wko-summary-template-toggle">
            <input
              type="checkbox"
              checked={saveAsTemplate}
              onChange={(e) => setSaveAsTemplate(e.target.checked)}
            />
            <span className="wko-summary-template-box" aria-hidden>{saveAsTemplate ? icon('check', 12) : null}</span>
            <span className="wko-summary-template-text">
              <strong>Save as template</strong>
              <small>Add this workout to your Plans for one-tap reuse.</small>
            </span>
          </label>
          {saveAsTemplate && (
            <input
              type="text"
              className="wko-summary-template-name"
              placeholder={`Workout ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              maxLength={40}
            />
          )}
        </div>

        <div className="wko-summary-actions">
          <button type="button" className="gx-btn gx-btn-ghost" onClick={onClose}>
            Keep Editing
          </button>
          <button type="button" className="gx-btn gx-btn-primary" onClick={onConfirm}>
            {icon('check', 15)} Save Workout
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ iconKey, val, label }) {
  return (
    <div className="wko-summary-stat">
      <span className="wko-summary-stat-icon">{icon(iconKey, 16)}</span>
      <span className="wko-summary-stat-val">{val}</span>
      <span className="wko-summary-stat-lbl">{label}</span>
    </div>
  );
}
