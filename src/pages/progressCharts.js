export function renderLineChart(data, unit, color) {
  if (!data || data.length === 0) return '<p style="color:var(--text-secondary)">No data yet</p>';
  const vals = data.map(d => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const h = 60;
  const w = 200;
  const py = 6;
  const px = 12;

  const gridLines = 3;
  const gridVals = Array.from({ length: gridLines + 1 }, (_, i) => min + (range / gridLines) * i);

  const points = data.map((d, i) => {
    const x = px + (i / Math.max(data.length - 1, 1)) * (w - px * 2);
    const y = h - py - ((d.value - min) / range) * (h - py * 2);
    return { x, y, label: d.label, value: d.value };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return `
  <div style="position:relative;height:160px">
    <svg viewBox="0 0 ${w} ${h + 10}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">
      ${gridVals.map(v => {
        const y = h - py - ((v - min) / range) * (h - py * 2);
        return `
          <line x1="${px}" y1="${y}" x2="${w - px}" y2="${y}" stroke="var(--border)" stroke-width="0.2" stroke-dasharray="1,1"/>
          <text x="${px - 2}" y="${y + 1}" fill="var(--text-secondary)" font-size="3.5" font-family="Rajdhani" text-anchor="end">${Math.round(v)}</text>
        `;
      }).join('')}
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${pathD} L ${points.at(-1).x} ${h - py} L ${points[0].x} ${h - py} Z" fill="url(#grad-${color.replace('#', '')})" opacity="0.2"/>
      <defs>
        <linearGradient id="grad-${color.replace('#', '')}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${points.map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="1.5" fill="${color}" stroke="var(--card)" stroke-width="0.6"><title>${p.value} ${unit} — ${p.label}</title></circle>
      `).join('')}
      ${points.filter((_, i) => i % Math.ceil(points.length / 5) === 0 || i === points.length - 1).map(p => `
        <text x="${p.x}" y="${h + 6}" fill="var(--text-secondary)" font-size="3" text-anchor="middle" font-family="Rajdhani">${p.label}</text>
      `).join('')}
    </svg>
  </div>`;
}

export function getWeightData(metrics, progress) {
  const fmt = (d) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  const points = [];
  for (const m of metrics || []) {
    const v = Number(m?.weight);
    if (!Number.isFinite(v)) continue;
    points.push({ value: v, label: fmt(m.date) });
  }
  if (points.length === 0) {
    for (const w of (progress?.weight || [])) {
      const v = Number(w?.value);
      if (!Number.isFinite(v)) continue;
      points.push({ value: v, label: fmt(w.date) });
    }
  }
  return points.slice(-14);
}

/**
 * Builds a real strength-index time series from the user's PR records,
 * sampling at every recorded_at timestamp. Index = Σ weight × (1 + reps/30).
 */
export function getStrengthData(records) {
  const weightRecs = (records || [])
    .filter(r => r?.metric_type === 'weight' && Number.isFinite(Date.parse(r.recorded_at)))
    .map(r => ({
      ts: Date.parse(r.recorded_at),
      exercise_id: r.exercise_id,
      weight: Number(r.value) || 0,
      reps: Number(r.secondary_value) || 1
    }))
    .sort((a, b) => a.ts - b.ts);

  if (weightRecs.length === 0) return [];

  const best = new Map();
  const series = [];
  const fmt = (ts) => new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric' });

  for (const r of weightRecs) {
    const candidate = r.weight * (1 + r.reps / 30);
    const cur = best.get(r.exercise_id) || 0;
    if (candidate > cur) best.set(r.exercise_id, candidate);
    let total = 0;
    for (const v of best.values()) total += v;
    series.push({ value: Math.round(total), label: fmt(r.ts) });
  }
  return series.slice(-14);
}

export function calculateStrengthIndex(records) {
  const weightRecs = (records || []).filter(r => r?.metric_type === 'weight');
  let total = 0;
  for (const r of weightRecs) {
    const w = Number(r.value) || 0;
    const reps = Number(r.secondary_value) || 1;
    total += w * (1 + reps / 30);
  }
  return Math.round(total);
}

export function calculateStrengthIndexAt(records, cutoffMs) {
  const weightRecs = (records || [])
    .filter(r => r?.metric_type === 'weight' && Date.parse(r.recorded_at) <= cutoffMs);
  const best = new Map();
  for (const r of weightRecs) {
    const w = Number(r.value) || 0;
    const reps = Number(r.secondary_value) || 1;
    const v = w * (1 + reps / 30);
    const cur = best.get(r.exercise_id) || 0;
    if (v > cur) best.set(r.exercise_id, v);
  }
  let total = 0;
  for (const v of best.values()) total += v;
  return Math.round(total);
}
