import { supabase } from '../lib/supabaseClient.js';

function categoryForExerciseId(id) {
  if (id?.startsWith('c')) return 'cardio';
  if (id?.startsWith('f')) return 'fitness';
  return 'strength';
}

function toInt(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toFloat(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function getAuthedUser() {
  if (!supabase) return { user: null, error: new Error('Supabase not configured') };
  const { data, error } = await supabase.auth.getUser();
  if (error) return { user: null, error };
  return { user: data?.user ?? null, error: null };
}

function mapRecordToRow(record) {
  const metricType = record?.metric_type;

  // Current app record shape:
  // - weight records: metric_type='weight', value=weight_kg, secondary_value=reps, tertiary_value=sets
  // - cardio records: metric_type='cardio_sets', value=sets, secondary_value=time_min, tertiary_value=distance_km
  if (metricType === 'cardio_sets') {
    return {
      exercise_id: record.exercise_id,
      exercise_name: record.exercise_name,
      category: record.category || categoryForExerciseId(record.exercise_id),
      metric_type: metricType,
      sets: toInt(record.value),
      time_min: toFloat(record.secondary_value),
      distance_km: toFloat(record.tertiary_value),
      weight_kg: null,
      reps: null,
      recorded_at: record.recorded_at || new Date().toISOString(),
      source: record.source || 'manual',
    };
  }

  return {
    exercise_id: record.exercise_id,
    exercise_name: record.exercise_name,
    category: record.category || categoryForExerciseId(record.exercise_id),
    metric_type: metricType || 'weight',
    sets: toInt(record.tertiary_value),
    weight_kg: toFloat(record.value),
    reps: toInt(record.secondary_value),
    time_min: null,
    distance_km: null,
    recorded_at: record.recorded_at || new Date().toISOString(),
    source: record.source || 'manual',
  };
}

export async function upsertPersonalRecords(records) {
  if (!supabase) return { error: new Error('Supabase not configured') };
  const list = Array.isArray(records) ? records : [];
  if (list.length === 0) return { error: null };

  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user?.id) return { error: userErr ?? new Error('Not authenticated') };

  const rows = list
    .filter((r) => r && r.exercise_id)
    .map((r) => ({ user_id: user.id, ...mapRecordToRow(r) }));

  const { error } = await supabase.from('personal_records').upsert(rows, {
    onConflict: 'user_id,exercise_id,metric_type',
  });

  return { error: error ?? null };
}

export async function deletePersonalRecord(record) {
  if (!supabase) return { error: new Error('Supabase not configured') };
  if (!record?.exercise_id) return { error: new Error('Missing exercise_id') };

  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user?.id) return { error: userErr ?? new Error('Not authenticated') };

  // Matched on the same key `upsertPersonalRecords` conflicts on, not on the
  // local `id`: records added in-app carry a client-generated `rec_*` id that
  // is never written to the table, so deleting by id would silently no-op and
  // the record would reappear on the next sync.
  const { error } = await supabase
    .from('personal_records')
    .delete()
    .eq('user_id', user.id)
    .eq('exercise_id', record.exercise_id)
    .eq('metric_type', record.metric_type || 'weight');

  return { error: error ?? null };
}

export async function loadPersonalRecords(userId) {
  if (!supabase) return { records: [], error: new Error('Supabase not configured') };
  if (!userId) return { records: [], error: new Error('Missing userId') };

  const { data, error } = await supabase
    .from('personal_records')
    .select('id,exercise_id,exercise_name,category,metric_type,sets,weight_kg,reps,time_min,distance_km,recorded_at,source')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false });

  if (error) return { records: [], error };

  const records = (data || []).map((row) => {
    if (row.metric_type === 'cardio_sets') {
      return {
        id: row.id,
        exercise_id: row.exercise_id,
        exercise_name: row.exercise_name,
        category: row.category,
        metric_type: row.metric_type,
        value: row.sets,
        secondary_value: row.time_min,
        secondary_unit: 'min',
        tertiary_value: row.distance_km,
        tertiary_unit: 'km',
        recorded_at: row.recorded_at,
        source: row.source,
      };
    }

    return {
      id: row.id,
      exercise_id: row.exercise_id,
      exercise_name: row.exercise_name,
      category: row.category,
      metric_type: row.metric_type,
      value: row.weight_kg,
      unit: 'kg',
      secondary_value: row.reps,
      secondary_unit: 'reps',
      tertiary_value: row.sets,
      tertiary_unit: 'sets',
      recorded_at: row.recorded_at,
      source: row.source,
    };
  });

  return { records, error: null };
}

