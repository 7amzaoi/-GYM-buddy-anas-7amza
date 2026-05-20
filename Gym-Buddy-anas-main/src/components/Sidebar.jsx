import { useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { ROUTES } from '../routes.js';
import { NavigateContext } from '../context/NavigateContext.jsx';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', iconKey: 'home' },
  { id: 'planner', label: 'Planner', iconKey: 'dumbbell' },
  { id: 'progress', label: 'Progress', iconKey: 'chart' },
  { id: 'records', label: 'Records', iconKey: 'trophy' },
  { id: 'assistant', label: 'AI Coach', iconKey: 'bot' },
  { id: 'profile', label: 'Profile', iconKey: 'user' },
];

/** First-letter avatar fallback when the user has no photo. */
function initialsOf(name) {
  if (!name) return 'G';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

export default function Sidebar() {
  const navigateToPage = useContext(NavigateContext);
  const location = useLocation();
  const user = Store.get('user');

  function signOut() {
    Store.logout();
    navigateToPage?.('landing');
  }

  return (
    <aside className="sidebar" id="sidebar">
      <div className="sidebar-logo">
        <span className="logo-dot" /> GymBuddy
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const active = location.pathname === ROUTES[item.id];
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => navigateToPage?.(item.id)}
              aria-current={active ? 'page' : undefined}
            >
              <span className="nav-item-icon">{icon(item.iconKey)}</span>
              <span className="nav-item-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <button
            type="button"
            className="sidebar-user"
            onClick={() => navigateToPage?.('profile')}
          >
            <span className="sidebar-user-avatar">{initialsOf(user.name)}</span>
            <span className="sidebar-user-meta">
              <span className="sidebar-user-name">{user.name || 'Athlete'}</span>
              <span className="sidebar-user-goal">{user.goal || 'View profile'}</span>
            </span>
          </button>
        )}
        <button type="button" className="nav-item nav-item-signout" onClick={signOut}>
          <span className="nav-item-icon">{icon('logout')}</span>
          <span className="nav-item-label">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
