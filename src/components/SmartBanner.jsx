import { useContext, useMemo, useState } from 'react';
import { icon } from '../icons.jsx';
import { getTopNotification, dismissNotification } from '../lib/notifications.js';
import { NavigateContext } from '../context/NavigateContext.jsx';

/**
 * Smart, personalized banner shown at the top of the dashboard.
 * Surfaces the single most relevant reminder (streak risk, comeback nudge,
 * celebration, hydration, etc.) and can be dismissed for the day.
 */
export default function SmartBanner() {
  const navigateToPage = useContext(NavigateContext);
  const initial = useMemo(() => getTopNotification(), []);
  const [notif, setNotif] = useState(initial);

  if (!notif) return null;

  function handleDismiss() {
    dismissNotification(notif.id);
    setNotif(null);
  }

  return (
    <div className={`smart-banner tone-${notif.tone}`} role="status" data-reveal>
      <span className="smart-banner-icon">{icon(notif.iconKey, 18)}</span>
      <div className="smart-banner-text">
        <strong>{notif.title}</strong>
        <p>{notif.message}</p>
      </div>
      <div className="smart-banner-actions">
        {notif.action ? (
          <button
            type="button"
            className="smart-banner-cta"
            onClick={() => navigateToPage?.(notif.action.page)}
          >
            {notif.action.label} {icon('arrow', 13)}
          </button>
        ) : null}
        <button
          type="button"
          className="smart-banner-close"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
        >
          {icon('x', 15)}
        </button>
      </div>
    </div>
  );
}
