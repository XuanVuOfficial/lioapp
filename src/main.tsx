import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker with auto-update & auto-refresh
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New version detected! Automatically updating and reloading...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[PWA] App is ready to work offline.');
  }
});

// Auto-reload page when new service worker takes over
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      console.log('[PWA] Controller changed. Reloading page for new version...');
      window.location.reload();
    }
  });

  // Periodically check for updates every 5 minutes and when app becomes visible
  const checkUpdate = () => {
    navigator.serviceWorker.ready.then((registration) => {
      registration.update().catch(() => {});
    });
  };

  setInterval(checkUpdate, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkUpdate();
    }
  });
}

// Log application version
const appVersion = (window as any).__APP_VERSION__ || '0.0.0';
console.log(`%c SalesPro CRM v${appVersion} `, 'background: #059669; color: #fff; font-weight: bold;');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
