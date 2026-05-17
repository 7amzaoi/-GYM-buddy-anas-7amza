// ========== STATE MANAGEMENT ==========
const Store = {
  _state: {},
  _listeners: [],

  init() {
    const saved = localStorage.getItem('gymforge_state');
    const defaults = {
      user: null,
      currentPage: 'landing',
      workoutHistory: [],
      customPlans: [],
      progressData: {
        weight: [
          { date: '2026-04-24', value: 82 },
          { date: '2026-04-25', value: 81.8 },
          { date: '2026-04-26', value: 81.5 },
          { date: '2026-04-27', value: 81.7 },
          { date: '2026-04-28', value: 81.3 },
          { date: '2026-04-29', value: 81.0 },
          { date: '2026-04-30', value: 80.8 }
        ],
        calories: [
          { date: '2026-04-24', value: 320 },
          { date: '2026-04-25', value: 450 },
          { date: '2026-04-26', value: 0 },
          { date: '2026-04-27', value: 380 },
          { date: '2026-04-28', value: 520 },
          { date: '2026-04-29', value: 410 },
          { date: '2026-04-30', value: 350 }
        ],
        workoutsThisWeek: 5,
        totalWorkouts: 47,
        streak: 4,
        personalRecords: {
          'Bench Press': '100 kg',
          'Squat': '140 kg',
          'Deadlift': '180 kg',
          'Overhead Press': '65 kg'
        },
        weeklyPerformance: {
          strengthVolume: [4200, 3400, 5100, 280, 4600, 4800, 120],
          caloriesBurned: [420, 380, 520, 0, 480, 450, 0],
          duration: [55, 48, 65, 0, 60, 52, 0]
        }
      },
      chatMessages: [],
      activeSession: null
    };

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this._state = { ...defaults, ...parsed };
        // Deep-merge progressData so new fields (e.g. weeklyPerformance) are always present
        if (parsed.progressData) {
          this._state.progressData = { ...defaults.progressData, ...parsed.progressData };
        }
      }
      catch { this._state = defaults; }
    } else {
      this._state = defaults;
    }
  },

  get(key) { return this._state[key]; },

  set(key, value) {
    this._state[key] = value;
    this._save();
    this._notify();
  },

  update(key, fn) {
    this._state[key] = fn(this._state[key]);
    this._save();
    this._notify();
  },

  _save() {
    try { localStorage.setItem('gymforge_state', JSON.stringify(this._state)); } catch { }
  },

  _notify() { this._listeners.forEach(fn => fn(this._state)); },
  subscribe(fn) { this._listeners.push(fn); },

  // Auth helpers
  login(email, name) {
    this.set('user', { email, name, joinDate: new Date().toISOString(), goal: 'muscle gain' });
    this.set('currentPage', 'dashboard');
  },

  logout() {
    this.set('user', null);
    this.set('currentPage', 'landing');
    this.set('chatMessages', []);
    this.set('activeSession', null);
  },

  register(name, email, goal) {
    this.set('user', { email, name, joinDate: new Date().toISOString(), goal: goal || 'muscle gain' });
    this.set('currentPage', 'dashboard');
  },

  // Workout helpers
  startSession(planId) {
    try {
      const customs = this.get('customPlans') || [];
      const plan = [...WORKOUT_PLANS, ...customs].find(p => p.id === planId);
      if (!plan) { console.warn('Plan not found:', planId); return; }
      this.set('activeSession', {
        planId, planName: plan.name,
        exercises: plan.exercises.map(eid => ({ id: eid, done: false })),
        startTime: Date.now(), calories: plan.calories || 300
      });
      // Don't set currentPage here — let navigate() handle it so browser history works
    } catch (err) {
      console.error('startSession error:', err);
    }
  },

  completeSession() {
    const session = this.get('activeSession');
    if (!session) return;
    const entry = {
      id: Date.now().toString(),
      planName: session.planName,
      date: new Date().toISOString(),
      duration: Math.round((Date.now() - session.startTime) / 60000),
      exercises: session.exercises.length,
      completed: session.exercises.filter(e => e.done).length,
      calories: session.calories
    };
    this.update('workoutHistory', h => [entry, ...h]);
    this.update('progressData', p => ({
      ...p,
      totalWorkouts: p.totalWorkouts + 1,
      workoutsThisWeek: p.workoutsThisWeek + 1,
      streak: p.streak + 1,
      calories: [...p.calories.slice(1), { date: new Date().toISOString().slice(0, 10), value: (p.calories.at(-1)?.value || 0) + entry.calories }]
    }));
    this.set('activeSession', null);
    // Don't set currentPage here — let the caller (navigate) handle routing
  },

  addCustomPlan(plan) {
    const id = 'custom_' + Date.now();
    const newPlan = {
      id,
      name: plan.name,
      category: plan.category,
      duration: plan.duration,
      level: plan.level || 'Custom',
      description: plan.description || 'Your custom workout plan.',
      exercises: plan.exercises || [],
      calories: plan.calories ?? 300
    };
    this.update('customPlans', cp => [...(cp || []), newPlan]);
  },

  deleteCustomPlan(id) {
    this.update('customPlans', cp => (cp || []).filter(p => p.id !== id));
  },
};
