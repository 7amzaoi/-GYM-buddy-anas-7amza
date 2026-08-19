export const ROUTES = {
  landing: '/',
  login: '/login',
  register: '/register',
  download: '/download',
  dashboard: '/dashboard',
  workouts: '/workouts',
  planner: '/planner',
  library: '/library',
  progress: '/progress',
  records: '/records',
  assistant: '/assistant',
  profile: '/profile',
  /* First route in the app with a dynamic segment. The map stays flat strings
     so pathForPage keeps working for every other page; the `:slug` form is the
     pattern React Router matches on, and pathForSharedSplit builds the real
     path. pageIdFromPath needs the prefix test below because an actual URL
     (/split/ab12cd34) never equals this literal. */
  sharedSplit: '/split/:slug',
};

/** Real path for a share link. */
export function pathForSharedSplit(slug) {
  return `/split/${slug}`;
}

/** @returns { keyof typeof ROUTES | 'landing' } */
export function pageIdFromPath(pathname) {
  // Dynamic segment: matched by prefix, since the stored value is a pattern.
  if (typeof pathname === 'string' && pathname.startsWith('/split/')) return 'sharedSplit';
  const found = Object.entries(ROUTES).find(([, p]) => p === pathname);
  return found ? found[0] : 'landing';
}

export function pathForPage(pageId) {
  return ROUTES[pageId] ?? ROUTES.landing;
}
