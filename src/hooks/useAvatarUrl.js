import { useEffect, useState } from 'react';
import { resolveAvatarUrl } from '../services/avatarApi.js';

/**
 * Turn the stored avatar pointer into a URL an <img> can load.
 *
 * The profile row holds a permanent pointer, not a loadable URL: presets are a
 * static path, uploads are a private-bucket object path that has to be signed.
 * resolveAvatarUrl() handles both and caches signatures across callers, so
 * mounting this in several places at once costs one round trip, not several.
 *
 * Returns null while resolving, when nothing is set, or when signing fails —
 * callers fall back to initials.
 *
 * @param {string|null} storedUrl  profile.avatar_url
 * @param {'preset'|'upload'|null} source  profile.avatar_source
 * @returns {string|null}
 */
export default function useAvatarUrl(storedUrl, source) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!storedUrl) {
      setUrl(null);
      return undefined;
    }
    // Drops a late response after unmount, or after a quick second change, so
    // a stale signature can't overwrite a newer one.
    let alive = true;
    resolveAvatarUrl(storedUrl, source)
      .then(({ data }) => { if (alive) setUrl(data); })
      .catch(() => { if (alive) setUrl(null); });
    return () => { alive = false; };
  }, [storedUrl, source]);

  return url;
}
