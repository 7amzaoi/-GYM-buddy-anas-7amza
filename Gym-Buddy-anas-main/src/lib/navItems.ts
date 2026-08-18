/**
 * Single source of truth for navigation items.
 * Sidebar shows ALL items (NAV_ITEMS). The mobile bar shows a curated 4-tab
 * set (MOBILE_TABS) plus a centre action button (MOBILE_FAB) — see MobileNav.
 */
export type NavIconKey =
  | 'home'
  | 'activity'
  | 'dumbbell'
  | 'chart'
  | 'trophy'
  | 'bot'
  | 'user'
  | 'plus'
  | 'target';

export type NavId =
  | 'dashboard'
  | 'workouts'
  | 'planner'
  | 'library'
  | 'progress'
  | 'records'
  | 'assistant'
  | 'profile';

export interface NavItem {
  id: NavId;
  label: string;
  mobileLabel: string;
  iconKey: NavIconKey;
  mobile: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Today',    iconKey: 'home',     mobile: true  },
  { id: 'workouts',  label: 'Workouts',  mobileLabel: 'Train',    iconKey: 'activity', mobile: true  },
  { id: 'planner',   label: 'Plans',     mobileLabel: 'Plans',    iconKey: 'dumbbell', mobile: true  },
  { id: 'library',   label: 'Exercises', mobileLabel: 'Exercises', iconKey: 'target',  mobile: false },
  { id: 'progress',  label: 'Progress',  mobileLabel: 'Progress', iconKey: 'chart',    mobile: true  },
  { id: 'records',   label: 'Records',   mobileLabel: 'Records',  iconKey: 'trophy',   mobile: false },
  { id: 'assistant', label: 'AI Coach',  mobileLabel: 'Coach',    iconKey: 'bot',      mobile: false },
  { id: 'profile',   label: 'Profile',   mobileLabel: 'You',      iconKey: 'user',     mobile: true  },
];

/**
 * The four bottom-bar tabs, in order. A raised centre FAB is injected between
 * the 2nd and 3rd tab by MobileNav — it is NOT a tab.
 */
const MOBILE_TAB_IDS: NavId[] = ['dashboard', 'workouts', 'progress', 'profile'];
export const MOBILE_TABS: NavItem[] = MOBILE_TAB_IDS.map(
  (id) => NAV_ITEMS.find((n) => n.id === id) as NavItem
);

export interface FabAction {
  label: string;
  iconKey: NavIconKey;
  routeId: NavId;
}

/** The primary action on the mobile bar — starts a workout. Not a tab. */
export const MOBILE_FAB: FabAction = {
  label: 'AI Coach',
  iconKey: 'bot',
  routeId: 'assistant',
};
