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

export default function Sidebar() {
  const navigateToPage = useContext(NavigateContext);
  const location = useLocation();

  function signOut() {
    Store.logout();
    navigateToPage?.('landing');
  }

  return (
    <aside className="sidebar" id="sidebar">
      <div className="sidebar-logo">
        <span className="logo-dot"></span> GymBuddy
      </div>
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            type="button"
            className={['nav-item', location.pathname === ROUTES[item.id] ? 'active' : ''].join(' ')}
            onClick={() => navigateToPage?.(item.id)}
          >
            {icon(item.iconKey)} {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button type="button" className="nav-item" onClick={signOut}>
          {icon('logout')} Sign Out
        </button>
      </div>
    </aside>
  );
}
