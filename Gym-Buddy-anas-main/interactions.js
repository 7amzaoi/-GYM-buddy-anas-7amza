// ========== GYMFORGE INTERACTIONS LAYER ==========

// ===== TOAST NOTIFICATION SYSTEM =====
const Toast = {
  container: null,
  init() {
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.style.cssText = 'position:fixed;top:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none';
    document.body.appendChild(this.container);
  },
  show(message, type = 'success', duration = 3000) {
    if (!this.container) this.init();
    const colors = { success: '#2ED573', error: '#FF4757', info: '#D4FF00', warning: '#FFA502' };
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const toast = document.createElement('div');
    toast.style.cssText = `
      display:flex;align-items:center;gap:12px;padding:14px 20px;
      background:rgba(28,28,30,.95);backdrop-filter:blur(20px);
      border:1px solid ${colors[type]}40;border-left:3px solid ${colors[type]};
      border-radius:12px;color:#fff;font-size:.9rem;font-family:Inter,sans-serif;
      pointer-events:auto;cursor:pointer;min-width:280px;max-width:400px;
      transform:translateX(120%);transition:all .4s cubic-bezier(.4,0,.2,1);
      box-shadow:0 8px 32px rgba(0,0,0,.4),0 0 12px ${colors[type]}20;
    `;
    toast.innerHTML = `<span style="width:28px;height:28px;border-radius:50%;background:${colors[type]}20;color:${colors[type]};display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">${icons[type]}</span><span style="flex:1">${message}</span>`;
    toast.onclick = () => dismissToast(toast);
    this.container.appendChild(toast);
    requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });
    setTimeout(() => dismissToast(toast), duration);
  }
};

function dismissToast(el) {
  el.style.transform = 'translateX(120%)';
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 400);
}

// ===== ANIMATED NUMBER COUNTER =====
function animateCounter(element, target, duration = 1200, suffix = '') {
  if (!element) return;
  const start = 0;
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    const current = Math.round(start + (target - start) * ease);
    element.textContent = current.toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function initCounters() {
  document.querySelectorAll('[data-counter]').forEach(el => {
    const target = parseFloat(el.dataset.counter);
    const suffix = el.dataset.suffix || '';
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(el, target, 1200, suffix);
          observer.disconnect();
        }
      });
    }, { threshold: 0.3 });
    observer.observe(el);
  });
}

// ===== BUTTON RIPPLE EFFECT =====
function initRipples() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const ripple = document.createElement('span');
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.cssText = `
      position:absolute;border-radius:50%;
      width:${size}px;height:${size}px;
      left:${e.clientX - rect.left - size/2}px;
      top:${e.clientY - rect.top - size/2}px;
      background:rgba(255,255,255,.2);
      transform:scale(0);animation:ripple-anim .6s ease-out;
      pointer-events:none;
    `;
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
}

// ===== CONFETTI CELEBRATION =====
function launchConfetti(duration = 2500) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const colors = ['#D4FF00', '#2ED573', '#FF4757', '#FFA502', '#FFFFFF', '#7B61FF'];
  const particles = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 100,
    w: 6 + Math.random() * 6,
    h: 4 + Math.random() * 4,
    vx: (Math.random() - 0.5) * 6,
    vy: 2 + Math.random() * 4,
    rot: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 12,
    color: colors[Math.floor(Math.random() * colors.length)],
    life: 1
  }));
  const startTime = Date.now();
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const elapsed = Date.now() - startTime;
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.rot += p.rotSpeed;
      if (elapsed > duration * 0.6) p.life -= 0.02;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (elapsed < duration) requestAnimationFrame(draw);
    else canvas.remove();
  }
  draw();
}

// ===== TOOLTIP SYSTEM =====
function initTooltips() {
  let tip = null;
  document.addEventListener('mouseenter', (e) => {
    const el = e.target.closest('[data-tooltip]');
    if (!el) return;
    if (tip) tip.remove();
    tip = document.createElement('div');
    tip.className = 'tooltip-popup';
    tip.textContent = el.dataset.tooltip;
    document.body.appendChild(tip);
    const rect = el.getBoundingClientRect();
    tip.style.left = rect.left + rect.width / 2 - tip.offsetWidth / 2 + 'px';
    tip.style.top = rect.top - tip.offsetHeight - 8 + 'px';
  }, true);
  document.addEventListener('mouseleave', (e) => {
    if (e.target.closest('[data-tooltip]') && tip) { tip.remove(); tip = null; }
  }, true);
}

