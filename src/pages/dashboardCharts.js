/** Weekly performance SVG (legacy string template — tooltips rely on globals). */

export function renderPerfAreaChart(data, unit) {
  if (!data || data.length === 0) data = [0, 0, 0, 0, 0, 0, 0];
  // Build day labels relative to today: index 0 = 6 days ago … index 6 = today.
  const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const dayLabels = Array.from({ length: data.length }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (data.length - 1 - i));
    return dowNames[d.getDay()];
  });
  const W = 700, H = 240, padL = 55, padR = 20, padT = 15, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxVal = Math.max(...data, 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal || 1)));
  const niceMax = Math.ceil(maxVal / magnitude) * magnitude || 15;
  const yTicks = 4;

  const points = data.map((v, i) => {
    const x = padL + (i / (data.length - 1)) * chartW;
    const y = padT + chartH - (v / niceMax) * chartH;
    return { x, y, val: v };
  });

  function smoothPath(pts) {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const tension = 0.35;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  const linePath = smoothPath(points);
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${padT + chartH} L ${points[0].x} ${padT + chartH} Z`;

  let gridLines = '';
  for (let i = 0; i <= yTicks; i++) {
    const y = padT + (i / yTicks) * chartH;
    const val = Math.round(niceMax - (i / yTicks) * niceMax);
    gridLines += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    gridLines += `<text x="${padL - 12}" y="${y + 4}" fill="rgba(255,255,255,0.3)" font-size="11" text-anchor="end" font-family="Rajdhani">${val.toLocaleString()}</text>`;
  }

  let xLabels = '';
  points.forEach((p, i) => {
    xLabels += `<text x="${p.x}" y="${H - 4}" fill="rgba(255,255,255,0.4)" font-size="12" text-anchor="middle" font-family="Rajdhani">${dayLabels[i]}</text>`;
  });

  let hoverTargets = '';
  points.forEach((p, i) => {
    hoverTargets += `
      <line x1="${p.x}" y1="${padT}" x2="${p.x}" y2="${padT + chartH}" stroke="rgba(212,255,0,0)" stroke-width="1" stroke-dasharray="4 4" class="perf-vline" data-idx="${i}"/>
      <circle cx="${p.x}" cy="${p.y}" r="5" fill="var(--accent)" stroke="#0B0B0B" stroke-width="2.5" opacity="0" class="perf-dot" data-idx="${i}"/>
      <rect x="${p.x - chartW / (data.length * 2)}" y="${padT}" width="${chartW / data.length}" height="${chartH}" fill="transparent" class="perf-hover-zone"
        onmouseenter="showPerfTooltip(${i},${p.val},'${unit}',${p.x},${p.y})"
        onmouseleave="hidePerfTooltip(${i})"
      />`;
  });

  const dbIcon = `<g transform="translate(${W - 55}, 10)" opacity="0.08">
    <circle cx="0" cy="10" r="8" stroke="white" stroke-width="2" fill="none"/>
    <circle cx="30" cy="10" r="8" stroke="white" stroke-width="2" fill="none"/>
    <line x1="8" y1="10" x2="22" y2="10" stroke="white" stroke-width="3"/>
  </g>`;

  return `
  <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:100%" id="perf-svg">
    <defs>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.5"/>
        <stop offset="80%" stop-color="var(--accent)" stop-opacity="0.05"/>
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.8"/>
        <stop offset="50%" stop-color="var(--accent)" stop-opacity="1"/>
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.6"/>
      </linearGradient>
    </defs>
    ${gridLines}
    ${xLabels}
    ${dbIcon}
    <path d="${areaPath}" fill="url(#areaGrad)" class="perf-area-path"/>
    <path d="${linePath}" fill="none" stroke="url(#lineGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="perf-line-path"/>
    ${hoverTargets}
  </svg>
  <div id="perf-tooltip" style="position:absolute;pointer-events:none;opacity:0;transition:opacity .15s ease;
    background:rgba(20,20,20,.95);backdrop-filter:blur(12px);border:1px solid rgba(212,255,0,.3);
    border-radius:10px;padding:8px 14px;font-size:.8rem;white-space:nowrap;z-index:10;
    box-shadow:0 4px 20px rgba(0,0,0,.5)"></div>`;
}

export function showPerfTooltip(idx, val, unit, x, y) {
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const container = document.getElementById('perf-chart-container');
  const tooltip = document.getElementById('perf-tooltip');
  const svg = document.getElementById('perf-svg');
  if (!container || !tooltip || !svg) return;

  document.querySelectorAll('.perf-dot[data-idx="' + idx + '"]').forEach(d => d.setAttribute('opacity', '1'));
  document.querySelectorAll('.perf-vline[data-idx="' + idx + '"]').forEach(l => l.setAttribute('stroke', 'rgba(212,255,0,0.25)'));

  const svgRect = svg.getBoundingClientRect();
  const scaleX = svgRect.width / 700;
  const scaleY = svgRect.height / 220;
  const px = x * scaleX;
  const py = y * scaleY;

  tooltip.innerHTML = `<div style="color:var(--accent);font-weight:700;font-size:1rem">${val.toLocaleString()} ${unit}</div><div style="color:var(--text-secondary);font-size:.7rem">${dayLabels[idx]}</div>`;
  tooltip.style.opacity = '1';
  tooltip.style.left = (px - tooltip.offsetWidth / 2) + 'px';
  tooltip.style.top = (py - tooltip.offsetHeight - 14) + 'px';
}

export function hidePerfTooltip(idx) {
  const tooltip = document.getElementById('perf-tooltip');
  if (tooltip) tooltip.style.opacity = '0';
  document.querySelectorAll('.perf-dot[data-idx="' + idx + '"]').forEach(d => d.setAttribute('opacity', '0'));
  document.querySelectorAll('.perf-vline[data-idx="' + idx + '"]').forEach(l => l.setAttribute('stroke', 'rgba(212,255,0,0)'));
}

if (typeof window !== 'undefined') {
  window.showPerfTooltip = showPerfTooltip;
  window.hidePerfTooltip = hidePerfTooltip;
}
