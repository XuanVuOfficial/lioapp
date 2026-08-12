// public/firebase-messaging-sw.js - Official Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
firebase.initializeApp({
  apiKey: "AIzaSyBHcEy4GNb8LKrcx3onJb1ERpL2pRZduTU",
  authDomain: "tets-14775.firebaseapp.com",
  projectId: "tets-14775",
  storageBucket: "tets-14775.firebasestorage.app",
  messagingSenderId: "469611606338",
  appId: "1:469611606338:web:d95dd111e5dfa4d32158db"
});

const messaging = firebase.messaging();

// Raw Push Event Handler for 100% Android & PC Notification Display Reliability
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Raw Push event received:', event);

  let title = 'HKTT CRM';
  let body = 'Bạn có thông báo mới!';
  let icon = 'https://thienlong.pro.vn/icon.jpg';
  let badge = 'https://thienlong.pro.vn/icon.jpg';
  let url = 'https://thienlong.pro.vn';
  let customData = {};

  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[firebase-messaging-sw.js] Parsed push payload:', payload);

      const notif = payload.notification || payload.webpush?.notification || {};
      const pData = payload.data || {};

      title = notif.title || pData.title || title;
      body = notif.body || pData.body || body;
      icon = notif.icon || pData.icon || icon;
      badge = notif.badge || pData.badge || badge;
      url = pData.url || pData.link || payload.webpush?.fcmOptions?.link || url;
      customData = pData;
    } catch (e) {
      body = event.data.text() || body;
    }
  }

  const notificationOptions = {
    body: body,
    icon: icon,
    badge: badge,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: {
      ...customData,
      url: url
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// Handle background messages via Firebase SDK
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);
});

// Handle notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
