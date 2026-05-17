// ========== DASHBOARD PAGE ==========
let perfMetric = 'strengthVolume';

function renderDashboard() {
  const user = Store.get('user');
  const progress = Store.get('progressData');
  const history = Store.get('workoutHistory');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();

  // Weekly performance chart data
  const perf = progress.weeklyPerformance || { strengthVolume: [0, 0, 0, 0, 0, 0, 0], caloriesBurned: [0, 0, 0, 0, 0, 0, 0], duration: [0, 0, 0, 0, 0, 0, 0] };
  const perfLabels = { strengthVolume: 'Strength Volume', caloriesBurned: 'Calories Burned', duration: 'Duration (min)' };
  const perfUnits = { strengthVolume: 'kg', caloriesBurned: 'cal', duration: 'min' };

  return `
  <div class="page-header animate-fade">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <h1>${greeting}, <span style="color:var(--accent)">${user?.name || 'Athlete'}</span> 👋</h1>
        <p>${getRandomQuote()}</p>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${icon('fire', 20)}
        <span style="font-size:1.4rem;font-weight:800;color:var(--accent)">${progress.streak}</span>
        <span style="font-size:.85rem;color:var(--text-secondary)">day streak</span>
      </div>
    </div>
  </div>

  <!-- Stats Row -->
  <div class="grid grid-4 animate-slide-up delay-1" style="margin-bottom:24px">
    <div class="card stat-card card-tilt" data-tooltip="Total calories burned today">
      <div class="stat-icon">${icon('fire', 22)}</div>
      <div class="stat-value" style="color:var(--accent)" data-counter="${progress.calories.at(-1)?.value || 0}" data-suffix=" cal">0</div>
      <div class="stat-label">Calories Today</div>
    </div>
    <div class="card stat-card card-tilt" data-tooltip="Workouts completed this week">
      <div class="stat-icon">${icon('activity', 22)}</div>
      <div class="stat-value" data-counter="${progress.workoutsThisWeek}">0</div>
      <div class="stat-label">Workouts This Week</div>
    </div>
    <div class="card stat-card card-tilt" data-tooltip="Lifetime workout count">
      <div class="stat-icon">${icon('target', 22)}</div>
      <div class="stat-value" data-counter="${progress.totalWorkouts}">0</div>
      <div class="stat-label">Total Workouts</div>
    </div>
    <div class="card stat-card card-tilt" data-tooltip="Your current body weight">
      <div class="stat-icon">${icon('zap', 22)}</div>
      <div class="stat-value">${progress.weight.at(-1)?.value || '--'}<span style="font-size:.9rem;font-weight:400"> kg</span></div>
      <div class="stat-label">Current Weight</div>
    </div>
  </div>

  <!-- Weekly Performance Area Chart -->
  <div class="card animate-slide-up delay-2" style="margin-bottom:24px;padding:28px 28px 20px" id="perf-chart-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:14px">
        <h3 style="font-weight:800;text-transform:uppercase;letter-spacing:.5px;font-size:1rem">Weekly Performance</h3>
        <span class="badge badge-accent" style="text-transform:uppercase;font-size:.7rem;letter-spacing:.5px">${perfLabels[perfMetric]}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <button class="perf-tab ${perfMetric === 'strengthVolume' ? 'active' : ''}" onclick="switchPerfMetric('strengthVolume')">Volume</button>
        <button class="perf-tab ${perfMetric === 'caloriesBurned' ? 'active' : ''}" onclick="switchPerfMetric('caloriesBurned')">Calories</button>
        <button class="perf-tab ${perfMetric === 'duration' ? 'active' : ''}" onclick="switchPerfMetric('duration')">Duration</button>
      </div>
    </div>
    <div id="perf-chart-container" style="position:relative;height:260px;cursor:crosshair">
      ${renderPerfAreaChart(perf[perfMetric], perfUnits[perfMetric])}
    </div>
  </div>

  <!-- Two Column: Streak + Water -->
  <div class="grid grid-2 animate-slide-up delay-3" style="margin-bottom:24px">
    <!-- Streak Card -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3>${icon('fire', 18)} Activity Streak</h3>
        <span class="badge badge-accent">${icon('trophy', 12)} Keep it up!</span>
      </div>
      <div class="streak-bar">
        ${days.map((d, i) => {
    const isDone = i <= today && i >= today - progress.streak + 1 && i <= today;
    const isToday = i === today;
    return `<div class="streak-day ${isDone ? 'done' : ''} ${isToday && !isDone ? 'today' : ''}">${d}</div>`;
  }).join('')}
      </div>
    </div>

    <!-- Water Tracker Compact -->
    <div class="card">
      ${renderWaterCompact()}
    </div>
  </div>

  <!-- Two Column: Recent Workouts + Personal Records -->
  <div class="grid grid-2 animate-slide-up delay-4" style="margin-bottom:24px">
    <!-- Recent Workouts -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3>${icon('clock', 18)} Recent Workouts</h3>
        <button class="btn btn-ghost btn-sm" onclick="navigate('progress')" style="font-size:.75rem">View All →</button>
      </div>
      ${history.length === 0 ? '<p style="color:var(--text-secondary)">No workouts yet. Start your first session!</p>' :
      history.slice(0, 3).map(w => `
          <div class="exercise-item" style="margin-bottom:8px">
            <div class="stat-icon">${icon('dumbbell', 18)}</div>
            <div class="exercise-info">
              <h4>${w.planName}</h4>
              <p>${w.duration || '?'} min · ${w.calories} cal</p>
            </div>
            <span class="badge badge-success">${icon('check', 12)} Done</span>
          </div>
        `).join('')}
    </div>

    <!-- Personal Records -->
    <div class="card">
      <h3 style="margin-bottom:16px">${icon('trophy', 18)} Personal Records</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${Object.entries(progress.personalRecords || {}).map(([name, val]) => `
          <div class="summary-row">
            <span>${name}</span>
            <span style="font-weight:700;color:var(--accent)">${val}</span>
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- BMI Calculator -->
  ${typeof renderBMICalculator === 'function' ? renderBMICalculator() : ''}`;
}

// ===== WEEKLY PERFORMANCE SVG AREA CHART =====
function renderPerfAreaChart(data, unit) {
  if (!data || data.length === 0) data = [0, 0, 0, 0, 0, 0, 0];
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const W = 700, H = 240, padL = 55, padR = 20, padT = 15, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxVal = Math.max(...data, 1);
  // Smart rounding for nice Y axis
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal || 1)));
  const niceMax = Math.ceil(maxVal / magnitude) * magnitude || 15;
  const yTicks = 4;

  // Create points
  const points = data.map((v, i) => {
    const x = padL + (i / (data.length - 1)) * chartW;
    const y = padT + chartH - (v / niceMax) * chartH;
    return { x, y, val: v };
  });

  // Build smooth curve path (catmull-rom to cubic bezier)
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
  // Area fill — close path down to bottom
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${padT + chartH} L ${points[0].x} ${padT + chartH} Z`;

  // Grid lines + Y labels
  let gridLines = '';
  for (let i = 0; i <= yTicks; i++) {
    const y = padT + (i / yTicks) * chartH;
    const val = Math.round(niceMax - (i / yTicks) * niceMax);
    gridLines += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    gridLines += `<text x="${padL - 12}" y="${y + 4}" fill="rgba(255,255,255,0.3)" font-size="11" text-anchor="end" font-family="Inter">${val.toLocaleString()}</text>`;
  }

  // X labels
  let xLabels = '';
  points.forEach((p, i) => {
    xLabels += `<text x="${p.x}" y="${H - 4}" fill="rgba(255,255,255,0.4)" font-size="12" text-anchor="middle" font-family="Inter">${dayLabels[i]}</text>`;
  });

  // Interactive hover dots + vertical lines
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

  // Dumbbell icon in top-right corner
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

function switchPerfMetric(metric) {
  perfMetric = metric;
  render();
}

function showPerfTooltip(idx, val, unit, x, y) {
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const container = document.getElementById('perf-chart-container');
  const tooltip = document.getElementById('perf-tooltip');
  const svg = document.getElementById('perf-svg');
  if (!container || !tooltip || !svg) return;

  // Show dot and vertical line
  document.querySelectorAll('.perf-dot[data-idx="' + idx + '"]').forEach(d => d.setAttribute('opacity', '1'));
  document.querySelectorAll('.perf-vline[data-idx="' + idx + '"]').forEach(l => l.setAttribute('stroke', 'rgba(212,255,0,0.25)'));

  // Position tooltip
  const rect = container.getBoundingClientRect();
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

function hidePerfTooltip(idx) {
  const tooltip = document.getElementById('perf-tooltip');
  if (tooltip) tooltip.style.opacity = '0';
  document.querySelectorAll('.perf-dot[data-idx="' + idx + '"]').forEach(d => d.setAttribute('opacity', '0'));
  document.querySelectorAll('.perf-vline[data-idx="' + idx + '"]').forEach(l => l.setAttribute('stroke', 'rgba(212,255,0,0)'));
}

// Compact water tracker for dashboard
function renderWaterCompact() {
  const water = Store.get('waterIntake') || 0;
  const goal = 8;
  const pct = Math.min((water / goal) * 100, 100);
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3>💧 Water Intake</h3>
      <span class="badge ${water >= goal ? 'badge-success' : 'badge-accent'}">${water}/${goal}</span>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:12px">
      ${Array.from({ length: goal }, (_, i) => `
        <div onclick="setWater(${i + 1})" style="
          flex:1;height:36px;border-radius:8px;cursor:pointer;
          transition:all .3s ease;display:flex;align-items:center;justify-content:center;
          font-size:.75rem;
          background:${i < water ? 'linear-gradient(to top, #0EA5E9, #38BDF8)' : 'var(--bg-card)'};
          border:1px solid ${i < water ? '#0EA5E9' : 'var(--border)'};
          color:${i < water ? '#fff' : 'var(--text-secondary)'};
        ">${i < water ? '💧' : (i + 1)}</div>
      `).join('')}
    </div>
    <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#0EA5E9,#38BDF8);border-radius:3px;transition:width .6s ease"></div>
    </div>`;
}

// ========== WORKOUT PLANNER PAGE ==========
function renderPlanner() {
  const customPlans = Store.get('customPlans') || [];
  const allPlans = [...WORKOUT_PLANS, ...customPlans];

  return `
  <div class="page-header animate-fade">
    <h1>${icon('dumbbell', 24)} Workout Planner</h1>
    <p>Choose a program or create your own</p>
  </div>

  <!-- Category Tabs -->
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px" class="animate-slide-up delay-1">
    <button class="btn btn-primary btn-sm" onclick="navigate('planner')" id="filter-all">All</button>
    <button class="btn btn-secondary btn-sm" onclick="filterPlans('strength')">🏋️ Strength</button>
    <button class="btn btn-secondary btn-sm" onclick="filterPlans('cardio')">🏃 Cardio</button>
    <button class="btn btn-secondary btn-sm" onclick="filterPlans('fatLoss')">🔥 Fat Loss</button>
    <button class="btn btn-secondary btn-sm" onclick="filterPlans('muscleGain')">💪 Muscle Gain</button>
    <button class="btn btn-primary btn-sm" onclick="showCreatePlan()" style="margin-left:auto">${icon('plus', 16)} Create Plan</button>
  </div>

  <!-- Plans Grid -->
  <div class="grid grid-3 animate-slide-up delay-2" id="plans-grid">
    ${allPlans.map(p => renderPlanCard(p)).join('')}
  </div>

  <!-- Create Plan Modal (hidden) -->
  <div id="create-plan-modal" class="hidden"></div>`;
}

function renderPlanCard(plan) {
  const catLabels = { strength: '🏋️ Strength', cardio: '🏃 Cardio', fatLoss: '🔥 Fat Loss', muscleGain: '💪 Muscle Gain' };
  const isCustom = plan.id.startsWith('custom_');
  return `
  <div class="card card-hover" style="cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
      <span class="badge badge-accent">${catLabels[plan.category] || plan.category}</span>
      ${isCustom ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();deleteCustomPlan('${plan.id}')" style="padding:4px;color:var(--danger)">${icon('trash', 16)}</button>` : ''}
    </div>
    <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:4px">${plan.name}</h3>
    <p style="font-size:.85rem;color:var(--text-secondary);margin-bottom:16px">${plan.description || ''}</p>
    <div style="display:flex;gap:16px;font-size:.8rem;color:var(--text-secondary);margin-bottom:16px">
      <span>${icon('clock', 14)} ${plan.duration}</span>
      <span>${icon('zap', 14)} ${plan.level || 'All Levels'}</span>
      <span>${icon('fire', 14)} ~${plan.calories} cal</span>
    </div>
    <button class="btn btn-primary btn-sm" onclick="handleStartWorkout('${plan.id}')" style="width:100%">${icon('play', 14)} Start Workout</button>
  </div>`;
}

function handleStartWorkout(planId) {
  Store.startSession(planId);
  if (Store.get('activeSession')) {
    Toast.show("Workout session started! Let's go!", 'success');
    navigate('session');
  } else {
    Toast.show('Could not start session', 'error');
  }
}

function filterPlans(category) {
  const customPlans = Store.get('customPlans') || [];
  const allPlans = [...WORKOUT_PLANS, ...customPlans];
  const filtered = allPlans.filter(p => p.category === category);
  const grid = document.getElementById('plans-grid');
  if (grid) grid.innerHTML = filtered.map(p => renderPlanCard(p)).join('');
}

function deleteCustomPlan(id) {
  Store.deleteCustomPlan(id);
  render();
}

function showCreatePlan() {
  const modal = document.getElementById('create-plan-modal');
  if (!modal) return;
  const allEx = getAllExercises();
  modal.className = '';
  modal.innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this){document.getElementById('create-plan-modal').className='hidden'}">
    <div class="modal">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h2 style="margin:0">${icon('plus', 20)} Create Custom Plan</h2>
        <button class="btn btn-ghost btn-icon" onclick="document.getElementById('create-plan-modal').className='hidden'">${icon('x', 20)}</button>
      </div>
      <form onsubmit="handleCreatePlan(event)" style="display:flex;flex-direction:column;gap:16px">
        <div class="input-group"><label>Plan Name</label><input class="input" id="cp-name" required placeholder="My Workout"></div>
        <div class="input-group"><label>Category</label>
          <select class="input" id="cp-cat"><option value="strength">Strength</option><option value="cardio">Cardio</option><option value="fatLoss">Fat Loss</option><option value="muscleGain">Muscle Gain</option></select>
        </div>
        <div class="input-group"><label>Duration</label><input class="input" id="cp-dur" placeholder="45 min" required></div>
        <div class="input-group"><label>Select Exercises</label>
          <div style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:8px;background:var(--bg-main);border-radius:var(--radius-sm)">
            ${allEx.map(ex => `<label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer;padding:4px"><input type="checkbox" value="${ex.id}" class="cp-exercise"> ${ex.icon} ${ex.name}</label>`).join('')}
          </div>
        </div>
        <button class="btn btn-primary" type="submit" style="width:100%">${icon('check', 16)} Create Plan</button>
      </form>
    </div>
  </div>`;
}

function handleCreatePlan(e) {
  e.preventDefault();
  const name = document.getElementById('cp-name').value;
  const category = document.getElementById('cp-cat').value;
  const duration = document.getElementById('cp-dur').value;
  const exercises = [...document.querySelectorAll('.cp-exercise:checked')].map(cb => cb.value);
  if (exercises.length === 0) { Toast.show('⚠️ Select at least one exercise!', 'warning'); return; }
  Store.addCustomPlan({ name, category, duration, level: 'Custom', description: 'Your custom workout plan.', exercises, calories: exercises.length * 50 });
  document.getElementById('create-plan-modal').className = 'hidden';
  Toast.show('✅ Custom plan "' + name + '" created!', 'success');
  render();
