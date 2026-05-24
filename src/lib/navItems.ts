/**
 * Single source of truth for navigation items.
 * Sidebar shows ALL items; MobileNav shows only `mobile: true` ones (max 5 fit a bottom bar).
 */
export type NavIconKey =
  | 'home'
  | 'activity'
  | 'dumbbell'
  | 'chart'
  | 'trophy'
  | 'bot'
  | 'user';

export type NavId =
  | 'dashboard'
  | 'workouts'
  | 'planner'
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
  { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Home',     iconKey: 'home',     mobile: true  },
  { id: 'workouts',  label: 'Workouts',  mobileLabel: 'Workouts', iconKey: 'activity', mobile: true  },
  { id: 'planner',   label: 'Plans',     mobileLabel: 'Plans',    iconKey: 'dumbbell', mobile: true  },
  { id: 'progress',  label: 'Progress',  mobileLabel: 'Progress', iconKey: 'chart',    mobile: true  },
  { id: 'records',   label: 'Records',   mobileLabel: 'Records',  iconKey: 'trophy',   mobile: false },
  { id: 'assistant', label: 'AI Coach',  mobileLabel: 'Coach',    iconKey: 'bot',      mobile: false },
  { id: 'profile',   label: 'Profile',   mobileLabel: 'Profile',  iconKey: 'user',     mobile: true  },
];

export const MOBILE_NAV_ITEMS: NavItem[] = NAV_ITEMS.filter((n) => n.mobile);
