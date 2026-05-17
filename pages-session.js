// ========== WORKOUT SESSION PAGE (Set-by-Set Tracking) ==========
let sessionTimer = null;
let sessionSeconds = 0;
let sessionPaused = false;
let restMode = false;
let restSeconds = 0;

function renderSession() {
  const session = Store.get('activeSession');
  if (!session) return `<div class="page"><div class="card" style="text-align:center;padding:60px"><h2>No Active Session</h2><p style="color:var(--text-secondary);margin:16px 0">Start a workout from the planner first.</p><button class="btn btn-primary" onclick="navigate('planner')">Go to Planner</button></div></div>`;

  const allDone = session.exercises.every(ex => ex.sets && ex.sets.every(s => s.done));
  const totalSets = session.exercises.reduce((a, ex) => a + (ex.sets ? ex.sets.length : 0), 0);
  const doneSets = session.exercises.reduce((a, ex) => a + (ex.sets ? ex.sets.filter(s => s.done).length : 0), 0);
  const pct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;

  return `
  <div class="page-header animate-fade">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-icon" onclick="showEndSessionModal()">${icon('back',20)}</button>
        <div><h1>${session.planName}</h1><p>${doneSets}/${totalSets} sets completed</p></div>
      </div>
      <div style="display:flex;align-items:center;gap:16px">
        <div class="timer-mini ${restMode ? 'rest' : ''}" id="timer-display">${formatTime(restMode ? restSeconds : sessionSeconds)}</div>
        <button class="btn btn-secondary btn-sm" onclick="toggleTimer()">${sessionPaused ? icon('play',14) : icon('pause',14)}</button>
        ${!restMode ? `<button class="btn btn-primary btn-sm" onclick="startRest()" data-tooltip="Rest 60s">${icon('clock',14)} Rest</button>` : ''}
      </div>
    </div>
  </div>

  <!-- Progress Bar -->
  <div class="animate-slide-up delay-1" style="margin-bottom:28px">
    <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:3px;transition:width .5s ease"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:.8rem;color:var(--text-secondary);margin-top:6px">
      <span>${pct}% complete</span>
      <span>${restMode ? '😤 Resting...' : '💪 Working'}</span>
      <span>~${session.calories} cal</span>
    </div>
  </div>

  <!-- Exercise Cards with Sets -->
  <div style="display:flex;flex-direction:column;gap:20px" class="animate-slide-up delay-2">
    ${session.exercises.map((ex, ei) => {
      const data = getExerciseById(ex.id);
      if (!data) return '';
      const sets = ex.sets || [];
      const exDone = sets.length > 0 && sets.every(s => s.done);
      return `
      <div class="card ${exDone ? 'exercise-card-done' : ''}" style="padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="font-weight:700;text-transform:uppercase;font-size:.95rem;display:flex;align-items:center;gap:8px">
            <span style="font-size:1.2rem">${data.icon}</span> ${data.name}
          </h3>
          <button class="btn btn-ghost btn-sm" onclick="showExerciseHistory('${data.name}')" style="font-size:.75rem;color:var(--text-secondary)">HISTORY</button>
        </div>

        <!-- Set Header -->
        <div style="display:grid;grid-template-columns:50px 1fr 1fr 50px;gap:8px;padding:0 4px 8px;font-size:.7rem;color:var(--text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:.5px">
          <span>Set</span><span>Weight (kg)</span><span>Reps</span><span style="text-align:center">Done</span>
        </div>

        <!-- Set Rows -->
        ${sets.map((s, si) => `
        <div style="display:grid;grid-template-columns:50px 1fr 1fr 50px;gap:8px;align-items:center;padding:6px 4px;border-radius:8px;margin-bottom:4px;background:${s.done ? 'rgba(212,255,0,0.05)' : 'var(--bg-card)'};transition:all .3s ease">
          <span style="font-weight:600;color:var(--text-secondary);font-size:.9rem;text-align:center">${si + 1}</span>
          <input type="number" class="set-input" value="${s.weight}" onchange="updateSet(${ei},${si},'weight',this.value)" placeholder="0" ${s.done ? 'style="opacity:.6"' : ''}>
          <input type="number" class="set-input" value="${s.reps}" onchange="updateSet(${ei},${si},'reps',this.value)" placeholder="0" ${s.done ? 'style="opacity:.6"' : ''}>
          <div style="text-align:center">
            <button class="set-done-btn ${s.done ? 'checked' : ''}" onclick="toggleSetDone(${ei},${si})">
              ${s.done ? icon('check', 16) : ''}
            </button>
          </div>
        </div>
        `).join('')}

        <!-- Add Set Button -->
        <button class="add-set-btn" onclick="addSet(${ei})">
          ${icon('plus',14)} ADD SET
        </button>
      </div>`;
    }).join('')}
  </div>

  <!-- End Session Confirmation Modal -->
  <div id="end-session-modal" class="hidden"></div>

  <!-- Complete / End -->
  <div style="margin-top:28px;display:flex;gap:12px" class="animate-slide-up delay-3">
    ${allDone && totalSets > 0
      ? `<button class="btn btn-primary pulse-glow" onclick="completeWorkout()" style="flex:1">${icon('trophy',18)} Complete Workout!</button>`
      : `<button class="btn btn-secondary" onclick="showEndSessionModal()" style="flex:1">End Session</button>`
    }
  </div>`;
}

