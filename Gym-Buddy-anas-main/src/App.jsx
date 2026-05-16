import { useEffect, useLayoutEffect, useReducer, useCallback } from 'react';
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Store } from './store.js';
import { pathForPage, pageIdFromPath } from './routes.js';
import { NavigateContext } from './context/NavigateContext.jsx';
import { registerNavigator, initGlobalInteractions, initCounters, initScrollReveal } from './lib/interactions.js';
import Sidebar from './components/Sidebar.jsx';
import MobileNav from './components/MobileNav.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DownloadPage from './pages/DownloadPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PlannerPage from './pages/PlannerPage.jsx';
import SessionPage from './pages/SessionPage.jsx';
import ProgressPage from './pages/ProgressPage.jsx';
import RecordsPage from './pages/RecordsPage.jsx';
import AssistantPage from './pages/AssistantPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

function AuthenticatedChrome() {
  const user = Store.get('user');
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <Sidebar />
      <main className="main-content page">
        <Outlet />
      </main>
      <MobileNav />
    </>
  );
}

export default function App() {
  const [, bump] = useReducer((x) => x + 1, 0);
  useEffect(() => Store.subscribe(() => bump()), []);

  const rrNavigate = useNavigate();
  const location = useLocation();

  const navigateToPage = useCallback((pageId) => {
    const publicPages = ['landing', 'login', 'register', 'download'];
    let page = pageId;
    if (!publicPages.includes(page) && !Store.get('user')) page = 'login';
    rrNavigate(pathForPage(page));
    window.scrollTo(0, 0);
    Store.set('currentPage', page);
  }, [rrNavigate]);

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
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/download" element={<DownloadPage />} />

        <Route element={<AuthenticatedChrome />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/session" element={<SessionPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </NavigateContext.Provider>
  );
}
