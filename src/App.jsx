import { useEffect, useLayoutEffect, useReducer, useCallback, useState, useRef, lazy, Suspense } from 'react';
import { flushSync } from 'react-dom';
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Store } from './store.js';
import { pathForPage, pageIdFromPath } from './routes.js';
import { NAV_ITEMS } from './lib/navItems.js';
import { NavigateContext } from './context/NavigateContext.jsx';
import { registerNavigator, initGlobalInteractions, initCounters, initScrollReveal } from './lib/interactions.js';

// Canonical left-to-right order of the app's pages, used to pick a transition
// direction: navigating to a later page slides forward (in from the right); to
// an earlier page slides back (in from the left).
const NAV_ORDER = NAV_ITEMS.map((n) => n.id);
import { isOnboarded } from './lib/personalization.js';
import Sidebar from './components/Sidebar.jsx';
import MobileNav from './components/MobileNav.jsx';
import ActiveSessionBar from './components/ActiveSessionBar.jsx';
import Onboarding from './components/Onboarding.jsx';
import PageSkeleton from './components/PageSkeleton.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';


/* Route-level code splitting. Marketing surfaces (Landing, Download, auth)
 * are the biggest win — an app user loads them once, if ever, yet they were
 * bundled into the shell every session. Each page now ships as its own chunk
 * fetched on navigation. */
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const DownloadPage = lazy(() => import('./pages/DownloadPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const WorkoutsPage = lazy(() => import('./pages/WorkoutsPage.jsx'));
const PlannerPage = lazy(() => import('./pages/PlannerPage.jsx'));
const LibraryPage = lazy(() => import('./pages/LibraryPage.jsx'));
const SharedSplitPage = lazy(() => import('./pages/SharedSplitPage.jsx'));
const ProgressPage = lazy(() => import('./pages/ProgressPage.jsx'));
const RecordsPage = lazy(() => import('./pages/RecordsPage.jsx'));
const AssistantPage = lazy(() => import('./pages/AssistantPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));

function AuthenticatedChrome() {
  const user = Store.get('user');
  const location = useLocation();
  const mainRef = useRef(null);
  // Show the first-login onboarding overlay until the user finishes it.
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboarded());

  // Turn the app chrome into an inner-scroll shell: the document itself never
  // scrolls (see `.app-shell` CSS), so the mobile address bar can't collapse
  // and the fixed bottom nav stays pinned on every page, tall or short.
  useEffect(() => {
    document.documentElement.classList.add('app-shell');
    return () => document.documentElement.classList.remove('app-shell');
  }, []);

  // Reset the inner scroll container to the top on each route change (the
  // element persists across child routes, so its scrollTop would otherwise stick).
  useEffect(() => {
    mainRef.current?.scrollTo?.(0, 0);
  }, [location.pathname]);

  // App boot for a signed-in user: load the notification feed, then let the
  // suggestion engine decide whether anything new deserves to exist. This
  // chrome mounts once and survives route changes, so it runs once per session
  // rather than on every navigation. Both calls swallow their own errors.
  useEffect(() => {
    if (!user) return;
    void Store.refreshNotifications();
    void Store._runNotificationSuggestions('boot');
  }, [user]);

  /* Redirect-after-login. There was no existing pattern to follow here — the
     bare <Navigate to="/login"> below used to discard where the visitor was
     heading, which is fine for a tab but not for a share link someone was
     sent. The intended path rides along in router state and LoginPage sends
     them back after a successful sign-in.

     This returns BEFORE <Outlet/> renders, so a protected page never mounts
     for a logged-out visitor — no content flashes before the redirect. */
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return (
    <>
      <Sidebar />
      <main
        className="main-content page"
        ref={mainRef}
        style={{ paddingBottom: 'calc(var(--tabbar-total) + var(--space-6))' }}
      >
        <ErrorBoundary resetKey={location.pathname}>
          {/* Inside the chrome: the sidebar and tab bar stay mounted while a
              page chunk downloads, so only the content area shows a skeleton. */}
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <ActiveSessionBar />
      <MobileNav />
      {showOnboarding && <Onboarding onComplete={() => setShowOnboarding(false)} />}
    </>
  );
}

export default function App() {
  const [, bump] = useReducer((x) => x + 1, 0);
  useEffect(() => Store.subscribe(() => bump()), []);

  const rrNavigate = useNavigate();
  const location = useLocation();
  // The page we're currently on, so navigateToPage can pick a slide direction.
  const currentPageRef = useRef(pageIdFromPath(location.pathname));

  const navigateToPage = useCallback((pageId) => {
    const publicPages = ['landing', 'login', 'register', 'download'];
    let page = pageId;
    if (!publicPages.includes(page) && !Store.get('user')) page = 'login';

    const targetPath = pathForPage(page);
    const apply = () => {
      rrNavigate(targetPath);
      window.scrollTo(0, 0);
      Store.set('currentPage', page);
    };

    const from = currentPageRef.current;
    currentPageRef.current = page;

    // Skip the transition when we're already here, when the View Transition API
    // is unavailable, or when the user prefers reduced motion — just navigate.
    const canAnimate =
      location.pathname !== targetPath &&
      typeof document !== 'undefined' &&
      typeof document.startViewTransition === 'function' &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canAnimate) {
      apply();
      return;
    }

    const fi = NAV_ORDER.indexOf(from);
    const ti = NAV_ORDER.indexOf(page);
    document.documentElement.dataset.nav = fi >= 0 && ti >= 0 && ti < fi ? 'back' : 'forward';
    // flushSync forces React Router's DOM update to commit *inside* the
    // transition callback, so the API captures the new page (not the old one).
    // Required because we drive navigation ourselves rather than via a
    // view-transition-aware router integration.
    document.startViewTransition(() => flushSync(apply));
  }, [rrNavigate, location.pathname]);

  useEffect(() => registerNavigator(navigateToPage), [navigateToPage]);

  useEffect(() => {
    initGlobalInteractions();
  }, []);

  useLayoutEffect(() => {
    Store.set('currentPage', pageIdFromPath(location.pathname));
    const id = requestAnimationFrame(() => {
      initCounters();
      initScrollReveal();
    });
    return () => cancelAnimationFrame(id);
  }, [location.pathname]);

  return (
    <NavigateContext.Provider value={navigateToPage}>
      <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/download" element={<DownloadPage />} />

        <Route element={<AuthenticatedChrome />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/workouts" element={<WorkoutsPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/library" element={<LibraryPage />} />
          {/* Only param route in the app. Inside AuthenticatedChrome, so the
              auth gate above covers it — a shared link is never viewable
              logged out. */}
          <Route path="/split/:slug" element={<SharedSplitPage />} />
          {/* Legacy /session URLs now redirect to the unified Workouts page. */}
          <Route path="/session" element={<Navigate to="/workouts" replace />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </NavigateContext.Provider>
  );
}
