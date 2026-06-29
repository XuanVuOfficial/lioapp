import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

let messaging: any = null;
try {
  messaging = getMessaging(app);
} catch (e) {
  console.warn('Firebase Messaging is not supported in this browser:', e);
}

/**
 * Register user for push notifications
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

    // 2. Register the specific firebase-messaging-sw.js
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
    console.log('FCM Service Worker registered successfully:', registration);

    // 3. Retrieve FCM Token
    // We can allow VAPID key override from environment variable if configured
    //const vapidKey = (import.meta as any).env.VITE_FIREBASE_VAPID_KEY || undefined;
    const vapidKey = "BNphtTRAaQyDZZghboo4RYxGMtP66-O2Fw02PuPrsceXa-UhEz3xz4LA2cMfUCDD9jBGWwYoIf4NTcDSgVTvqRg";
    
    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey: vapidKey
    });

    if (token) {
      console.log('FCM Token retrieved:', token);
      
      // 4. Register the token with our local Express backend
      await fetch('/api/register-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, token })
      });
      console.log('FCM Token registered with backend server for user:', email);
    } else {
      console.warn('No registration token available. Request permission to generate one.');
    }

    // 5. Handle foreground notifications (when app is currently open)
    onMessage(messaging, (payload) => {
      console.log('Received foreground message:', payload);
      if (payload.notification) {
        // Show browser notification while app is in foreground
        const title = payload.notification.title || 'HKTT CRM';
        const options = {
          body: payload.notification.body || '',
          icon: 'https://app.xuanvu.click/khachhang/icon.jpg',
          badge: 'https://app.xuanvu.click/khachhang/icon.jpg'
        };
        new Notification(title, options);
      }
    });

  } catch (error) {
    console.error('Error registering push notifications:', error);
  }
};

/**
 * Helper to trigger a notification request on the Express server
 */
export const sendPushNotification = async (recipientEmail: string, title: string, body: string, data?: any) => {
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipientEmail, title, body, data })
    });
    if (!res.ok) {
      console.warn('Failed to trigger push notification:', await res.text());
    }
  } catch (error) {
    console.error('Error sending push notification via API:', error);
  }
};
