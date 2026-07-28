/**
 * Single source of truth for navigation items (runtime twin of navItems.ts).
 * Keep this file and navItems.ts in sync.
 *
 * Sidebar shows ALL items (NAV_ITEMS). The mobile bar shows a curated 4-tab
 * set (MOBILE_TABS) plus a centre action button (MOBILE_FAB) — see MobileNav.
 */
export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Today',    iconKey: 'home',     mobile: true  },
  { id: 'workouts',  label: 'Workouts',  mobileLabel: 'Train',    iconKey: 'activity', mobile: true  },
  { id: 'planner',   label: 'Plans',     mobileLabel: 'Plans',    iconKey: 'dumbbell', mobile: true  },
  { id: 'progress',  label: 'Progress',  mobileLabel: 'Progress', iconKey: 'chart',    mobile: true  },
  { id: 'records',   label: 'Records',   mobileLabel: 'Records',  iconKey: 'trophy',   mobile: false },
  { id: 'assistant', label: 'AI Coach',  mobileLabel: 'Coach',    iconKey: 'bot',      mobile: false },
  { id: 'profile',   label: 'Profile',   mobileLabel: 'You',      iconKey: 'user',     mobile: true  },
];

/**
 * The four bottom-bar tabs, in order. A raised centre FAB is injected between
 * the 2nd and 3rd tab by MobileNav — it is NOT a tab.
 */
const MOBILE_TAB_IDS = ['dashboard', 'workouts', 'progress', 'profile'];
export const MOBILE_TABS = MOBILE_TAB_IDS.map((id) => NAV_ITEMS.find((n) => n.id === id));

/** The primary action on the mobile bar — opens the AI Coach. Not a tab.
 *  (Starting a workout stays one tap away: the Today hero's START SESSION
 *  button and the Train tab both lead there.) */
export const MOBILE_FAB = {
  label: 'AI Coach',
  iconKey: 'bot',
  routeId: 'assistant',
};
