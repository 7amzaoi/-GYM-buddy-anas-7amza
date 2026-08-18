import { supabase } from '../lib/supabaseClient.js';
import manifest from '../data/avatarPresets.json';

/**
 * Profile avatar: preset gallery + custom upload.
 *
 * Mirrors the shape of profilesApi.js — getAuthedUser(), withTimeout(),
 * runDbCallWithTimeout(), and a { data, error } return from every export.
 * Nothing here throws: a rejected promise inside is always converted to an
 * `error` field.
 *
 * TypeScript twin: avatarApi.ts. Change one, mirror the other.
 */

const UPLOAD_BUCKET = 'avatar-uploads';
const UPLOAD_BASENAME = 'avatar';

/**
 * Signed-URL lifetime for the private upload bucket (1 hour, in seconds).
 *
 * Short on purpose. The URL is minted fresh every time the avatar is displayed
 * rather than stored, so it only has to outlive a single browsing session —
 * and a short window limits how long a leaked link stays usable.
 */
export const SIGNED_URL_TTL = 60 * 60;

/** Where the static preset images are served from (Vite copies public/ as-is). */
const PRESET_DIR = '/avatars';

/* ---------------------------------------------------------------------------
   Signed-URL cache.

   The same avatar is shown in more than one place at once (profile hero and
   the sidebar chip), and those mount in the same frame — without this, every
   mount would cost its own signing round trip. Keyed by object path, with
   concurrent signings de-duplicated so a simultaneous double mount issues one
   request. Entries are dropped 5 minutes before the token actually lapses, so
   a tab left open never renders a dead link.
--------------------------------------------------------------------------- */
const CACHE_SAFETY_MS = 5 * 60 * 1000;
/** @type {Map<string, { url: string, expiresAt: number }>} */
const signedCache = new Map();
/** @type {Map<string, Promise<{data: string|null, error: Error|null}>>} */
const signingInFlight = new Map();

function cachedSignedUrl(path) {
  const hit = signedCache.get(path);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    signedCache.delete(path);
    return null;
  }
  return hit.url;
}

/**
 * Drop a cached signature. Call after replacing the bytes at a path: the object
 * key doesn't change on re-upload, so without this the old signed URL stays
 * valid and the browser serves the previous image from its own cache.
 */
export function invalidateAvatarUrl(path) {
  if (path) signedCache.delete(path);
  else signedCache.clear();
}

/**
 * Root-relative path to a preset image.
 *
 * Presets are static assets committed at public/avatars/, NOT Storage objects:
 * they ship with the build, are the same for every user, and change only when
 * a file is committed. So nothing here touches Supabase or SUPABASE_URL — the
 * path resolves against whatever host is serving the app.
 */
function presetPath(file) {
  return `${PRESET_DIR}/${file}`;
}

async function getAuthedUser() {
  if (!supabase) return { user: null, error: new Error('Supabase is not configured') };
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return { user: null, error };
    if (data?.user) return { user: data.user, error: null };
    return { user: null, error: new Error('Not authenticated') };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)), user: null };
  }
}

async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function runDbCallWithTimeout(queryFactory, ms, label) {
  const controller = new AbortController();
  try {
    return await withTimeout(queryFactory(controller.signal), ms, label);
  } catch (error) {
    if (error?.name === 'AbortError') return { error: new Error(`${label} timed out`) };
    return { error: error instanceof Error ? error : new Error(String(error)) };
  } finally {
    controller.abort();
  }
}

