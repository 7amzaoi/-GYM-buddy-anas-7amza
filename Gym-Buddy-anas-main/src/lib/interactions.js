// ========== GYMBUDDY INTERACTIONS LAYER (legacy behavior, React-safe) ==========
import { Store } from '../store.js';
import { closestElement } from './domTargets.js';
import { currentAccent } from './personalization.js';

/** @type {(pageId: string) => void} | null */
let navigateToPage = null;

export function registerNavigator(fn) {
  navigateToPage = fn;
}

export const Toast = {
  container: null,
  init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.style.cssText = 'position:fixed;top:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none';
    document.body.appendChild(this.container);
  },
  show(message, type = 'success', duration = 3000) {
    this.init();
    const colors = { success: '#2ED573', error: '#FF4757', info: currentAccent().hex, warning: '#FFA502' };
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const toast = document.createElement('div');
    toast.style.cssText = `
      display:flex;align-items:center;gap:12px;padding:14px 20px;
      background:rgba(28,28,30,.95);backdrop-filter:blur(20px);
      border:1px solid ${colors[type]}40;border-left:3px solid ${colors[type]};
      border-radius:12px;color:#fff;font-size:.9rem;font-family:Rajdhani,-apple-system,sans-serif;
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

function animateCounter(element, target, duration = 1200, suffix = '') {
  if (!element) return;
  const start = 0;
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * ease);
    element.textContent = current.toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

export function initCounters() {
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

function initRipples() {
  document.addEventListener('click', (e) => {
    const btn = closestElement(e.target)?.closest('.btn');
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

export function launchConfetti(duration = 2500) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const colors = [currentAccent().hex, '#2ED573', '#FF4757', '#FFA502', '#FFFFFF', '#7B61FF'];
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

function initTooltips() {
  let tip = null;
  document.addEventListener('mouseenter', (e) => {
    const el = closestElement(e.target)?.closest('[data-tooltip]');
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
    if (closestElement(e.target)?.closest('[data-tooltip]') && tip) { tip.remove(); tip = null; }
  }, true);
}

export function initParticles() {
  if (document.getElementById('particles-bg')) return;
  const container = document.createElement('div');
  container.id = 'particles-bg';
  container.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden';
  for (let i = 0; i < 20; i++) {
    const dot = document.createElement('div');
    const size = 2 + Math.random() * 4;
    dot.style.cssText = `
      position:absolute;border-radius:50%;
      width:${size}px;height:${size}px;
      background:rgba(var(--accent-rgb),${0.05 + Math.random() * 0.1});
      left:${Math.random() * 100}%;top:${Math.random() * 100}%;
      animation:float ${5 + Math.random() * 10}s ease-in-out infinite;
      animation-delay:${Math.random() * 5}s;
    `;
    container.appendChild(dot);
  }
  document.body.appendChild(container);
}

export function initScrollReveal() {
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

export function animateProgressBar(el, targetPct, duration = 800) {
  if (!el) return;
  el.style.transition = `width ${duration}ms cubic-bezier(.4,0,.2,1)`;
  requestAnimationFrame(() => { el.style.width = targetPct + '%'; });
}

export function setWater(amount) {
  Store.set('waterIntake', amount);
  Toast.show(`💧 ${amount} glasses logged!`, 'info');
}

export function initChartHover() {
  document.addEventListener('mouseenter', (e) => {
    const bar = closestElement(e.target)?.closest('.chart-bar');
    if (!bar) return;
    const val = bar.getAttribute('title');
    if (val) {
      bar.style.filter = 'brightness(1.3)';
      bar.style.transform = 'scaleY(1.05)';
      bar.style.transformOrigin = 'bottom';
    }
  }, true);
  document.addEventListener('mouseleave', (e) => {
    const bar = closestElement(e.target)?.closest('.chart-bar');
    if (bar) { bar.style.filter = ''; bar.style.transform = ''; }
  }, true);
}

let longPressTimer = null;
export function initLongPress() {
  document.addEventListener('pointerdown', (e) => {
    const item = closestElement(e.target)?.closest('.exercise-item');
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

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const tg = closestElement(e.target);
    if (!tg) return;
    if (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT') return;
    if (!Store.get('user')) return;
    const shortcuts = {
      '1': 'dashboard', '2': 'planner', '3': 'progress',
      '4': 'assistant', '5': 'profile'
    };
    if (shortcuts[e.key] && navigateToPage) {
      navigateToPage(shortcuts[e.key]);
      Toast.show(`📌 Navigated with shortcut [${e.key}]`, 'info', 1500);
    }
    if (e.key === '?' && !e.ctrlKey) {
      Toast.show('⌨️ Shortcuts: 1-Dashboard 2-Planner 3-Progress 4-AI Coach 5-Profile', 'info', 4000);
    }
  });
}

/** Call once after mount — wires Toast, ripple, tooltip, particle bg, shortcuts, hover, long-press */
export function initGlobalInteractions() {
  Toast.init();
  initRipples();
  initTooltips();
  initParticles();
  initKeyboardShortcuts();
  initChartHover();
  initLongPress();
}