// ===== PARALLAX FLOATING PARTICLES =====
function initParticles() {
  const container = document.createElement('div');
  container.id = 'particles-bg';
  container.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden';
  for (let i = 0; i < 20; i++) {
    const dot = document.createElement('div');
    const size = 2 + Math.random() * 4;
    dot.style.cssText = `
      position:absolute;border-radius:50%;
      width:${size}px;height:${size}px;
      background:rgba(212,255,0,${0.05 + Math.random() * 0.1});
      left:${Math.random() * 100}%;top:${Math.random() * 100}%;
      animation:float ${5 + Math.random() * 10}s ease-in-out infinite;
      animation-delay:${Math.random() * 5}s;
    `;
    container.appendChild(dot);
  }
  document.body.appendChild(container);
}

// ===== SMOOTH SCROLL REVEAL =====
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el));
}

// ===== PROGRESS BAR ANIMATION =====
function animateProgressBar(el, targetPct, duration = 800) {
  if (!el) return;
  el.style.transition = `width ${duration}ms cubic-bezier(.4,0,.2,1)`;
  requestAnimationFrame(() => { el.style.width = targetPct + '%'; });
}

// ===== WATER INTAKE TRACKER =====
function renderWaterTracker() {
  const water = Store.get('waterIntake') || 0;
  const goal = 8; // 8 glasses
  const pct = Math.min((water / goal) * 100, 100);
  return `
  <div class="card animate-slide-up delay-3" style="margin-bottom:24px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3>💧 Water Intake</h3>
      <span class="badge ${water >= goal ? 'badge-success' : 'badge-accent'}">${water}/${goal} glasses</span>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      ${Array.from({length: goal}, (_, i) => `
        <div onclick="setWater(${i + 1})" style="
          flex:1;height:40px;border-radius:8px;cursor:pointer;
          transition:all .3s ease;display:flex;align-items:center;justify-content:center;
          font-size:.8rem;
          background:${i < water ? 'linear-gradient(to top, #0EA5E9, #38BDF8)' : 'var(--bg-card)'};
          border:1px solid ${i < water ? '#0EA5E9' : 'var(--border)'};
          color:${i < water ? '#fff' : 'var(--text-secondary)'};
        " data-tooltip="Glass ${i+1}">${i < water ? '💧' : (i+1)}</div>
      `).join('')}
    </div>
    <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
      <div class="progress-fill" style="height:100%;width:${pct}%;background:linear-gradient(90deg,#0EA5E9,#38BDF8);border-radius:3px;transition:width .6s ease"></div>
    </div>
  </div>`;
}

function setWater(amount) {
  Store.set('waterIntake', amount);
  Toast.show(`💧 ${amount} glasses logged!`, 'info');
  render();
}

