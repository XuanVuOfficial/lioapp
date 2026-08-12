import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker with autoUpdate mode
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New version detected by Workbox.');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[PWA] App is ready to work offline.');
  }
});

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