/** Write the two avatar columns for the signed-in user. */
async function writeAvatarColumns(userId, avatarUrl, avatarSource, label) {
  return runDbCallWithTimeout(
    (signal) =>
      supabase
        .from('profiles')
        .update({
          avatar_url: avatarUrl,
          avatar_source: avatarSource,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .abortSignal(signal),
    12000,
    label
  );
}

/**
 * The 10 curated presets, each with its resolved local path.
 *
 * Reads the local manifest only — no network, no Supabase — so the gallery
 * always renders, in manifest order, even signed out or offline. The paths
 * simply won't resolve to bytes until the .webp files land in public/avatars/.
 *
 * @returns {Promise<{ data: Array<{id,file,label,category,url}>|null, error: Error|null }>}
 */
export async function listPresets() {
  try {
    const presets = Array.isArray(manifest?.presets) ? manifest.presets : [];
    const data = presets.map((p) => ({
      id: p.id,
      file: p.file,
      label: p.label,
      category: p.category,
      url: presetPath(p.file),
    }));
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Point the profile at one of the 10 presets.
 * The id is validated against the manifest, so a caller can't write an
 * arbitrary URL into avatar_url through this path.
 */
export async function selectPreset(presetId) {
  const presets = Array.isArray(manifest?.presets) ? manifest.presets : [];
  const match = presets.find((p) => p.id === presetId);
  if (!match) {
    return { data: null, error: new Error(`Unknown preset: ${presetId}`) };
  }

  const { user, error: authError } = await getAuthedUser();
  if (authError || !user) {
    return { data: null, error: authError ?? new Error('Not authenticated') };
  }

  const url = presetPath(match.file);
  const { error } = await writeAvatarColumns(user.id, url, 'preset', 'Select avatar preset');
  if (error) return { data: null, error };

  return { data: { avatar_url: url, avatar_source: 'preset', presetId: match.id }, error: null };
}

/**
 * Upload a cropped blob to the private bucket and point the profile at it.
 *
 * The object path is `{user_id}/avatar.<ext>` — the leading folder is exactly
 * what the storage RLS policy compares against auth.uid(), so a user can only
 * ever write inside their own directory.
 *
 * Extension follows the blob's real type: the crop falls back to PNG on
 * browsers that can't export WEBP from canvas, and naming a PNG `.webp` would
 * make Storage serve the wrong content type.
 */
export async function uploadCustomAvatar(blob) {
  if (!blob) return { data: null, error: new Error('No image to upload') };
  // Captured locally so the twin's type narrowing matches this file exactly.
  const client = supabase;
  if (!client) return { data: null, error: new Error('Supabase is not configured') };

  const { user, error: authError } = await getAuthedUser();
  if (authError || !user) {
    return { data: null, error: authError ?? new Error('Not authenticated') };
  }

  const type = blob.type || 'image/webp';
  const ext = type === 'image/png' ? 'png' : 'webp';
  const path = `${user.id}/${UPLOAD_BASENAME}.${ext}`;

  const uploaded = await runDbCallWithTimeout(
    () =>
      client.storage
        .from(UPLOAD_BUCKET)
        .upload(path, blob, { upsert: true, contentType: type, cacheControl: '3600' }),
    30000,
    'Upload avatar'
  );
  if (uploaded?.error) return { data: null, error: uploaded.error };

  /* The path is unchanged on re-upload, so any signature we already handed out
     still resolves — to the OLD bytes, via the browser's own cache. Dropping
     the entry forces a new token, and a new token is a new URL. */
  invalidateAvatarUrl(path);

  /* Store the object PATH, never a signed URL. Signed URLs expire, so a column
     full of them means every user's avatar breaks at the same moment the
     tokens lapse. The path is stable forever; resolveAvatarUrl() mints a fresh
     short-lived URL from it each time the image is actually displayed. */
  const { error } = await writeAvatarColumns(user.id, path, 'upload', 'Save avatar');
  if (error) return { data: null, error };

  return { data: { avatar_url: path, avatar_source: 'upload', path }, error: null };
}

/**
 * Turn a stored avatar_url into something an <img> can load, right now.
 *
 * - source 'preset' → the stored value is already a servable static path
 *   (/avatars/preset-04.webp); hand it back untouched, no network.
 * - source 'upload' → the stored value is an object path inside the private
 *   bucket; mint a short-lived signed URL for it on the spot.
 *
 * Call this at display time, not at save time. That is the whole point: the
 * database holds a permanent pointer and the expiring part is generated fresh
 * on every read.
 *
 * @returns {Promise<{ data: string|null, error: Error|null }>}
 */
export async function resolveAvatarUrl(avatarUrl, avatarSource) {
  if (!avatarUrl) return { data: null, error: null };

  // Presets (and anything not marked as an upload) are plain paths.
  if (avatarSource !== 'upload') return { data: avatarUrl, error: null };

  /* Transitional: rows written before this change stored a full signed URL
     rather than a path. Signing an absolute URL as though it were an object
     key would produce a broken link, so pass it through and let it live out
     its original expiry. New writes are always paths. */
  if (/^https?:\/\//i.test(avatarUrl)) return { data: avatarUrl, error: null };

  const cached = cachedSignedUrl(avatarUrl);
  if (cached) return { data: cached, error: null };

  // Someone else is already signing this exact path — ride along.
  const pending = signingInFlight.get(avatarUrl);
  if (pending) return pending;

  const client = supabase;
  if (!client) return { data: null, error: new Error('Supabase is not configured') };

  const task = (async () => {
    try {
      const signed = await runDbCallWithTimeout(
        () => client.storage.from(UPLOAD_BUCKET).createSignedUrl(avatarUrl, SIGNED_URL_TTL),
        12000,
        'Sign avatar URL'
      );
      if (signed?.error) return { data: null, error: signed.error };

      const url = signed?.data?.signedUrl || null;
      if (!url) return { data: null, error: new Error('Could not sign the avatar URL') };

      signedCache.set(avatarUrl, {
        url,
        expiresAt: Date.now() + SIGNED_URL_TTL * 1000 - CACHE_SAFETY_MS,
      });
      return { data: url, error: null };
    } finally {
      signingInFlight.delete(avatarUrl);
    }
  })();

  signingInFlight.set(avatarUrl, task);
  return task;
}

/** Clear the avatar. The stored object is left in place — only the pointer is
 *  dropped, so a mis-tap doesn't destroy the user's uploaded image. */
export async function removeAvatar() {
  const { user, error: authError } = await getAuthedUser();
  if (authError || !user) {
    return { data: null, error: authError ?? new Error('Not authenticated') };
  }

  const { error } = await writeAvatarColumns(user.id, null, null, 'Remove avatar');
  if (error) return { data: null, error };

  return { data: { avatar_url: null, avatar_source: null }, error: null };
}
