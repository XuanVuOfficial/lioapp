import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

let isUpdatingTriggered = false;

const triggerAppUpdate = (reloadFn?: () => void) => {
  if (isUpdatingTriggered) return;
  isUpdatingTriggered = true;
  console.log('[PWA] New version detected! Showing updating screen...');
  window.dispatchEvent(new CustomEvent('pwa-updating-app'));

  setTimeout(() => {
    if (reloadFn) {
      reloadFn();
    } else {
      window.location.reload();
    }
  }, 1200);
};

// Register PWA service worker with autoUpdate mode & 1-minute ping interval
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] onNeedRefresh triggered.');
    triggerAppUpdate(() => {
      if (updateSW) updateSW(true);
      else window.location.reload();
    });
  },
  onOfflineReady() {
    console.log('[PWA] App is ready to work offline.');
  },
  onRegisteredSW(swUrl, registration) {
    if (registration) {
      // 1. Ping check update immediately on app load
      registration.update().catch(() => {});

      // 2. Ping check update every 1 minute (60s)
      const ONE_MINUTE_MS = 60 * 1000;
      setInterval(() => {
        console.log('[PWA] 1-minute interval: Checking for app updates...');
        registration.update().catch(() => {});
      }, ONE_MINUTE_MS);

      // 3. Ping check update when user switches back to app
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      });
    }
  }
});

// Listen to service worker controller change (e.g. new SW active)
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[PWA] Service Worker controller changed.');
    triggerAppUpdate(() => window.location.reload());
  });
}

// Check version upgrade in localStorage to clear old cache on version bump
const currentVersion = (window as any).__APP_VERSION__ || '0.0.0';
const savedVersion = localStorage.getItem('hktt_app_version');

if (savedVersion && savedVersion !== currentVersion) {
  console.log(`%c [PWA Upgrade] ${savedVersion} -> ${currentVersion} `, 'background: #059669; color: #fff; font-weight: bold;');
  localStorage.setItem('hktt_app_version', currentVersion);
  if (typeof window !== 'undefined' && 'caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name);
      });
    });
  }
} else if (!savedVersion) {
  localStorage.setItem('hktt_app_version', currentVersion);
}

console.log(`%c HKTT CRM v${currentVersion} `, 'background: #059669; color: #fff; font-weight: bold;');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