// ===== BMI CALCULATOR =====
function renderBMICalculator() {
  const user = Store.get('user');
  const bmiData = Store.get('bmiData') || { height: 175, weight: Store.get('progressData')?.weight?.at(-1)?.value || 80 };
  const bmi = (bmiData.weight / Math.pow(bmiData.height / 100, 2)).toFixed(1);
  let category, color;
  if (bmi < 18.5) { category = 'Underweight'; color = '#FFA502'; }
  else if (bmi < 25) { category = 'Normal'; color = '#2ED573'; }
  else if (bmi < 30) { category = 'Overweight'; color = '#FFA502'; }
  else { category = 'Obese'; color = '#FF4757'; }
  const pct = Math.min(Math.max(((bmi - 15) / 25) * 100, 0), 100);

  return `
  <div class="card animate-slide-up delay-4" style="margin-bottom:24px">
    <h3 style="margin-bottom:16px">📏 BMI Calculator</h3>
    <div style="display:flex;gap:16px;margin-bottom:20px">
      <div class="input-group" style="flex:1">
        <label>Height (cm)</label>
        <input class="input" type="number" value="${bmiData.height}" onchange="updateBMI('height',this.value)" min="100" max="250">
      </div>
      <div class="input-group" style="flex:1">
        <label>Weight (kg)</label>
        <input class="input" type="number" value="${bmiData.weight}" onchange="updateBMI('weight',this.value)" min="30" max="300">
      </div>
    </div>
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:2.5rem;font-weight:800;color:${color}" data-counter="${bmi}">${bmi}</div>
      <div style="font-size:.9rem;color:${color};font-weight:600">${category}</div>
    </div>
    <div style="position:relative;height:8px;background:linear-gradient(90deg,#0EA5E9,#2ED573,#FFA502,#FF4757);border-radius:4px">
      <div style="position:absolute;top:-4px;left:${pct}%;width:16px;height:16px;background:#fff;border-radius:50%;transform:translateX(-50%);box-shadow:0 2px 8px rgba(0,0,0,.3);transition:left .5s ease"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-secondary);margin-top:6px">
      <span>Underweight</span><span>Normal</span><span>Overweight</span><span>Obese</span>
    </div>
  </div>`;
}

function updateBMI(field, value) {
  const bmiData = Store.get('bmiData') || { height: 175, weight: 80 };
  bmiData[field] = parseFloat(value);
  Store.set('bmiData', bmiData);
  render();
}

// ===== KEYBOARD SHORTCUTS =====
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (!Store.get('user')) return;
    const shortcuts = {
      '1': 'dashboard', '2': 'planner', '3': 'progress',
      '4': 'assistant', '5': 'profile'
    };
    if (shortcuts[e.key]) { navigate(shortcuts[e.key]); Toast.show(`📌 Navigated with shortcut [${e.key}]`, 'info', 1500); }
    if (e.key === '?' && !e.ctrlKey) showShortcutsHelp();
  });
}

function showShortcutsHelp() {
  Toast.show('⌨️ Shortcuts: 1-Dashboard 2-Planner 3-Progress 4-AI Coach 5-Profile', 'info', 4000);
}

// ===== INTERACTIVE CHART HOVER =====
function initChartHover() {
  document.addEventListener('mouseenter', (e) => {
    const bar = e.target.closest('.chart-bar');
    if (!bar) return;
    const val = bar.getAttribute('title');
    if (val) {
      bar.style.filter = 'brightness(1.3)';
      bar.style.transform = 'scaleY(1.05)';
      bar.style.transformOrigin = 'bottom';
    }
  }, true);
  document.addEventListener('mouseleave', (e) => {
    const bar = e.target.closest('.chart-bar');
    if (bar) { bar.style.filter = ''; bar.style.transform = ''; }
  }, true);
}

// ===== LONG PRESS ON EXERCISE FOR DETAILS =====
let longPressTimer = null;
function initLongPress() {
  document.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('.exercise-item');
    if (!item) return;
    longPressTimer = setTimeout(() => {
      item.style.transform = 'scale(0.98)';
      const name = item.querySelector('h4')?.textContent || 'Exercise';
      Toast.show(`💡 ${name} — Hold to see details`, 'info', 2000);
      setTimeout(() => { item.style.transform = ''; }, 300);
    }, 500);
  });
  document.addEventListener('pointerup', () => clearTimeout(longPressTimer));
  document.addEventListener('pointercancel', () => clearTimeout(longPressTimer));
}

// ===== MOTIVATIONAL POPUP =====
function showMotivation() {
  const quotes = [
    "You're doing AMAZING! Keep pushing! 🔥",
    "Every rep brings you closer to your goal! 💪",
    "Champions train when they don't want to! 🏆",
    "Your future self will thank you! ⚡",
    "Discipline beats motivation every time! 🎯"
  ];
  Toast.show(quotes[Math.floor(Math.random() * quotes.length)], 'success', 3500);
}

// ===== INIT ALL INTERACTIONS =====
function initInteractions() {
  Toast.init();
  initRipples();
  initTooltips();
  initParticles();
  initKeyboardShortcuts();
  initChartHover();
  initLongPress();
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInteractions);
} else {
  initInteractions();
}
