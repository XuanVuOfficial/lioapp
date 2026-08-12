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

/**
 * Register user for official Firebase FCM push notifications via Node backend
 */
export const registerNotifications = async (email: string) => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    console.warn('Push notifications or Service Workers are not supported in this environment.');
    return;
  }

  try {
    // 1. Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission was not granted:', permission);
      return;
    }

    if (!messaging) {
      console.warn('Firebase Messaging is not initialized.');
      return;
    }

    // 2. Register FCM Service Worker
    let registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) {
      try {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        console.log('Official FCM Service Worker registered at root:', registration);
      } catch (swErr) {
        console.error('Service Worker registration failed:', swErr);
      }
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
        await fetch(REGISTER_TOKEN_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, token })
        });
      } catch (e) { 
        console.warn('Node token registration failed:', e); 
      }
    } else {
      console.warn('No FCM registration token received.');
    }

    // 5. Handle foreground notification messages from Firebase FCM
    onMessage(messaging, (payload) => {
      console.log('Received FCM foreground message:', payload);
      if (payload.notification) {
        const title = payload.notification.title || 'HKTT CRM';
        const options: NotificationOptions = {
          body: payload.notification.body || '',
          icon: 'https://thienlong.pro.vn/khachhang/icon.jpg',
          badge: 'https://thienlong.pro.vn/khachhang/icon.jpg',
          data: payload.data || {}
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
