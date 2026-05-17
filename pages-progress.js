// ========== PROGRESS ANALYTICS PAGE ==========
function renderProgress() {
  const progress = Store.get('progressData');
  const history = Store.get('workoutHistory') || [];
  const metrics = Store.get('metricsLog') || [];
  const latestWeight = metrics.length > 0 ? metrics.at(-1).weight : (progress.weight.at(-1)?.value || 80);
  const latestBf = metrics.length > 0 ? metrics.at(-1).bodyFat : 15;
  const strengthIndex = calculateStrengthIndex(progress);

  // Weight change
  const prevWeight = metrics.length > 1 ? metrics.at(-2).weight : latestWeight;
  const weightChange = ((latestWeight - prevWeight) / prevWeight * 100).toFixed(1);

  // Body fat change
  const prevBf = metrics.length > 1 ? metrics.at(-2).bodyFat : latestBf;
  const bfChange = (latestBf - prevBf).toFixed(1);

  return `
  <div class="page-header animate-fade" style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <h1 style="text-transform:uppercase;letter-spacing:1px;font-weight:900">${icon('chart',24)} Progress Analytics</h1>
      <p>Visualize your body transformation and strength gains.</p>
    </div>
    <button class="btn btn-primary btn-sm" onclick="showLogMetrics()">+ LOG METRICS</button>
  </div>

  <!-- Top Stats Counters -->
  <div class="grid grid-3 animate-slide-up delay-1" style="margin-bottom:28px">
    <div class="progress-counter-card">
      <div class="progress-counter-header">
        <span class="progress-counter-label">Current Weight</span>
        <span class="progress-counter-icon">${icon('activity',22)}</span>
      </div>
      <div class="progress-counter-value" data-counter="${latestWeight}" data-suffix=" kg">${latestWeight} kg</div>
      <div class="progress-counter-trend ${parseFloat(weightChange) <= 0 ? 'trend-positive' : 'trend-negative'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="${parseFloat(weightChange) <= 0 ? '23 18 13.5 8.5 8.5 13.5 1 6' : '23 6 13.5 15.5 8.5 10.5 1 18'}"></polyline>
        </svg>
        ~${Math.abs(weightChange)}% this month
      </div>
    </div>

    <div class="progress-counter-card">
      <div class="progress-counter-header">
        <span class="progress-counter-label">Est. Body Fat</span>
        <span class="progress-counter-icon" style="color:#FF4757">${icon('target',22)}</span>
      </div>
      <div class="progress-counter-value">${latestBf}<span class="progress-counter-unit">%</span></div>
      <div class="progress-counter-trend ${parseFloat(bfChange) <= 0 ? 'trend-positive' : 'trend-negative'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="${parseFloat(bfChange) <= 0 ? '23 18 13.5 8.5 8.5 13.5 1 6' : '23 6 13.5 15.5 8.5 10.5 1 18'}"></polyline>
        </svg>
        ~${Math.abs(bfChange)}% this month
      </div>
    </div>

    <div class="progress-counter-card">
      <div class="progress-counter-header">
        <span class="progress-counter-label">Strength Index</span>
        <span class="progress-counter-icon" style="color:var(--accent)">${icon('zap',22)}</span>
      </div>
      <div class="progress-counter-value" style="color:var(--accent)" data-counter="${strengthIndex}">${strengthIndex}</div>
      <div class="progress-counter-trend trend-positive">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
        </svg>
        ~${(progress.totalWorkouts * 0.3).toFixed(1)}% vs last month
      </div>
    </div>
  </div>

  <!-- Workout Summary Counters -->
  <div class="grid grid-4 animate-slide-up delay-1" style="margin-bottom:28px">
    <div class="progress-counter-card progress-counter-mini">
      <div class="progress-counter-header">
        <span class="progress-counter-label">Total Workouts</span>
        <span class="progress-counter-icon-mini">${icon('dumbbell',16)}</span>
      </div>
      <div class="progress-counter-value-mini" data-counter="${progress.totalWorkouts}">${progress.totalWorkouts}</div>
      <div class="progress-counter-trend trend-positive" style="font-size:.7rem">
        +${progress.workoutsThisWeek} this week
      </div>
    </div>

    <div class="progress-counter-card progress-counter-mini">
      <div class="progress-counter-header">
        <span class="progress-counter-label">Weekly Calories</span>
        <span class="progress-counter-icon-mini" style="color:#FF4757">${icon('fire',16)}</span>
      </div>
      <div class="progress-counter-value-mini" data-counter="${progress.calories.reduce((a,c)=>a+c.value,0)}" data-suffix=" cal">${progress.calories.reduce((a,c)=>a+c.value,0)} cal</div>
      <div class="progress-counter-trend trend-positive" style="font-size:.7rem">
        ${icon('fire',12)} On track
      </div>
    </div>

    <div class="progress-counter-card progress-counter-mini">
      <div class="progress-counter-header">
        <span class="progress-counter-label">Current Streak</span>
        <span class="progress-counter-icon-mini" style="color:#FFA502">🔥</span>
      </div>
      <div class="progress-counter-value-mini" data-counter="${progress.streak}" data-suffix=" days">${progress.streak} days</div>
      <div class="progress-counter-trend trend-positive" style="font-size:.7rem">
        Keep going!
      </div>
    </div>

    <div class="progress-counter-card progress-counter-mini">
      <div class="progress-counter-header">
        <span class="progress-counter-label">Total Volume</span>
        <span class="progress-counter-icon-mini" style="color:var(--accent)">${icon('chart',16)}</span>
      </div>
      <div class="progress-counter-value-mini">${((progress.totalVolume || 0) / 1000).toFixed(1)}<span class="progress-counter-unit"> t</span></div>
      <div class="progress-counter-trend trend-positive" style="font-size:.7rem">
        Lifetime lifted
      </div>
    </div>
  </div>

  <!-- Charts Row -->
  <div class="grid grid-2 animate-slide-up delay-2" style="margin-bottom:20px">
    <!-- Weight Journey Chart -->
    <div class="card" style="padding:18px 20px">
      <h3 style="font-weight:800;text-transform:uppercase;font-size:.8rem;letter-spacing:.5px;margin-bottom:12px">Weight Journey</h3>
      <div style="max-height:180px">${renderLineChart(getWeightData(metrics, progress), 'kg', '#D4FF00')}</div>
    </div>

    <!-- Strength Progress Chart -->
    <div class="card" style="padding:18px 20px">
      <h3 style="font-weight:800;text-transform:uppercase;font-size:.8rem;letter-spacing:.5px;margin-bottom:12px">Strength Progress</h3>
      <div style="max-height:180px">${renderLineChart(getStrengthData(progress), 'idx', '#2ED573')}</div>
    </div>
  </div>

  <!-- Body Composition + PR -->
  <div class="grid grid-2 animate-slide-up delay-3" style="margin-bottom:20px">
    <!-- Body Composition -->
    <div class="card" style="padding:18px 20px">
      <h3 style="font-weight:800;text-transform:uppercase;font-size:.8rem;letter-spacing:.5px;margin-bottom:14px">Body Composition</h3>
      <div style="display:flex;align-items:center;gap:24px">
        <div style="position:relative;width:100px;height:100px;flex-shrink:0">
          <svg viewBox="0 0 120 120" style="transform:rotate(-90deg)">
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" stroke-width="10"/>
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--accent)" stroke-width="10"
              stroke-dasharray="${(100 - latestBf) / 100 * 314} 314" stroke-linecap="round"/>
            <circle cx="60" cy="60" r="50" fill="none" stroke="#FF4757" stroke-width="10"
              stroke-dasharray="${latestBf / 100 * 314} 314" stroke-dashoffset="${-(100 - latestBf) / 100 * 314}" stroke-linecap="round"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div style="font-size:1.2rem;font-weight:800">${latestBf}%</div>
            <div style="font-size:.6rem;color:var(--text-secondary)">Body Fat</div>
          </div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:12px">
          <div>
            <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:4px">
              <span style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:var(--accent)"></span>Lean Mass</span>
              <span style="font-weight:700">${(latestWeight * (1 - latestBf/100)).toFixed(1)} kg</span>
            </div>
            <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${100 - latestBf}%;background:var(--accent);border-radius:3px;transition:width .6s ease"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:4px">
              <span style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:#FF4757"></span>Fat Mass</span>
              <span style="font-weight:700">${(latestWeight * latestBf/100).toFixed(1)} kg</span>
            </div>
            <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${latestBf}%;background:#FF4757;border-radius:3px;transition:width .6s ease"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Personal Records -->
    <div class="card" style="padding:18px 20px">
      <h3 style="font-weight:800;text-transform:uppercase;font-size:.8rem;letter-spacing:.5px;margin-bottom:14px">${icon('trophy',18)} Personal Records</h3>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${Object.entries(progress.personalRecords).map(([name, val]) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-card);border-radius:10px;border:1px solid var(--border)">
            <span style="font-weight:600;font-size:.9rem">${name}</span>
            <span style="font-weight:800;color:var(--accent);font-size:1.1rem">${val}</span>
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- Calorie & Workout Volume -->
  <div class="grid grid-2 animate-slide-up delay-4" style="margin-bottom:20px">
    <div class="card" style="padding:18px 20px">
      <h3 style="font-weight:800;text-transform:uppercase;font-size:.8rem;letter-spacing:.5px;margin-bottom:14px">${icon('fire',18)} Weekly Calories</h3>
      <div class="chart-bar-group" style="height:130px">
        ${progress.calories.map(c => {
          const max = Math.max(...progress.calories.map(x => x.value), 1);
          const h = Math.max((c.value / max) * 150, 4);
          const d = new Date(c.date);
          const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          return `<div class="chart-bar" style="height:${h}px" title="${c.value} cal"><span class="chart-bar-label">${days[d.getDay()]}</span></div>`;
        }).join('')}
      </div>
    </div>

    <div class="card" style="padding:18px 20px">
      <h3 style="font-weight:800;text-transform:uppercase;font-size:.8rem;letter-spacing:.5px;margin-bottom:14px">${icon('activity',18)} Workout Summary</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="summary-row"><span>Total Workouts</span><span style="font-weight:800;color:var(--accent)">${progress.totalWorkouts}</span></div>
        <div class="summary-row"><span>This Week</span><span style="font-weight:800">${progress.workoutsThisWeek}</span></div>
        <div class="summary-row"><span>Current Streak</span><span style="font-weight:800;color:var(--accent)">${progress.streak} days 🔥</span></div>
        <div class="summary-row"><span>Total Volume</span><span style="font-weight:800">${((progress.totalVolume || 0) / 1000).toFixed(1)}t</span></div>
        <div class="summary-row"><span>Weekly Calories</span><span style="font-weight:800;color:var(--accent)">${progress.calories.reduce((a,c)=>a+c.value,0)} cal</span></div>
      </div>
    </div>
  </div>

  <!-- Workout History -->
  <div class="card animate-slide-up delay-5">
    <h3 style="font-weight:800;text-transform:uppercase;font-size:.9rem;letter-spacing:.5px;margin-bottom:16px">${icon('calendar',18)} Workout History</h3>
    ${history.length === 0 ? '<p style="color:var(--text-secondary)">Complete your first workout to see history here!</p>' :
      history.slice(0, 10).map(w => `
        <div class="exercise-item" style="margin-bottom:8px">
          <div class="stat-icon">${icon('dumbbell',18)}</div>
          <div class="exercise-info">
            <h4>${w.planName}</h4>
            <p>${new Date(w.date).toLocaleDateString()} · ${w.duration || '?'} min · ${w.calories} cal</p>
          </div>
          <span class="badge badge-success">${w.completed}/${w.exercises}</span>
        </div>
      `).join('')}
  </div>

  <!-- Log Metrics Modal -->
  <div id="log-metrics-modal" class="hidden"></div>`;
}

