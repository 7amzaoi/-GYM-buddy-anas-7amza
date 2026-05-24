export const ROUTES = {
  landing: '/',
  login: '/login',
  register: '/register',
  download: '/download',
  dashboard: '/dashboard',
  workouts: '/workouts',
  planner: '/planner',
  progress: '/progress',
  records: '/records',
  assistant: '/assistant',
  profile: '/profile',
};

/** @returns { keyof typeof ROUTES | 'landing' } */
export function pageIdFromPath(pathname) {
  const found = Object.entries(ROUTES).find(([, p]) => p === pathname);
  return found ? found[0] : 'landing';
}

export function pathForPage(pageId) {
  return ROUTES[pageId] ?? ROUTES.landing;
}
