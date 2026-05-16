import { createClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = 'https://kkdubeokztzyhwpzjzhb.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrZHViZW9renR6eWh3cHpqemhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2OTc5MzUsImV4cCI6MjA5MzI3MzkzNX0._dr77ItmiNqk_n2hKK0Sx0z0grO7Rh_V-4OKB_ev6k8';

const url = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

/** Singleton Supabase client. Never put service_role key here. */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export function isSupabaseConfigured() {
  return !!(url && anonKey);
}
