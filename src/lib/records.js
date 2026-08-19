/**
 * Shared formatting for personal records.
 *
 * The compact form — "90 kg x 8 reps" — is what fits in a badge or a row on a
 * phone. It was written twice (Profile and Today) before this existed; the
 * Records screen deliberately keeps its own longer variant that leads with the
 * set count, because there the row has the width for it.
 *
 * Record shape (see store.js / personalRecordsApi.js):
 *   weight      → value = kg, secondary_value = reps, tertiary_value = sets
 *   cardio_sets → value = sets, secondary_value = minutes, tertiary_value = km
 */
export function formatRecordValue(r) {
  if (!r) return '';
  if (r.category === 'cardio') {
    const dist = r.tertiary_value ? ` • ${r.tertiary_value} ${r.tertiary_unit || 'km'}` : '';
    return `${r.value} sets • ${r.secondary_value || 0} ${r.secondary_unit || 'min'}${dist}`;
  }
  if (r.metric_type === 'weight') {
    return `${r.value} kg${r.secondary_value ? ` x ${r.secondary_value} reps` : ''}`;
  }
  return `${r.value} ${r.unit || ''}`.trim();
}

/**
 * Glyph for a record, by discipline. A repeated trophy on every row carries no
 * information and reads as a smudge at 20px; the discipline icon tells you what
 * kind of lift it was at a glance and gives the list some variety.
 */
export function recordIconKey(r) {
  switch (r?.category) {
    case 'cardio': return 'stopwatch';
    case 'fitness': return 'peak';
    default: return 'medal';
  }
}

/** Newest-first, capped. Used wherever "recent records" is shown. */
export function recentRecords(records = [], limit = 3) {
  return [...(records || [])]
    .sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at))
    .slice(0, limit);
}
