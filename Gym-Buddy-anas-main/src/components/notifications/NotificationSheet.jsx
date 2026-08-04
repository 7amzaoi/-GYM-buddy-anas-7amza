import { useContext } from 'react';
import BottomSheet from '../BottomSheet.jsx';
import { Store } from '../../store.js';
import { icon } from '../../icons.jsx';
import { NavigateContext } from '../../context/NavigateContext.jsx';
import { pageIdFromPath } from '../../routes.js';

/**
 * The notification feed, in a BottomSheet (centred dialog at >=769px — the
 * primitive handles that switch itself).
 *
 * Grouped by recency rather than shown as one flat list: "what happened today"
 * is a different question from "what happened this month", and a date on every
 * row would repeat the same string a dozen times.
 */

/** Glyph per kind. Reuses the existing icon set — no new glyphs for this. */
const KIND_ICON = {
  pr_broken: 'medal',
  streak: 'fire',
  reminder: 'clock',
  system: 'bell',
};

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Which section a notification belongs to.
 * Day-based, not 24h-based: something logged at 23:00 last night reads as
 * "yesterday", not "today", regardless of the hour you open the sheet.
 */
function bucketFor(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'earlier';
  const days = Math.floor((startOfDay(new Date()).getTime() - startOfDay(t).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days < 7) return 'week';
  return 'earlier';
}

const SECTIONS = [
  ['today', 'Today'],
  ['week', 'Earlier this week'],
  ['earlier', 'Earlier'],
];

/** Compact relative time — the row has no room for a full date. */
function timeAgo(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** '#/records' | '/records' -> 'records'. Returns null when unmappable. */
function pageIdFromActionUrl(url) {
  if (!url) return null;
  const path = String(url).replace(/^#/, '');
  if (!path.startsWith('/')) return null;
  const pageId = pageIdFromPath(path);
  // pageIdFromPath falls back to 'landing' for anything unknown; an in-app
  // notification should never bounce a signed-in user out to the marketing page.
  return pageId === 'landing' && path !== '/' ? null : pageId;
}

export default function NotificationSheet() {
  const navigateToPage = useContext(NavigateContext);
  const { items = [], unreadCount = 0, isOpen = false } = Store.get('notifications') || {};

  const grouped = SECTIONS.map(([key, label]) => [
    key,
    label,
    items.filter((n) => bucketFor(n.created_at) === key),
  ]).filter(([, , rows]) => rows.length > 0);

  function onRowClick(n) {
    if (!n.read_at) void Store.markNotificationRead(n.id);
    const pageId = pageIdFromActionUrl(n.action_url);
    if (pageId) {
      Store.closeNotifications();
      navigateToPage?.(pageId);
    }
  }

  return (
    <BottomSheet
      open={isOpen}
      onClose={() => Store.closeNotifications()}
      title="Notifications"
    >
      {unreadCount > 0 && (
        <div className="notif-actions">
          <button
            type="button"
            className="notif-markall"
            onClick={() => Store.markAllNotificationsRead()}
          >
            {icon('check', 15)} Mark all read
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="notif-empty">Nothing new. Keep training.</p>
      ) : (
        grouped.map(([key, label, rows]) => (
          <section className="notif-section" key={key}>
            <h3 className="notif-section-title">{label}</h3>
            <ul className="notif-list">
              {rows.map((n) => {
                const unread = !n.read_at;
                const pageId = pageIdFromActionUrl(n.action_url);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`notif-row${unread ? ' is-unread' : ''}`}
                      onClick={() => onRowClick(n)}
                    >
                      <span className="notif-row-icon" aria-hidden="true">
                        {icon(KIND_ICON[n.kind] || 'bell', 18)}
                      </span>
                      <span className="notif-row-text">
                        <span className="notif-row-title">
                          {n.title}
                          {/* Carries the unread state to screen readers, which
                              cannot see the bold weight or the dot. */}
                          {unread && <span className="gx-sr-only"> (unread)</span>}
                        </span>
                        {n.body && <span className="notif-row-body">{n.body}</span>}
                      </span>
                      <span className="notif-row-meta">
                        <time dateTime={n.created_at}>{timeAgo(n.created_at)}</time>
                        {pageId && (
                          <span className="notif-row-chev" aria-hidden="true">
                            {icon('chevron', 14)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </BottomSheet>
  );
}
