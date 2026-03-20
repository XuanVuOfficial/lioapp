import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker
registerSW({ immediate: true });

// Log application version
const appVersion = (window as any).__APP_VERSION__ || '0.0.0';
console.log(`%c SalesPro CRM v${appVersion} `, 'background: #059669; color: #fff; font-weight: bold;');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
