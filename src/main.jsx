import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Store } from './store.js';
import './gsap.config.js';
import './styles/index.css';
import App from './App.jsx';
import { hydrateAuthSession, ensureAuthSubscription } from './lib/authBootstrap.js';
import { initAccent } from './lib/personalization.js';

initAccent();
Store.init();
void hydrateAuthSession();
ensureAuthSubscription();

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </HashRouter>
  </React.StrictMode>
);