// ===== LINE CHART RENDERER =====
function renderLineChart(data, unit, color) {
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
  const gridVals = Array.from({length: gridLines + 1}, (_, i) => min + (range / gridLines) * i);

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
          <text x="${px - 2}" y="${y + 1}" fill="var(--text-secondary)" font-size="3.5" font-family="Inter" text-anchor="end">${Math.round(v)}</text>
        `;
      }).join('')}
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${pathD} L ${points.at(-1).x} ${h - py} L ${points[0].x} ${h - py} Z" fill="url(#grad-${color.replace('#','')})" opacity="0.2"/>
      <defs>
        <linearGradient id="grad-${color.replace('#','')}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${points.map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="1.5" fill="${color}" stroke="var(--card)" stroke-width="0.6"><title>${p.value} ${unit} — ${p.label}</title></circle>
      `).join('')}
      ${points.filter((_, i) => i % Math.ceil(points.length / 5) === 0 || i === points.length - 1).map(p => `
        <text x="${p.x}" y="${h + 6}" fill="var(--text-secondary)" font-size="3" text-anchor="middle" font-family="Inter">${p.label}</text>
      `).join('')}
    </svg>
  </div>`;
}

// ===== DATA HELPERS =====
function getWeightData(metrics, progress) {
  if (metrics.length > 1) {
    return metrics.slice(-14).map(m => ({
      value: m.weight,
      label: new Date(m.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })
    }));
  }
  return progress.weight.map(w => ({
    value: w.value,
    label: new Date(w.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }));
}

function getStrengthData(progress) {
  const prs = Object.values(progress.personalRecords).map(v => parseFloat(v));
  const baseIdx = prs.reduce((a, v) => a + v, 0);
  return Array.from({length: 7}, (_, i) => ({
    value: Math.round(baseIdx * (0.85 + i * 0.025)),
    label: new Date(Date.now() - (6-i)*86400000).toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }));
}

function calculateStrengthIndex(progress) {
  const prs = Object.values(progress.personalRecords);
  let total = 0;
  prs.forEach(v => { total += parseFloat(v) || 0; });
  return Math.round(total * 2.9);
}

// ===== LOG METRICS MODAL =====
function showLogMetrics() {
  const modal = document.getElementById('log-metrics-modal');
  if (!modal) return;
  const latestMetrics = Store.get('metricsLog')?.at(-1) || {};
  modal.className = '';
  modal.innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)document.getElementById('log-metrics-modal').className='hidden'">
    <div class="modal">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h2 style="margin:0">+ Log Metrics</h2>
        <button class="btn btn-ghost btn-icon" onclick="document.getElementById('log-metrics-modal').className='hidden'">${icon('x',20)}</button>
      </div>
      <form onsubmit="handleLogMetrics(event)" style="display:flex;flex-direction:column;gap:16px">
        <div class="input-group"><label>Weight (kg)</label><input class="input" type="number" step="0.1" id="lm-weight" value="${latestMetrics.weight || 80}" required></div>
        <div class="input-group"><label>Body Fat %</label><input class="input" type="number" step="0.1" id="lm-bf" value="${latestMetrics.bodyFat || 15}" min="3" max="60"></div>
        <div class="input-group"><label>Notes</label><input class="input" id="lm-notes" placeholder="e.g. Feeling strong today!"></div>
        <button class="btn btn-primary" type="submit" style="width:100%">${icon('check',16)} Save</button>
      </form>
    </div>
  </div>`;
}

function handleLogMetrics(e) {
  e.preventDefault();
  const weight = parseFloat(document.getElementById('lm-weight').value);
  const bodyFat = parseFloat(document.getElementById('lm-bf').value) || 15;
  const notes = document.getElementById('lm-notes').value;
  const entry = { date: new Date().toISOString(), weight, bodyFat, notes };

  Store.update('metricsLog', log => { if (!log) log = []; log.push(entry); return log; });

  // Also update progressData weight
  Store.update('progressData', p => {
    p.weight.push({ date: entry.date.split('T')[0], value: weight });
    if (p.weight.length > 30) p.weight = p.weight.slice(-30);
    return p;
  });

  document.getElementById('log-metrics-modal').className = 'hidden';
  Toast.show("Metrics logged! 📊", "success");
  render();
}
