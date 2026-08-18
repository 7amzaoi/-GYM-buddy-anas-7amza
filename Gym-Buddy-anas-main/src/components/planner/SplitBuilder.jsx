import { useState } from 'react';
import { getAllExercises } from '../../data.js';
import { Store } from '../../store.js';
import { icon } from '../../icons.jsx';
import { Toast } from '../../lib/interactions.js';

/**
 * Weekly split builder.
 *
 * Lives in its own file rather than inside PlannerPage not because that page
 * is strained (505 lines, mid-pack here) but because this adds ~400 more and
 * the two flows share no state.
 *
 * Single-scroll rather than a 7-step wizard: the app has no wizard anywhere
 * else, and a split is a shape you judge as a whole — seeing Mon-Sun at once
 * is the point. Each day is an accordion row so the page stays short until
 * you open one.
 *
 * The exercise picker deliberately reuses PlannerPage's exact markup
 * (`.plan-ex-item` / `.cp-exercise` checkbox rows, muscle-group filter) so
 * building a day feels identical to building a plan.
 */

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Chest', tags: ['chest', 'upper chest'] },
  { id: 'back', label: 'Back', tags: ['back'] },
  { id: 'shoulders', label: 'Shoulders', tags: ['shoulders', 'rear delts'] },
  { id: 'arms', label: 'Arms', tags: ['biceps', 'triceps', 'forearms', 'arms'] },
  { id: 'legs', label: 'Legs', tags: ['quads', 'hamstrings', 'glutes', 'legs'] },
  { id: 'core', label: 'Core', tags: ['core'] },
  { id: 'cardio', label: 'Cardio', tags: ['cardio', 'full body', 'power'] },
];

function muscleTokens(ex) {
  return String(ex.muscles || '').split(',').map((m) => m.trim().toLowerCase()).filter(Boolean);
}

function matchesMuscleGroup(ex, groupId) {
  if (!groupId) return true;
  const group = MUSCLE_GROUPS.find((g) => g.id === groupId);
  if (!group) return true;
  return muscleTokens(ex).some((t) => group.tags.includes(t));
}

/** A fresh, all-rest week. */
function emptyDays() {
  return Array.from({ length: 7 }, (_, i) => ({ dayIndex: i, type: 'rest' }));
}

/**
 * Turn exercise ids into the denormalized snapshot the data model requires.
 * Name and muscles are copied so a shared split still renders offline and for
 * a viewer whose catalogue is a different build.
 */
function denormalize(ids, catalogue) {
  return ids
    .map((id) => catalogue.find((e) => e.id === id))
    .filter(Boolean)
    .map((e) => ({ id: e.id, name: e.name, muscles: e.muscles || '' }));
}

