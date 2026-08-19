import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase config is read from Vite env vars. Set these in `.env.local`:
 *
 *   VITE_SUPABASE_URL=https://<project>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<anon public key>
 *
 * If either is missing, the client is `null` and `isSupabaseConfigured()`
 * returns false — callers should handle the offline-only / local-only path.
 */
const url: string = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
const anonKey: string = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

if (!url || !anonKey) {
  if (typeof console !== 'undefined') {
    console.warn(
      '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
        'Cloud sync, auth, and remote profiles are disabled. ' +
        'Copy .env.example to .env.local and fill in the values.'
    );
  }
}

/** Singleton Supabase client (or null when not configured). */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export function isSupabaseConfigured(): boolean {
  return !!(url && anonKey);
}
