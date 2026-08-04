import { Store } from '../../store.js';
import { icon } from '../../icons.jsx';

/**
 * Header bell + unread indicator.
 *
 * Shows a DOT, not a count. A number badge on a 21px glyph is unreadable at
 * phone density and turns into a smudge past 9; the dot carries the same
 * "something is waiting" signal. The exact count still reaches assistive tech
 * through the aria-label, so nothing is lost — it moves from the pixels to the
 * accessible name.
 *
 * Currently mounted in the `.m1-topbar` slot on the Today screen. When the
 * shared AppHeader gains a global action slot this should move there, so the
 * bell is reachable from every route instead of only the home screen.
 */
export default function NotificationBell({ className = '' }) {
  const { unreadCount = 0 } = Store.get('notifications') || {};
  const hasUnread = unreadCount > 0;

  const label = hasUnread
    ? `Notifications, ${unreadCount} unread`
    : 'Notifications';

  return (
    <button
      type="button"
      className={`m1-iconbtn notif-bell ${className}`.trim()}
      aria-label={label}
      onClick={() => Store.openNotifications()}
    >
      {icon('bell', 21)}
      {/* aria-hidden: the count is already in the button's accessible name,
          and announcing it twice is noise. */}
      {hasUnread && <span className="notif-bell-dot" aria-hidden="true" />}
    </button>
  );
}
