// ========== LANDING, LOGIN, REGISTER PAGES ==========

function renderLanding() {
  return `
  <div class="page landing">
    <nav class="landing-nav">
      <div class="logo"><span class="logo-dot"></span> GymForge</div>
      <div style="display:flex;gap:12px">
        <button class="btn btn-ghost" onclick="navigate('login')">Log In</button>
        <button class="btn btn-primary btn-sm" onclick="navigate('register')">Get Started</button>
      </div>
    </nav>

    <section class="hero">
      <div class="hero-content animate-fade">
        <div class="badge badge-accent" style="margin-bottom:20px;display:inline-flex">⚡ AI-Powered Training</div>
        <h1>Build Your <span class="accent">Strongest</span> Self</h1>
        <p>Track workouts, get AI-powered plans, and crush your fitness goals with the most premium gym assistant ever built.</p>
        <div class="hero-buttons">
          <button class="btn btn-primary btn-lg" onclick="navigate('register')">${icon('zap',20)} Start Training Free</button>
          <button class="btn btn-secondary btn-lg" onclick="navigate('login')">${icon('arrow',20)} Sign In</button>
        </div>
      </div>
    </section>

    <section class="features-section" style="background:var(--bg-card)">
      <h2>Everything You Need to <span class="accent">Dominate</span></h2>
      <div class="features-grid">
        ${[
          { icon: '🏋️', title: 'Smart Workout Plans', desc: 'Pre-built and custom programs for every goal — strength, cardio, fat loss, or muscle gain.' },
          { icon: '📊', title: 'Progress Analytics', desc: 'Beautiful charts tracking your weight, reps, volume, and personal records over time.' },
          { icon: '🤖', title: 'AI Gym Coach', desc: 'Chat with your AI assistant for personalized workout suggestions and fitness advice.' },
          { icon: '⏱️', title: 'Session Tracker', desc: 'Real-time workout timer with exercise tracking, rest periods, and completion stats.' },
          { icon: '🔥', title: 'Streak System', desc: 'Stay motivated with daily workout streaks, badges, and achievement tracking.' },
          { icon: '📱', title: 'Fully Responsive', desc: 'Train anywhere — works perfectly on desktop, tablet, and mobile devices.' }
        ].map((f, i) => `
          <div class="card card-hover animate-slide-up delay-${i % 5 + 1}">
            <div class="feature-icon">${f.icon}</div>
            <h3>${f.title}</h3>
            <p style="color:var(--text-secondary);font-size:.9rem;margin-top:8px">${f.desc}</p>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="features-section" style="text-align:center">
      <h2 style="margin-bottom:20px">Ready to <span class="accent">Transform</span>?</h2>
      <p style="color:var(--text-secondary);margin-bottom:40px;font-size:1.1rem">Join thousands of athletes crushing their goals with GymForge.</p>
      <button class="btn btn-primary btn-lg" onclick="navigate('register')">${icon('zap',20)} Get Started — It's Free</button>
    </section>

    <footer class="landing-footer">© 2026 GymForge. Built for champions.</footer>
  </div>`;
}

function renderLogin() {
  return `
  <div class="page auth-page">
    <div class="auth-card card animate-scale">
      <div style="text-align:center;margin-bottom:8px"><span class="logo-dot" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--accent);box-shadow:0 0 12px var(--accent-glow)"></span></div>
      <h1>Welcome Back</h1>
      <p class="subtitle">Sign in to continue your journey</p>
      <form class="auth-form" onsubmit="handleLogin(event)">
        <div class="input-group">
          <label>Email</label>
          <input class="input" type="email" id="login-email" placeholder="your@email.com" required>
        </div>
        <div class="input-group">
          <label>Password</label>
          <input class="input" type="password" id="login-pass" placeholder="••••••••" required>
        </div>
        <button class="btn btn-primary" type="submit" style="width:100%;margin-top:8px">Sign In ${icon('arrow',18)}</button>
      </form>
      <div class="auth-footer">
        Don't have an account? <button onclick="navigate('register')">Create one</button>
      </div>
    </div>
  </div>`;
}

function renderRegister() {
  return `
  <div class="page auth-page">
    <div class="auth-card card animate-scale">
      <div style="text-align:center;margin-bottom:8px"><span class="logo-dot" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--accent);box-shadow:0 0 12px var(--accent-glow)"></span></div>
      <h1>Join GymForge</h1>
      <p class="subtitle">Start your transformation today</p>
      <form class="auth-form" onsubmit="handleRegister(event)">
        <div class="input-group">
          <label>Full Name</label>
          <input class="input" type="text" id="reg-name" placeholder="John Doe" required>
        </div>
        <div class="input-group">
          <label>Email</label>
          <input class="input" type="email" id="reg-email" placeholder="your@email.com" required>
        </div>
        <div class="input-group">
          <label>Password</label>
          <input class="input" type="password" id="reg-pass" placeholder="Min 6 characters" required minlength="6">
        </div>
        <div class="input-group">
          <label>Fitness Goal</label>
          <select class="input" id="reg-goal">
            <option value="muscle gain">💪 Muscle Gain</option>
            <option value="fat loss">🔥 Fat Loss</option>
            <option value="strength">🏋️ Strength</option>
            <option value="cardio">🏃 Cardio / Endurance</option>
          </select>
        </div>
        <button class="btn btn-primary" type="submit" style="width:100%;margin-top:8px">Create Account ${icon('zap',18)}</button>
      </form>
      <div class="auth-footer">
        Already have an account? <button onclick="navigate('login')">Sign in</button>
      </div>
    </div>
  </div>`;
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  Store.login(email, email.split('@')[0]);
  Toast.show('👋 Welcome back, ' + email.split('@')[0] + '!', 'success');
  render();
}

function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const goal = document.getElementById('reg-goal').value;
  Store.register(name, email, goal);
  Toast.show('🎉 Welcome to GymForge, ' + name + '! Let\'s crush some goals!', 'success', 4000);
  launchConfetti(2000);
  render();
}
