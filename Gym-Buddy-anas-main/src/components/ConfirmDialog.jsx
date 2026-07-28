import { icon } from '../icons.jsx';
import BottomSheet from './BottomSheet.jsx';
import * as haptics from '../lib/haptics.js';

/**
 * ConfirmDialog — the app's confirmation prompt, replacing `window.confirm`.
 *
 * Built on BottomSheet, so it inherits the platform behaviour already solved
 * there: a draggable sheet on mobile, a centred dialog at >=769px, native
 * <dialog> focus trapping, Esc-to-cancel, focus returned to the trigger, and
 * background scroll lock.
 *
 * `tone="danger"` turns the icon and the confirm button red — used for
 * destructive actions. Cancel is always the wider/left action so the
 * destructive one is never the accidental tap.
 *
 * Props:
 *   open, onCancel, onConfirm
 *   title        — short question, e.g. "Delete this session?"
 *   subject      — optional: what exactly is being acted on (name / date)
 *   note         — optional: consequence, e.g. what gets recalculated
 *   confirmLabel — defaults to "Confirm"
 *   tone         — 'danger' | 'default'
 *   iconKey      — glyph for the badge, defaults to 'trash' for danger
 */
export default function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  subject,
  note,
  confirmLabel = 'Confirm',
  tone = 'danger',
  iconKey,
}) {
  const glyph = iconKey || (tone === 'danger' ? 'trash' : 'check');

  return (
    <BottomSheet open={open} onClose={onCancel}>
      <div className={`m1-confirm tone-${tone}`} role="alertdialog" aria-label={title}>
        <span className="m1-confirm-badge" aria-hidden="true">{icon(glyph, 24)}</span>

        <h2 className="m1-confirm-title m1-display">{title}</h2>
        {subject && <p className="m1-confirm-subject">{subject}</p>}
        {note && <p className="m1-confirm-note">{note}</p>}

        <div className="m1-confirm-actions">
          <button type="button" className="m1-confirm-btn is-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="m1-confirm-btn is-go"
            onClick={() => {
              haptics.warn();
              onConfirm?.();
            }}
          >
            {icon(glyph, 15)} {confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
