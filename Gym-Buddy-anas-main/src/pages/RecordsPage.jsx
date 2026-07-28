import { useMemo, useState, useEffect, useRef } from 'react';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { getAllExercises } from '../data.js';
import { Toast } from '../lib/interactions.js';
import { upsertPersonalRecords, deletePersonalRecord } from '../services/personalRecordsApi.js';
import { revealOnScroll } from '../lib/motion.js';
import AppHeader from '../components/AppHeader.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const categoryLabels = {
  all: 'All',
  strength: 'Strength',
  fitness: 'Fitness',
  cardio: 'Cardio',
};

const categoryIcon = {
  strength: 'dumbbell',
  fitness: 'zap',
  cardio: 'activity',
};

function categoryForExerciseId(id) {
  if (id?.startsWith('c')) return 'cardio';
  if (id?.startsWith('f')) return 'fitness';
  return 'strength';
}

export default function RecordsPage() {
  const rootRef = useRef(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [formCategory, setFormCategory] = useState('');
  const [editingRecord, setEditingRecord] = useState(null);
  /** Record queued for deletion — drives the ConfirmDialog. */
  const [pendingDelete, setPendingDelete] = useState(null);
  const records = Store.get('records') || [];
  const exercises = getAllExercises();

  const grouped = useMemo(() => {
    const filtered = activeCategory === 'all'
      ? records
      : records.filter((r) => r.category === activeCategory);
    return [...filtered].sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at));
  }, [records, activeCategory]);

  const formExercises = useMemo(() => {
    if (!formCategory) return [];
    return exercises.filter((e) => categoryForExerciseId(e.id) === formCategory);
  }, [exercises, formCategory]);

  const editFormExercises = useMemo(() => {
    const cat = editingRecord?.category;
    if (!cat) return [];
    return exercises.filter((e) => categoryForExerciseId(e.id) === cat);
  }, [exercises, editingRecord]);

  const counts = useMemo(() => {
    const c = { all: records.length, strength: 0, fitness: 0, cardio: 0 };
    records.forEach((r) => { if (c[r.category] !== undefined) c[r.category] += 1; });
    return c;
  }, [records]);

  const latest = useMemo(() => {
    if (records.length === 0) return null;
    return [...records].sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at))[0];
  }, [records]);

  useEffect(() => {
    const cleanup = revealOnScroll(rootRef.current, '[data-reveal]');
    return cleanup;
  }, [activeCategory, grouped.length]);

  function formatRecordBadge(r) {
    const cat = r.category;
    if (cat === 'cardio') {
      const dist = r.tertiary_value ? ` • ${r.tertiary_value} ${r.tertiary_unit || 'km'}` : '';
      return `${r.value} sets • ${r.secondary_value || 0} ${r.secondary_unit || 'min'}${dist}`;
    }
    if (r.metric_type === 'weight') {
      return `${r.tertiary_value || 0} sets • ${r.value} kg${r.secondary_value ? ` x ${r.secondary_value} reps` : ''}`;
    }
    return `${r.value} ${r.unit || 'reps'}${r.secondary_value ? ` x ${r.secondary_value}` : ''}`;
  }

  function updateProgressPersonalRecordLabel(record, shouldSet) {
    if (record.metric_type !== 'weight') return;
    Store.update('progressData', (p) => {
      const prs = { ...(p.personalRecords || {}) };
      if (!shouldSet) {
        delete prs[record.exercise_name];
        return { ...p, personalRecords: prs };
      }
      const sets = Number(record.tertiary_value || 0);
      const reps = Number(record.secondary_value || 0);
      const weight = Number(record.value || 0);
      prs[record.exercise_name] = `${weight} kg${reps > 0 ? ` x ${reps} reps` : ''}${sets > 0 ? ` • ${sets} sets` : ''}`;
      return { ...p, personalRecords: prs };
    });
  }

  function handleAddRecord(ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const category = String(fd.get('record-category') || '');
    const exerciseId = String(fd.get('record-exercise') || '');
    const value = Number(fd.get('record-value') || 0);
    const secondary = Number(fd.get('record-secondary') || 0);
    const sets = Number(fd.get('record-sets') || 0);
    const distance = Number(fd.get('record-distance') || 0);
    if (!exerciseId || !value) {
      Toast.show('Please choose an exercise and value.', 'warning');
      return;
    }
    if (!category) {
      Toast.show('Please select workout type first.', 'warning');
      return;
    }
    if (category !== 'cardio' && (!Number.isFinite(sets) || sets <= 0)) {
      Toast.show('Please enter Sets.', 'warning');
      return;
    }
    if (category !== 'cardio' && (!Number.isFinite(secondary) || secondary <= 0)) {
      Toast.show('Please enter Reps.', 'warning');
      return;
    }
    if (category === 'cardio' && (!Number.isFinite(value) || value <= 0)) {
      Toast.show('Please enter Sets.', 'warning');
      return;
    }
    const exercise = exercises.find((e) => e.id === exerciseId);
    if (!exercise) return;
    const metricType = category === 'cardio' ? 'cardio_sets' : 'weight';
    const nextRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      exercise_id: exerciseId,
      exercise_name: exercise.name,
      category,
      metric_type: metricType,
      value,
      unit: category === 'cardio' ? 'sets' : 'kg',
      secondary_value: secondary > 0 ? secondary : null,
      secondary_unit: secondary > 0 ? (category === 'cardio' ? 'min' : 'reps') : null,
      tertiary_value: category === 'cardio' ? (distance > 0 ? distance : null) : (sets > 0 ? sets : null),
      tertiary_unit: category === 'cardio' ? (distance > 0 ? 'km' : null) : (sets > 0 ? 'sets' : null),
      recorded_at: new Date().toISOString(),
      source: 'manual',
    };

    const current = records.find((r) => r.exercise_id === nextRecord.exercise_id && r.metric_type === nextRecord.metric_type) || null;
    const isBetter = (() => {
      if (!current) return true;
      if (nextRecord.metric_type === 'weight') {
        const cw = Number(current.value || 0);
        const cc = Number(current.secondary_value || 0);
        const cs = Number(current.tertiary_value || 0);
        const tw = Number(nextRecord.value || 0);
        const tc = Number(nextRecord.secondary_value || 0);
        const ts = Number(nextRecord.tertiary_value || 0);
        return tw > cw || (tw === cw && (tc > cc || (tc === cc && ts > cs)));
      }
      if (nextRecord.metric_type === 'cardio_sets') {
        const cTime = Number(current.secondary_value || 0);
        const cDist = Number(current.tertiary_value || 0);
        const cSets = Number(current.value || 0);
        const tTime = Number(nextRecord.secondary_value || 0);
        const tDist = Number(nextRecord.tertiary_value || 0);
        const tSets = Number(nextRecord.value || 0);
        return tTime > cTime || (tTime === cTime && (tDist > cDist || (tDist === cDist && tSets > cSets)));
      }
      return Number(nextRecord.value || 0) > Number(current.value || 0);
    })();
    Store.update('records', (cur) => {
      const list = [...(cur || [])];
      const idx = list.findIndex((r) => r.exercise_id === nextRecord.exercise_id && r.metric_type === nextRecord.metric_type);
      if (idx === -1) return [...list, nextRecord];
      const old = list[idx];
      if (!isBetter) return list;
      list[idx] = { ...old, ...nextRecord, id: old.id };
      return list;
    });
    if (metricType === 'weight') {
      Store.update('progressData', (p) => {
        const prs = { ...(p.personalRecords || {}) };
        const label = `${value} kg${secondary > 0 ? ` x ${secondary} reps` : ''}${sets > 0 ? ` • ${sets} sets` : ''}`;
        prs[exercise.name] = label;
        return { ...p, personalRecords: prs };
      });
    }

    const user = Store.get('user');
    const shouldPersist = metricType && user?.source === 'supabase' && user?.id && isBetter;
    if (shouldPersist) {
      void upsertPersonalRecords([nextRecord]).then(({ error }) => {
        if (error) {
          Toast.show('Record saved, but could not update your account right now.', 'warning', 4500);
        }
      }).catch(() => {
        Toast.show('Record saved, but could not update your account right now.', 'warning', 4500);
      });
    }
    setFormCategory('');
    setShowAdd(false);
    Toast.show(isBetter ? 'New personal record saved!' : 'Record saved.', 'success');
  }

  function handleStartEdit(record) {
    setEditingRecord({ ...record });
  }

  function handleEditChange(field, value) {
    setEditingRecord((cur) => (cur ? { ...cur, [field]: value } : cur));
  }

  function handleSaveEdit(ev) {
    ev.preventDefault();
    if (!editingRecord) return;
    const category = editingRecord.category;
    const value = Number(editingRecord.value || 0);
    const secondary = Number(editingRecord.secondary_value || 0);
    const tertiary = Number(editingRecord.tertiary_value || 0);

    if (!editingRecord.exercise_id || !editingRecord.exercise_name) {
      Toast.show('Please choose an exercise.', 'warning');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      Toast.show(category === 'cardio' ? 'Please enter Sets.' : 'Please enter Weight.', 'warning');
      return;
    }
    if (category !== 'cardio' && (!Number.isFinite(secondary) || secondary <= 0)) {
      Toast.show('Please enter Reps.', 'warning');
      return;
    }
    if (category !== 'cardio' && (!Number.isFinite(tertiary) || tertiary <= 0)) {
      Toast.show('Please enter Sets.', 'warning');
      return;
    }

    const normalized = {
      ...editingRecord,
      value,
      secondary_value: Number.isFinite(secondary) && secondary > 0 ? secondary : null,
      tertiary_value: Number.isFinite(tertiary) && tertiary > 0 ? tertiary : null,
      recorded_at: new Date().toISOString(),
      source: editingRecord.source || 'manual',
    };

    Store.update('records', (cur) =>
      (cur || []).map((r) => (String(r.id) === String(normalized.id) ? { ...r, ...normalized } : r))
    );
    updateProgressPersonalRecordLabel(normalized, true);

    const user = Store.get('user');
    if (user?.source === 'supabase' && user?.id) {
      void upsertPersonalRecords([normalized]).then(({ error }) => {
        if (error) Toast.show('Edited locally. Could not update account now.', 'warning', 4500);
      }).catch(() => {
        Toast.show('Edited locally. Could not update account now.', 'warning', 4500);
      });
    }

    setEditingRecord(null);
    Toast.show('Record updated.', 'success');
  }

  function handleConfirmDelete() {
    const record = pendingDelete;
    if (!record) return;

    // Dropping it from `records` is enough for the Progress page's PR list too:
    // Store.update recomputes progressData.personalRecords from `records`.
    Store.update('records', (cur) => (cur || []).filter((r) => String(r.id) !== String(record.id)));

    const user = Store.get('user');
    if (user?.source === 'supabase' && user?.id) {
      void deletePersonalRecord(record).then(({ error }) => {
        if (error) Toast.show('Removed here. Could not update your account now.', 'warning', 4500);
      }).catch(() => {
        Toast.show('Removed here. Could not update your account now.', 'warning', 4500);
      });
    }

    setPendingDelete(null);
    Toast.show('Record deleted.', 'info', 1800);
  }

  return (
    <div className="rec" ref={rootRef}>
      {/* ===== Header ===== */}
      <AppHeader
        eyebrow={<>{icon('trophy', 13)} Achievements</>}
        title="Personal Records"
        subtitle="Your best lifts, reps, cardio, and fitness milestones."
        action={
          <button type="button" className="gx-btn gx-btn-primary" onClick={() => setShowAdd(true)}>
            {icon('plus', 15)} Add Record
          </button>
        }
      />

      {/* ===== Summary ===== */}
      <div className="rec-summary" data-reveal>
        <div className="rec-summary-item">
          <span className="rec-summary-val rec-accent">{records.length}</span>
          <span className="rec-summary-label">Total PRs</span>
        </div>
        <div className="rec-summary-div" aria-hidden="true" />
        <div className="rec-summary-item">
          <span className="rec-summary-val">{counts.strength}</span>
          <span className="rec-summary-label">Strength</span>
        </div>
        <div className="rec-summary-div" aria-hidden="true" />
        <div className="rec-summary-item">
          <span className="rec-summary-val">{counts.cardio}</span>
          <span className="rec-summary-label">Cardio</span>
        </div>
        {latest ? (
          <>
            <div className="rec-summary-div rec-summary-div-wide" aria-hidden="true" />
            <div className="rec-summary-latest">
              <span className="rec-summary-label">Latest</span>
              <span className="rec-summary-latest-name">{latest.exercise_name}</span>
            </div>
          </>
        ) : null}
      </div>

      {/* ===== Filter chips ===== */}
      <div className="rec-filters" data-reveal>
        {Object.keys(categoryLabels).map((key) => (
          <button
            key={key}
            type="button"
            className={`rec-chip ${activeCategory === key ? 'is-active' : ''}`}
            onClick={() => setActiveCategory(key)}
          >
            {categoryLabels[key]}
            <span className="rec-chip-count">{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* ===== Records grid ===== */}
      {grouped.length === 0 ? (
        <div className="rec-empty" data-reveal>
          <div className="rec-empty-icon">{icon('trophy', 44)}</div>
          <p className="rec-empty-title">No records yet</p>
          <p className="rec-empty-desc">
            Add one manually or complete a workout session to auto-create records.
          </p>
          <button type="button" className="gx-btn gx-btn-primary" onClick={() => setShowAdd(true)}>
            {icon('plus', 15)} Add Your First Record
          </button>
        </div>
      ) : (
        <div className="rec-grid">
          {grouped.map((r) => (
            <article key={r.id} className="gx-card rec-card" data-reveal>
              <div className="rec-card-top">
                <span className={`rec-card-cat cat-${r.category}`}>
                  {icon(categoryIcon[r.category] || 'trophy', 13)} {categoryLabels[r.category] || 'Training'}
                </span>
                <div className="rec-card-acts">
                  <button
                    type="button"
                    className="rec-card-edit"
                    onClick={() => handleStartEdit(r)}
                    aria-label={`Edit ${r.exercise_name}`}
                  >
                    {icon('edit', 15)}
                  </button>
                  <button
                    type="button"
                    className="rec-card-del"
                    onClick={() => setPendingDelete(r)}
                    aria-label={`Delete ${r.exercise_name} record`}
                  >
                    {icon('trash', 15)}
                  </button>
                </div>
              </div>
              <h3 className="rec-card-name">{r.exercise_name}</h3>
              <div className="rec-card-badge">{icon('trophy', 14)} {formatRecordBadge(r)}</div>
              <div className="rec-card-date">
                {icon('calendar', 12)} {new Date(r.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ===== Add record modal ===== */}
      {showAdd && (
        <div className="gx-modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="gx-modal" role="dialog" aria-modal="true" aria-label="Add personal record">
            <div className="gx-modal-head">
              <h2>Add Personal Record</h2>
              <button type="button" className="gx-modal-close" onClick={() => setShowAdd(false)} aria-label="Close">
                {icon('x', 18)}
              </button>
            </div>
            <form className="gx-modal-form" onSubmit={handleAddRecord}>
              <label className="prof-field">
                <span>Workout type</span>
                <select
                  name="record-category"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  required
                >
                  <option value="">Select type</option>
                  <option value="strength">Strength</option>
                  <option value="fitness">Fitness</option>
                  <option value="cardio">Cardio</option>
                </select>
              </label>
              <label className="prof-field">
                <span>Exercise</span>
                <select name="record-exercise" required disabled={!formCategory}>
                  <option value="">Select exercise</option>
                  {formExercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
              <div className="rec-form-row">
                {formCategory === 'cardio' ? (
                  <>
                    <label className="prof-field">
                      <span>Sets</span>
                      <input type="number" step="1" name="record-value" required />
                    </label>
                    <label className="prof-field">
                      <span>Time (min)</span>
                      <input type="number" step="1" name="record-secondary" />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="prof-field">
                      <span>Weight (kg)</span>
                      <input type="number" step="0.1" name="record-value" required />
                    </label>
                    <label className="prof-field">
                      <span>Reps</span>
                      <input type="number" step="1" name="record-secondary" required />
                    </label>
                  </>
                )}
              </div>
              {formCategory !== 'cardio' ? (
                <label className="prof-field">
                  <span>Sets</span>
                  <input type="number" step="1" name="record-sets" required />
                </label>
              ) : (
                <label className="prof-field">
                  <span>Distance (km) — optional</span>
                  <input type="number" step="0.1" name="record-distance" />
                </label>
              )}
              <button type="submit" className="gx-btn gx-btn-primary" style={{ width: '100%' }}>
                {icon('check', 15)} Save Record
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Edit record modal ===== */}
      {editingRecord && (
        <div className="gx-modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setEditingRecord(null); }}>
          <div className="gx-modal" role="dialog" aria-modal="true" aria-label="Edit record">
            <div className="gx-modal-head">
              <h2>Edit Record</h2>
              <button type="button" className="gx-modal-close" onClick={() => setEditingRecord(null)} aria-label="Close">
                {icon('x', 18)}
              </button>
            </div>
            <form className="gx-modal-form" onSubmit={handleSaveEdit}>
              <label className="prof-field">
                <span>Workout type</span>
                <select value={editingRecord.category} onChange={(e) => handleEditChange('category', e.target.value)} disabled>
                  <option value="strength">Strength</option>
                  <option value="fitness">Fitness</option>
                  <option value="cardio">Cardio</option>
                </select>
              </label>
              <label className="prof-field">
                <span>Exercise</span>
                <select
                  value={editingRecord.exercise_id}
                  onChange={(e) => {
                    const exerciseId = e.target.value;
                    const ex = editFormExercises.find((x) => x.id === exerciseId);
                    handleEditChange('exercise_id', exerciseId);
                    handleEditChange('exercise_name', ex?.name || editingRecord.exercise_name);
                  }}
                >
                  {editFormExercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
              <div className="rec-form-row">
                {editingRecord.category === 'cardio' ? (
                  <>
                    <label className="prof-field">
                      <span>Sets</span>
                      <input type="number" step="1" value={editingRecord.value ?? ''} onChange={(e) => handleEditChange('value', e.target.value)} required />
                    </label>
                    <label className="prof-field">
                      <span>Time (min)</span>
                      <input type="number" step="1" value={editingRecord.secondary_value ?? ''} onChange={(e) => handleEditChange('secondary_value', e.target.value)} />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="prof-field">
                      <span>Weight (kg)</span>
                      <input type="number" step="0.1" value={editingRecord.value ?? ''} onChange={(e) => handleEditChange('value', e.target.value)} required />
                    </label>
                    <label className="prof-field">
                      <span>Reps</span>
                      <input type="number" step="1" value={editingRecord.secondary_value ?? ''} onChange={(e) => handleEditChange('secondary_value', e.target.value)} required />
                    </label>
                  </>
                )}
              </div>
              {editingRecord.category !== 'cardio' ? (
                <label className="prof-field">
                  <span>Sets</span>
                  <input type="number" step="1" value={editingRecord.tertiary_value ?? ''} onChange={(e) => handleEditChange('tertiary_value', e.target.value)} required />
                </label>
              ) : (
                <label className="prof-field">
                  <span>Distance (km) — optional</span>
                  <input type="number" step="0.1" value={editingRecord.tertiary_value ?? ''} onChange={(e) => handleEditChange('tertiary_value', e.target.value)} />
                </label>
              )}
              <button type="submit" className="gx-btn gx-btn-primary" style={{ width: '100%' }}>
                {icon('check', 15)} Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete this record?"
        subject={pendingDelete ? `${pendingDelete.exercise_name} · ${formatRecordBadge(pendingDelete)}` : ''}
        note="The PR disappears from your records and from your Progress summary. Your logged sessions stay untouched. This can't be undone."
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  );
}