export default function SplitBuilder({ onDone, onCancel }) {
  const catalogue = getAllExercises();
  const userPlans = Store.get('customPlans') || [];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [days, setDays] = useState(emptyDays);
  const [openDay, setOpenDay] = useState(null);
  /** Per-day muscle filter for the inline picker. */
  const [exFilter, setExFilter] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function patchDay(i, patch) {
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function setRest(i) {
    setDays((prev) => prev.map((d, idx) => (idx === i ? { dayIndex: i, type: 'rest' } : d)));
  }

  function setTraining(i) {
    patchDay(i, { type: 'plan', planName: '', category: 'strength', exercises: [] });
  }

  /**
   * Assign an existing plan to a day.
   *
   * COPIES the plan's exercises rather than storing its id. That is the whole
   * reason a split survives the source plan being renamed, edited or deleted,
   * and it is what makes the split self-contained enough to share.
   */
  function applyExistingPlan(i, planId) {
    const plan = userPlans.find((p) => p.id === planId);
    if (!plan) return;
    patchDay(i, {
      type: 'plan',
      planName: plan.name,
      category: plan.category || 'strength',
      exercises: denormalize(plan.exercises || [], catalogue),
    });
  }

  function toggleExercise(i, exId) {
    setDays((prev) => prev.map((d, idx) => {
      if (idx !== i) return d;
      const current = d.exercises || [];
      const has = current.some((e) => e.id === exId);
      const next = has
        ? current.filter((e) => e.id !== exId)
        : [...current, ...denormalize([exId], catalogue)];
      return { ...d, exercises: next };
    }));
  }

  const trainingCount = days.filter((d) => d.type === 'plan').length;

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the split a name.');
      return;
    }
    const emptyTraining = days.find((d) => d.type === 'plan' && (d.exercises || []).length === 0);
    if (emptyTraining) {
      setError(`${DAY_FULL[emptyTraining.dayIndex]} is a training day with no exercises.`);
      return;
    }
    setError('');
    setSaving(true);
    try {
      Store.addCustomSplit({
        name: trimmed,
        description: description.trim(),
        days: days.map((d, i) => (
          d.type === 'plan'
            ? {
              dayIndex: i,
              type: 'plan',
              planName: (d.planName || '').trim() || `${DAY_FULL[i]} session`,
              category: d.category || 'strength',
              exercises: d.exercises || [],
            }
            : { dayIndex: i, type: 'rest' }
        )),
        sourceSplitId: null,
      });
      Toast.show(`Split "${trimmed}" created!`, 'success');
      onDone?.();
    } catch (err) {
      setError(String(err?.message || err) || 'Could not save the split.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="split-builder">
      <div className="split-field">
        <label htmlFor="split-name">Split name</label>
        <input
          id="split-name"
          className="split-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Push / Pull / Legs"
          autoComplete="off"
        />
      </div>

      <div className="split-field">
        <label htmlFor="split-desc">Description</label>
        <input
          id="split-desc"
          className="split-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional — who it's for, how hard it is"
          autoComplete="off"
        />
      </div>

      {/* Live preview of the week as you build it. */}
      <WeekStrip days={days} />
      <p className="split-count">
        {trainingCount} training {trainingCount === 1 ? 'day' : 'days'} · {7 - trainingCount} rest
      </p>

      <ul className="split-daylist">
        {days.map((d, i) => {
          const open = openDay === i;
          return (
            <li className={`split-day ${d.type === 'plan' ? 'is-training' : 'is-rest'}`} key={i}>
              <button
                type="button"
                className="split-day-head"
                onClick={() => { setOpenDay(open ? null : i); setExFilter(null); }}
                aria-expanded={open}
              >
                <span className="split-day-name">{DAY_FULL[i]}</span>
                <span className="split-day-sum">
                  {d.type === 'plan'
                    ? `${(d.exercises || []).length} exercise${(d.exercises || []).length === 1 ? '' : 's'}`
                    : 'Rest'}
                </span>
                <span className={`split-day-chev ${open ? 'is-open' : ''}`} aria-hidden="true">
                  {icon('chevron', 16)}
                </span>
              </button>

              {open && (
                <div className="split-day-body">
                  <div className="split-toggle" role="group" aria-label={`${DAY_FULL[i]} type`}>
                    <button
                      type="button"
                      className={`split-toggle-btn ${d.type === 'rest' ? 'is-active' : ''}`}
                      onClick={() => setRest(i)}
                      aria-pressed={d.type === 'rest'}
                    >
                      Rest day
                    </button>
                    <button
                      type="button"
                      className={`split-toggle-btn ${d.type === 'plan' ? 'is-active' : ''}`}
                      onClick={() => setTraining(i)}
                      aria-pressed={d.type === 'plan'}
                    >
                      Training day
                    </button>
                  </div>

                  {d.type === 'plan' && (
                    <>
                      <div className="split-field">
                        <label htmlFor={`split-dayname-${i}`}>Session name</label>
                        <input
                          id={`split-dayname-${i}`}
                          className="split-input"
                          value={d.planName || ''}
                          onChange={(e) => patchDay(i, { planName: e.target.value })}
                          placeholder={`${DAY_FULL[i]} session`}
                          autoComplete="off"
                        />
                      </div>

                      {userPlans.length > 0 && (
                        <div className="split-field">
                          <label htmlFor={`split-useplan-${i}`}>Use an existing plan</label>
                          <select
                            id={`split-useplan-${i}`}
                            className="split-input"
                            value=""
                            onChange={(e) => { if (e.target.value) applyExistingPlan(i, e.target.value); }}
                          >
                            <option value="">Copy exercises from…</option>
                            {userPlans.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <p className="split-hint">
                            Copies the exercises in. Editing that plan later won’t change this split.
                          </p>
                        </div>
                      )}

                      {/* Same picker as PlannerPage's create-plan flow. */}
                      <div className="split-picker">
                        <div className="split-filters">
                          <button
                            type="button"
                            className={`split-filter ${!exFilter ? 'is-active' : ''}`}
                            onClick={() => setExFilter(null)}
                          >
                            All
                          </button>
                          {MUSCLE_GROUPS.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              className={`split-filter ${exFilter === g.id ? 'is-active' : ''}`}
                              onClick={() => setExFilter(g.id)}
                            >
                              {g.label}
                            </button>
                          ))}
                        </div>

                        <div className="split-exlist">
                          {catalogue.filter((ex) => matchesMuscleGroup(ex, exFilter)).map((ex) => (
                            <label key={ex.id} className="plan-ex-item">
                              <input
                                type="checkbox"
                                value={ex.id}
                                className="cp-exercise"
                                checked={(d.exercises || []).some((e) => e.id === ex.id)}
                                onChange={() => toggleExercise(i, ex.id)}
                              />
                              <span className="plan-ex-name">{ex.name}</span>
                              <span className="plan-ex-muscles">{ex.muscles}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {error && <p className="split-error" role="alert">{error}</p>}

      <div className="split-actions">
        <button type="button" className="split-btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          className="split-btn is-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : <>{icon('check', 15)} Save split</>}
        </button>
      </div>
    </div>
  );
}

/**
 * Seven day-chips in a row. The one new visual pattern in this feature —
 * training days carry the accent, rest days stay muted, so the shape of a week
 * is readable at a glance without reading any text.
 */
export function WeekStrip({ days, compact = false }) {
  return (
    <ul className={`split-strip ${compact ? 'is-compact' : ''}`} aria-label="Week overview">
      {DAY_LABELS.map((label, i) => {
        const d = (days || [])[i];
        const training = d?.type === 'plan';
        return (
          <li
            key={i}
            className={`split-chip ${training ? 'is-training' : 'is-rest'}`}
            title={training ? (d.planName || 'Training') : 'Rest'}
          >
            <span className="split-chip-day">{label}</span>
            <span className="split-chip-dot" aria-hidden="true" />
            <span className="split-chip-sr">
              {training ? `${d.planName || 'Training'}` : 'Rest day'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export { DAY_FULL, DAY_LABELS };
