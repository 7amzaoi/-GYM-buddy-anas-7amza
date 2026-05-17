// ========== GYMFORGE — MAIN APP ROUTER ==========

// Initialize state on load
Store.init();

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'planner', label: 'Planner', icon: 'dumbbell' },
  { id: 'progress', label: 'Progress', icon: 'chart' },
  { id: 'assistant', label: 'AI Coach', icon: 'bot' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

let _skipPush = false;

function navigate(page) {
  // Auth guard
  const user = Store.get('user');
  const publicPages = ['landing', 'login', 'register'];
  if (!publicPages.includes(page) && !user) {
    page = 'login';
  }
  Store.set('currentPage', page);

  // Push browser history so the back button works
  if (!_skipPush) {
    history.pushState({ page }, '', '#' + page);
  }

  if (page === 'session') startSessionTimer();
  render();
  window.scrollTo(0, 0);
}

// Handle browser back/forward buttons
window.addEventListener('popstate', (e) => {
  if (e.state && e.state.page) {
    _skipPush = true;
    navigate(e.state.page);
    _skipPush = false;
  }
});

function renderSidebar() {
  const current = Store.get('currentPage');
  return `
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-logo">
      <span class="logo-dot"></span> GymForge
    </div>
    <nav class="sidebar-nav">
      ${navItems.map(item => `
        <button class="nav-item ${current === item.id ? 'active' : ''}" onclick="navigate('${item.id}')">
          ${icon(item.icon)} ${item.label}
        </button>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <button class="nav-item" onclick="Store.logout();render()">
        ${icon('logout')} Sign Out
      </button>
    </div>
  </aside>`;
}

function renderMobileNav() {
  const current = Store.get('currentPage');
  return `
  <nav class="mobile-nav">
    ${navItems.map(item => `
      <button class="${current === item.id ? 'active' : ''}" onclick="navigate('${item.id}')">
        ${icon(item.icon)} <span>${item.label}</span>
      </button>
    `).join('')}
  </nav>`;
}

function render() {
  const page = Store.get('currentPage');
  const user = Store.get('user');
  const app = document.getElementById('app');

  // Public pages — no sidebar
  if (['landing', 'login', 'register'].includes(page) || !user) {
    let content = '';
    if (page === 'login') content = renderLogin();
    else if (page === 'register') content = renderRegister();
    else content = renderLanding();
    app.innerHTML = content;
    return;
  }

  // App pages with sidebar
  let pageContent = '';
  switch (page) {
    case 'dashboard': pageContent = renderDashboard(); break;
    case 'planner': pageContent = renderPlanner(); break;
    case 'session': pageContent = renderSession(); break;
    case 'progress': pageContent = renderProgress(); break;
    case 'assistant': pageContent = renderAssistant(); break;
    case 'profile': pageContent = renderProfile(); break;
    default: pageContent = renderDashboard();
  }

  app.innerHTML = `
    ${renderSidebar()}
    <main class="main-content page">${pageContent}</main>
    ${renderMobileNav()}
  `;

  // Scroll chat to bottom on assistant page
  if (page === 'assistant') scrollChat();

  // Initialize interaction features after DOM update
  requestAnimationFrame(() => {
    if (typeof initCounters === 'function') initCounters();
    if (typeof initScrollReveal === 'function') initScrollReveal();
  });
}

// Initial render — set the initial history entry
history.replaceState({ page: Store.get('currentPage') }, '', '#' + Store.get('currentPage'));
render();
