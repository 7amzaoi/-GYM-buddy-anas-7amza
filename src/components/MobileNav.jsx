import { useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { icon } from '../icons.jsx';
import { ROUTES } from '../routes.js';
import { NavigateContext } from '../context/NavigateContext.jsx';
import { MOBILE_TABS, MOBILE_FAB } from '../lib/navItems.js';
import * as haptics from '../lib/haptics.js';

/**
 * Native-feeling bottom bar: 4 tabs with a raised centre action button.
 * Layout: [tab][tab] [FAB] [tab][tab]. A single shared pill slides to the
 * active tab (see .mnav-indicator in _app-shell.css).
 */
export default function MobileNav() {
  const navigateToPage = useContext(NavigateContext);
  const location = useLocation();

  const activeIndex = MOBILE_TABS.findIndex((t) => location.pathname === ROUTES[t.id]);
  // The FAB sits in slot 2, so tabs after it shift one slot to the right.
  const activeSlot = activeIndex < 0 ? -1 : activeIndex < 2 ? activeIndex : activeIndex + 1;

  function go(pageId) {
    haptics.tap();
    navigateToPage?.(pageId);
  }

  const renderTab = (item) => {
    const selected = location.pathname === ROUTES[item.id];
    return (
      <button
        key={item.id}
        type="button"
        role="tab"
        aria-selected={selected}
        aria-label={item.label}
        className={`mnav-tab ${selected ? 'is-active' : ''}`}
        onClick={() => go(item.id)}
      >
        {icon(item.iconKey, 22)}
        <span className="mnav-label">{item.mobileLabel || item.label}</span>
      </button>
    );
  };

  return (
    <nav
      className="mobile-nav"
      role="tablist"
      aria-label="Primary"
      data-active={activeSlot >= 0}
      style={{ '--active-slot': Math.max(activeSlot, 0) }}
    >
      <span className="mnav-indicator" aria-hidden="true" />
      {renderTab(MOBILE_TABS[0])}
      {renderTab(MOBILE_TABS[1])}
      <button
        type="button"
        className="mnav-fab"
        aria-label={MOBILE_FAB.label}
        onClick={() => go(MOBILE_FAB.routeId)}
      >
        <span className="mnav-fab-glyph">{icon(MOBILE_FAB.iconKey, 24)}</span>
      </button>
      {renderTab(MOBILE_TABS[2])}
      {renderTab(MOBILE_TABS[3])}
    </nav>
  );
}
