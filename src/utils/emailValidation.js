/** Stricter-than-`input type=email` check (still not perfect; Supabase verifies by mail anyway). */
export function isProbablyValidSignupEmail(email) {
  const s = String(email || '').trim().toLowerCase();
  if (s.length < 5 || s.length > 254) return false;
  const at = s.indexOf('@');
  if (at < 1) return false;
  const dot = s.lastIndexOf('.');
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  if (!domain || !domain.includes('.')) return false;
  if (dot <= at || dot >= s.length - 2) return false;
  if (local.includes('..') || domain.includes('..')) return false;
  if (/^[-_.]|[_.-]$/.test(domain)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}
