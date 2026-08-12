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

// Handle background messages via Firebase SDK
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  const title = payload.notification?.title || payload.data?.title || 'HKTT CRM';
  const body = payload.notification?.body || payload.data?.body || '';
  const icon = payload.notification?.icon || payload.data?.icon || 'https://thienlong.pro.vn/khachhang/icon.jpg';
  const badge = payload.notification?.badge || payload.data?.badge || 'https://thienlong.pro.vn/khachhang/icon.jpg';
  const targetUrl = payload.data?.url || payload.data?.link || payload.fcmOptions?.link || '/';

  const notificationOptions = {
    body: body,
    icon: icon,
    badge: badge,
    requireInteraction: true,
    data: {
      ...(payload.data || {}),
      url: targetUrl
    }
  };

  return self.registration.showNotification(title, notificationOptions);
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