// ===== SET MANAGEMENT =====
function initSetsForSession() {
  Store.update('activeSession', s => {
    s.exercises = s.exercises.map(ex => {
      if (!ex.sets) {
        const data = getExerciseById(ex.id);
        const numSets = data ? data.sets : 3;
        ex.sets = Array.from({length: numSets}, () => ({ weight: '', reps: '', done: false }));
      }
      return ex;
    });
    return s;
  });
}

function updateSet(exerciseIdx, setIdx, field, value) {
  Store.update('activeSession', s => {
    if (s.exercises[exerciseIdx] && s.exercises[exerciseIdx].sets[setIdx]) {
      s.exercises[exerciseIdx].sets[setIdx][field] = value;
    }
    return s;
  });
}

function toggleSetDone(exerciseIdx, setIdx) {
  Store.update('activeSession', s => {
    const set = s.exercises[exerciseIdx]?.sets?.[setIdx];
    if (set) {
      set.done = !set.done;
      if (set.done && (!set.weight || !set.reps)) {
        set.done = false;
        Toast.show("Enter weight and reps first!", "warning");
        return s;
      }
      if (set.done) {
        Toast.show(`Set ${setIdx + 1} done! 💪`, "success", 1500);
      }
    }
    return s;
  });
  render();
}

function addSet(exerciseIdx) {
  Store.update('activeSession', s => {
    const lastSet = s.exercises[exerciseIdx]?.sets?.at(-1);
    s.exercises[exerciseIdx].sets.push({
      weight: lastSet?.weight || '',
      reps: lastSet?.reps || '',
      done: false
    });
    return s;
  });
  Toast.show("Set added!", "info", 1500);
  render();
}

function showExerciseHistory(name) {
  const history = Store.get('workoutHistory') || [];
  Toast.show(`${name} — History coming soon!`, "info", 2000);
}

function completeWorkout() {
  launchConfetti();
  Toast.show("Workout Complete! You crushed it! 🏆", "success", 4000);
  // Save set data to history
  const session = Store.get('activeSession');
  if (session) {
    const totalWeight = session.exercises.reduce((a, ex) => {
      return a + (ex.sets || []).reduce((b, s) => b + (s.done ? (parseFloat(s.weight)||0) * (parseInt(s.reps)||0) : 0), 0);
    }, 0);
    // Store volume for progress tracking
    Store.update('progressData', p => {
      p.totalVolume = (p.totalVolume || 0) + totalWeight;
      return p;
    });
  }
  setTimeout(() => { Store.completeSession(); stopTimer(); navigate('dashboard'); }, 1500);
}

function toggleExercise(idx) { /* legacy compat */ }

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function startSessionTimer() {
  if (sessionTimer) return;
  const session = Store.get('activeSession');
  if (session && !session.exercises[0]?.sets) initSetsForSession();
  sessionPaused = false;
  sessionTimer = setInterval(() => {
    if (sessionPaused) return;
    if (restMode) {
      restSeconds--;
      if (restSeconds <= 0) { restMode = false; restSeconds = 0; Toast.show("Rest over! Go! 🔥", "info", 2000); }
      const el = document.getElementById('timer-display');
      if (el) { el.textContent = formatTime(restMode ? restSeconds : sessionSeconds); el.className = `timer-mini ${restMode ? 'rest' : ''}`; }
    } else {
      sessionSeconds++;
      const el = document.getElementById('timer-display');
      if (el) el.textContent = formatTime(sessionSeconds);
    }
  }, 1000);
}

function stopTimer() { clearInterval(sessionTimer); sessionTimer = null; sessionSeconds = 0; sessionPaused = false; restMode = false; }
function toggleTimer() {
  sessionPaused = !sessionPaused;
  Toast.show(sessionPaused ? "Timer paused" : "Timer resumed", "info", 1500);
  render();
}
function startRest() {
  restMode = true; restSeconds = 60;
  Toast.show("Rest for 60 seconds...", "info", 2000);
  render();
}
function showEndSessionModal() {
  const modal = document.getElementById('end-session-modal');
  if (!modal) return;
  modal.className = '';
  modal.innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)hideEndSessionModal()">
    <div class="modal" style="max-width:400px;text-align:center">
      <h2 style="margin-bottom:8px">${icon('back',22)} End Session?</h2>
      <p style="color:var(--text-secondary);margin-bottom:24px">Your progress will be saved.</p>
      <div style="display:flex;gap:12px">
        <button class="btn btn-secondary" onclick="hideEndSessionModal()" style="flex:1">Cancel</button>
        <button class="btn btn-primary" onclick="doEndSession()" style="flex:1">${icon('check',16)} Yes, End</button>
      </div>
    </div>
  </div>`;
}

function hideEndSessionModal() {
  const modal = document.getElementById('end-session-modal');
  if (modal) modal.className = 'hidden';
}

function doEndSession() {
  hideEndSessionModal();
  Toast.show("Session saved! Great work!", "success");
  Store.completeSession(); stopTimer();
  navigate('planner');
}
