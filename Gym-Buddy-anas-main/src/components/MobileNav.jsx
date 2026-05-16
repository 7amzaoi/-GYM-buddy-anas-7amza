import { useLocation } from 'react-router-dom';
import { useContext } from 'react';
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

export default function MobileNav() {
  const navigateToPage = useContext(NavigateContext);
  const location = useLocation();

  return (
    <nav className="mobile-nav">
      {navItems.map(item => (
        <button
          key={item.id}
          type="button"
          className={location.pathname === ROUTES[item.id] ? 'active' : ''}
          onClick={() => navigateToPage?.(item.id)}
        >
          {icon(item.iconKey)} <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
