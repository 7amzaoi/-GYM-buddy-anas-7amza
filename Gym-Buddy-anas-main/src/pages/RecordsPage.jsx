import { useMemo, useState } from 'react';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { getAllExercises } from '../data.js';
import { Toast } from '../lib/interactions.js';
import { upsertPersonalRecords } from '../services/personalRecordsApi.js';

const categoryLabels = {
  all: 'All',
  strength: 'Strength',
  fitness: 'Fitness',
  cardio: 'Cardio',
};

function categoryForExerciseId(id) {
  if (id?.startsWith('c')) return 'cardio';
  if (id?.startsWith('f')) return 'fitness';
  return 'strength';
}

export default function RecordsPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [formCategory, setFormCategory] = useState('');
  const [editingRecord, setEditingRecord] = useState(null);
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
    Toast.show('Record saved.', 'success');
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

  return (
    <>
      <div className="page-header animate-fade" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>{icon('trophy', 24)} Personal Records</h1>
          <p>Your best lifts, reps, cardio, and fitness milestones.</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          {icon('plus', 14)} Add Record
        </button>
      </div>

      <div className="card animate-slide-up delay-1" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {Object.keys(categoryLabels).map((key) => (
            <button
              key={key}
              type="button"
              className={`btn btn-sm ${activeCategory === key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveCategory(key)}
            >
              {categoryLabels[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="card animate-slide-up delay-2">
        {grouped.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No records yet. Add one or complete a session to auto-create records.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {grouped.map((r) => (
              <div key={r.id} className="exercise-item">
                <div className="stat-icon">{icon('trophy', 16)}</div>
                <div className="exercise-info">
                  <h4>{r.exercise_name}</h4>
                  <p>{categoryLabels[r.category] || 'Training'} · {new Date(r.recorded_at).toLocaleDateString()}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleStartEdit(r)}
                  style={{ marginRight: '8px' }}
                >
                  {icon('edit', 14)}
                </button>
                <span className="badge badge-accent">
                  {formatRecordBadge(r)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div id="records-add-modal" className={showAdd ? '' : 'hidden'}>
        {showAdd ? (
          <div className="modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
            <div className="modal">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Add Personal Record</h2>
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowAdd(false)}>{icon('x', 20)}</button>
              </div>
              <form onSubmit={handleAddRecord} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="input-group">
                  <label>Workout Type</label>
                  <select
                    className="input"
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
                </div>
                <div className="input-group">
                  <label>Exercise</label>
                  <select className="input" name="record-exercise" required disabled={!formCategory}>
                    <option value="">Select exercise</option>
                    {formExercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-2">
                  {formCategory === 'cardio' ? (
                    <>
                      <div className="input-group">
                        <label>Sets</label>
                        <input className="input" type="number" step="1" name="record-value" required />
                      </div>
                      <div className="input-group">
                        <label>Time (min)</label>
                        <input className="input" type="number" step="1" name="record-secondary" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="input-group">
                        <label>Weight (kg)</label>
                        <input className="input" type="number" step="0.1" name="record-value" required />
                      </div>
                      <div className="input-group">
                        <label>Reps</label>
                        <input className="input" type="number" step="1" name="record-secondary" required />
                      </div>
                    </>
                  )}
                </div>
                {formCategory !== 'cardio' ? (
                  <div className="input-group">
                    <label>Sets</label>
                    <input className="input" type="number" step="1" name="record-sets" required />
                  </div>
                ) : null}
                {formCategory === 'cardio' ? (
                  <div className="input-group">
                    <label>Distance (km) optional</label>
                    <input className="input" type="number" step="0.1" name="record-distance" />
                  </div>
                ) : null}
                <button type="submit" className="btn btn-primary">{icon('check', 16)} Save Record</button>
              </form>
            </div>
          </div>
        ) : null}
      </div>

      <div id="records-edit-modal" className={editingRecord ? '' : 'hidden'}>
        {editingRecord ? (
          <div className="modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setEditingRecord(null); }}>
            <div className="modal">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Edit Record</h2>
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => setEditingRecord(null)}>{icon('x', 20)}</button>
              </div>
              <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="input-group">
                  <label>Workout Type</label>
                  <select
                    className="input"
                    value={editingRecord.category}
                    onChange={(e) => handleEditChange('category', e.target.value)}
                    disabled
                  >
                    <option value="strength">Strength</option>
                    <option value="fitness">Fitness</option>
                    <option value="cardio">Cardio</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Exercise</label>
                  <select
                    className="input"
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
                </div>
                <div className="grid grid-2">
                  {editingRecord.category === 'cardio' ? (
                    <>
                      <div className="input-group">
                        <label>Sets</label>
                        <input
                          className="input"
                          type="number"
                          step="1"
                          value={editingRecord.value ?? ''}
                          onChange={(e) => handleEditChange('value', e.target.value)}
                          required
                        />
                      </div>
                      <div className="input-group">
                        <label>Time (min)</label>
                        <input
                          className="input"
                          type="number"
                          step="1"
                          value={editingRecord.secondary_value ?? ''}
                          onChange={(e) => handleEditChange('secondary_value', e.target.value)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="input-group">
                        <label>Weight (kg)</label>
                        <input
                          className="input"
                          type="number"
                          step="0.1"
                          value={editingRecord.value ?? ''}
                          onChange={(e) => handleEditChange('value', e.target.value)}
                          required
                        />
                      </div>
                      <div className="input-group">
                        <label>Reps</label>
                        <input
                          className="input"
                          type="number"
                          step="1"
                          value={editingRecord.secondary_value ?? ''}
                          onChange={(e) => handleEditChange('secondary_value', e.target.value)}
                          required
                        />
                      </div>
                    </>
                  )}
                </div>
                {editingRecord.category !== 'cardio' ? (
                  <div className="input-group">
                    <label>Sets</label>
                    <input
                      className="input"
                      type="number"
                      step="1"
                      value={editingRecord.tertiary_value ?? ''}
                      onChange={(e) => handleEditChange('tertiary_value', e.target.value)}
                      required
                    />
                  </div>
                ) : (
                  <div className="input-group">
                    <label>Distance (km) optional</label>
                    <input
                      className="input"
                      type="number"
                      step="0.1"
                      value={editingRecord.tertiary_value ?? ''}
                      onChange={(e) => handleEditChange('tertiary_value', e.target.value)}
                    />
                  </div>
                )}
                <button type="submit" className="btn btn-primary">{icon('check', 16)} Save Changes</button>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
