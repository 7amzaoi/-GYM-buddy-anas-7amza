import { useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { icon } from '../icons.jsx';
import { ROUTES } from '../routes.js';
import { NavigateContext } from '../context/NavigateContext.jsx';
import { MOBILE_NAV_ITEMS } from '../lib/navItems.js';

export default function MobileNav() {
  const navigateToPage = useContext(NavigateContext);
  const location = useLocation();

  return (
    <nav className="mobile-nav">
      {MOBILE_NAV_ITEMS.map(item => (
        <button
          key={item.id}
          type="button"
          className={location.pathname === ROUTES[item.id] ? 'active' : ''}
          onClick={() => navigateToPage?.(item.id)}
        >
          {icon(item.iconKey)} <span>{item.mobileLabel || item.label}</span>
        </button>
      ))}
    </nav>
  );
}
