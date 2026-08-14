import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App for official FCM Messaging on client
const app = initializeApp(firebaseConfig);

let messaging: any = null;
try {
  messaging = getMessaging(app);
} catch (e) {
  console.warn('Firebase Messaging is not supported in this browser:', e);
}

// Node API endpoints
const REGISTER_TOKEN_ENDPOINT = '/api/notifications/register-token';
const SEND_NOTIFICATION_ENDPOINT = '/api/notifications/send';
const VAPID_KEY = "BNphtTRAaQyDZZghboo4RYxGMtP66-O2Fw02PuPrsceXa-UhEz3xz4LA2cMfUCDD9jBGWwYoIf4NTcDSgVTvqRg";

let isForegroundListenerAttached = false;

/**
 * Register user for official Firebase FCM push notifications via Node backend
 */
export const registerNotifications = async (email: string, forceRegister: boolean = false) => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    console.warn('Push notifications or Service Workers are not supported in this environment.');
    return;
  }

  // Check if this device is already registered for this user
  const cacheKey = `fcm_registered_${email}`;
  const cachedToken = localStorage.getItem(cacheKey);

  if (!forceRegister && cachedToken && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    console.log(`[FCM] Device registered in cache for ${email}. Background syncing to MySQL...`);
    fetch(REGISTER_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token: cachedToken })
    }).catch(() => {});
    return;
  }

  try {
    // 1. Check notification permission state
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      // Do NOT trigger browser native popup automatically on app load unless user clicked action button (forceRegister = true)
      if (!forceRegister) {
        console.log('[FCM] Notification permission not granted. Waiting for user soft prompt action.');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission was not granted:', permission);
        return;
      }
    }

    if (!messaging) {
      console.warn('Firebase Messaging is not initialized.');
      return;
    }

    // 2. Obtain active unified PWA Service Worker (contains FCM push handler)
    let registration: ServiceWorkerRegistration | undefined = await navigator.serviceWorker.ready;
    if (!registration) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      registration = registrations[0];
    }

    // 3. Retrieve FCM Token from Firebase
    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey: VAPID_KEY
    });

    if (token) {
      console.log('Official FCM Token obtained:', token);
      
      // 4. Save token to Node API endpoint
      try {
        const res = await fetch(REGISTER_TOKEN_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, token })
        });
        if (res.ok) {
          localStorage.setItem(cacheKey, token);
        }
      } catch (e) { 
        console.warn('Node token registration failed:', e); 
      }
    } else {
      console.warn('No FCM registration token received.');
    }

    // 5. Handle foreground notification messages from Firebase FCM (attached only once)
    if (!isForegroundListenerAttached && messaging) {
      isForegroundListenerAttached = true;
      onMessage(messaging, (payload) => {
        console.log('Received FCM foreground message:', payload);
        const pData = payload.data || payload.notification || {};
        const title = pData.title || 'HKTT CRM';
        const body = pData.body || '';
        if (title && body) {
          const options: NotificationOptions = {
            body: body,
            icon: pData.icon || 'https://thienlong.pro.vn/icon.jpg',
            badge: pData.badge || 'https://thienlong.pro.vn/icon.jpg',
            tag: pData.tag || pData.id || title || 'lioapp-push',
            renotify: false,
            data: pData
          };
          
          if (registration && typeof registration.showNotification === 'function') {
            registration.showNotification(title, options).catch(() => {
              new Notification(title, options);
            });
          } else {
            new Notification(title, options);
          }
        }
      });
    }

  } catch (error) {
    console.error('Error in FCM registerNotifications:', error);
  }
};

/**
 * Trigger a push notification via Node API endpoint using FCM
 */
export const sendPushNotification = async (recipientEmail: string, title: string, body: string, data?: any) => {
  try {
    await fetch(SEND_NOTIFICATION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail, title, body, data })
    });
  } catch (error) {
    console.error('Error sending push notification via Node API:', error);
  }
};

/**
 * Clear FCM registration cache on account logout
 */
export const unregisterNotifications = async (email: string) => {
  if (typeof window === 'undefined') return;
  const cacheKey = `fcm_registered_${email}`;
  localStorage.removeItem(cacheKey);
  console.log(`[FCM] Unregistered device cache for ${email}`);
};
