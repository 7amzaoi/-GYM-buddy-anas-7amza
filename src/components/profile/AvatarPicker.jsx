import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomSheet from '../BottomSheet.jsx';
import { icon } from '../../icons.jsx';
import { listPresets, selectPreset, uploadCustomAvatar, removeAvatar } from '../../services/avatarApi.js';
import { openCropSession, validateImageFile } from '../../lib/imageCrop.js';

/**
 * AvatarPicker — choose a preset, or upload and crop your own.
 *
 * Built on the existing BottomSheet primitive (mobile sheet, centred dialog at
 * >=769px via CSS), so it inherits focus trapping, Esc, backdrop dismiss and
 * scroll locking rather than reimplementing them.
 *
 * Every async action tracks WHICH control is in flight (`busy`), so only that
 * control shows a spinner, and every path clears it in a finally — a failed
 * call can't leave a button stuck.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   avatarUrl?: string|null,
 *   avatarSource?: 'preset'|'upload'|null,
 *   initials?: string,
 *   onChange?: (next: { avatar_url: string|null, avatar_source: string|null }) => void,
 * }} props
 */
export default function AvatarPicker({
  open, onClose, avatarUrl = null, avatarSource = null,
  selectedPresetPath = null, initials = '', onChange,
}) {
  const [presets, setPresets] = useState([]);
  /** null | 'upload' | 'remove' | `preset:<id>` — the one control that's busy. */
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  // Crop session state.
  const [cropping, setCropping] = useState(false);
  const cropMountRef = useRef(null);
  const cropControlsRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    listPresets().then(({ data, error: err }) => {
      if (!alive) return;
      if (err) setError('Could not load the preset gallery.');
      else setPresets(data || []);
    });
    return () => { alive = false; };
  }, []);

  // Reset transient state whenever the sheet reopens.
  useEffect(() => {
    if (!open) return;
    setError('');
    setBusy(null);
  }, [open]);

  /** Presets grouped by manifest category, in first-seen order. */
  const groups = useMemo(() => {
    const out = [];
    for (const p of presets) {
      let g = out.find((x) => x.category === p.category);
      if (!g) { g = { category: p.category, items: [] }; out.push(g); }
      g.items.push(p);
    }
    return out;
  }, [presets]);

  const cancelCrop = useCallback(() => {
    cropControlsRef.current?.cancel();
    cropControlsRef.current = null;
    setCropping(false);
  }, []);

  function onPickFile(e) {
    const file = e.target.files?.[0];
    // Let the same file be chosen twice in a row.
    e.target.value = '';
    if (!file) return;

    const invalid = validateImageFile(file);
    if (invalid) { setError(invalid); return; }

    setError('');
    setCropping(true);

    // The mount only exists after the crop UI renders.
    requestAnimationFrame(() => {
      openCropSession(file, {
        mount: cropMountRef.current,
        onReady: (controls) => { cropControlsRef.current = controls; },
      })
        .then(async ({ blob }) => {
          cropControlsRef.current = null;
          setCropping(false);
          setBusy('upload');
          try {
            const { data, error: err } = await uploadCustomAvatar(blob);
            if (err) { setError(friendly(err, 'Could not upload your photo.')); return; }
            onChange?.(data);
            onClose?.();
          } finally {
            setBusy(null);
          }
        })
        .catch((msg) => {
          cropControlsRef.current = null;
          setCropping(false);
          // cancel() rejects with this sentinel — not an error worth showing.
          if (msg !== 'cancelled') setError(String(msg));
        });
    });
  }

  async function onSelectPreset(preset) {
    if (busy) return;
    setError('');
    setBusy(`preset:${preset.id}`);
    try {
      const { data, error: err } = await selectPreset(preset.id);
      if (err) { setError(friendly(err, 'Could not set that avatar.')); return; }
      onChange?.(data);
      onClose?.();
    } finally {
      setBusy(null);
    }
  }

  async function onRemove() {
    if (busy) return;
    setError('');
    setBusy('remove');
    try {
      const { data, error: err } = await removeAvatar();
      if (err) { setError(friendly(err, 'Could not remove your photo.')); return; }
      onChange?.(data);
      onClose?.();
    } finally {
      setBusy(null);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Profile photo">
      <div className="avpick">
        {cropping ? (
          <div className="avpick-crop">
            <p className="avpick-crop-hint">Drag to reposition · pinch or scroll to zoom</p>
            <div className="avpick-crop-stage" ref={cropMountRef} />
            <div className="avpick-crop-actions">
              <button type="button" className="avpick-btn" onClick={cancelCrop}>
                Cancel
              </button>
              <button
                type="button"
                className="avpick-btn is-primary"
                onClick={() => cropControlsRef.current?.confirm()}
              >
                Save photo
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="avpick-preview">
              <div className="avpick-current">
                {avatarUrl
                  ? <img src={avatarUrl} alt="Current profile photo" />
                  : <span aria-hidden="true">{initials}</span>}
              </div>
            </div>

            <button
              type="button"
              className="avpick-btn is-primary avpick-upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy === 'upload'}
            >
              {busy === 'upload'
                ? <><span className="avpick-spinner" aria-hidden="true" /> Uploading…</>
                : <>{icon('plus', 16)} Upload photo</>}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="avpick-file"
              onChange={onPickFile}
              tabIndex={-1}
              aria-hidden="true"
            />

            {error && <p className="avpick-error" role="alert">{error}</p>}

            {groups.map((g) => (
              <section className="avpick-group" key={g.category}>
                <h3 className="avpick-group-title">{g.category}</h3>
                <ul className="avpick-grid">
                  {g.items.map((p) => {
                    /* Compare against the STORED path, not the displayed URL:
                       for an upload the displayed URL is a freshly signed link
                       that matches no preset, and comparing it would be
                       meaningless. */
                    const active = avatarSource === 'preset' && selectedPresetPath === p.url;
                    const loading = busy === `preset:${p.id}`;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={`avpick-preset ${active ? 'is-active' : ''}`}
                          onClick={() => onSelectPreset(p)}
                          disabled={!!busy}
                          aria-pressed={active}
                          aria-label={p.label}
                          title={p.label}
                        >
                          {/* Alt is empty: the accessible name is on the button,
                              so alt text here would just read the label twice. */}
                          <img src={p.url} alt="" loading="lazy" />
                          {loading && <span className="avpick-spinner is-over" aria-hidden="true" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            {avatarUrl && (
              <button
                type="button"
                className="avpick-remove"
                onClick={onRemove}
                disabled={busy === 'remove'}
              >
                {busy === 'remove' ? 'Removing…' : 'Remove photo'}
              </button>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}

/** Surface something readable; keep the raw message when it's already useful. */
function friendly(err, fallback) {
  const msg = String(err?.message || err || '');
  if (/not authenticated|jwt|session|token/i.test(msg)) {
    return 'Your login expired. Sign in again to change your photo.';
  }
  if (/not configured/i.test(msg)) {
    return 'Cloud sync is off, so photos can’t be saved on this device.';
  }
  if (/timed out/i.test(msg)) return 'That took too long. Check your connection and try again.';
  return msg || fallback;
}
