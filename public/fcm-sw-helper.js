// public/fcm-sw-helper.js - Firebase FCM logic imported into main PWA Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

try {
  firebase.initializeApp({
    apiKey: "AIzaSyBHcEy4GNb8LKrcx3onJb1ERpL2pRZduTU",
    authDomain: "tets-14775.firebaseapp.com",
    projectId: "tets-14775",
    storageBucket: "tets-14775.firebasestorage.app",
    messagingSenderId: "469611606338",
    appId: "1:469611606338:web:d95dd111e5dfa4d32158db"
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[fcm-sw-helper] Received background message:', payload);
    const pData = payload.data || payload.notification || {};

    const title = pData.title || 'HKTT CRM';
    const body = pData.body || 'Bạn có thông báo mới!';
    const icon = pData.icon || 'https://thienlong.pro.vn/icon.jpg';
    const badge = pData.badge || 'https://thienlong.pro.vn/icon.jpg';
    const tag = pData.tag || pData.id || title || 'lioapp-push';

    return self.registration.showNotification(title, {
      body: body,
      icon: icon,
      badge: badge,
      tag: tag,
      renotify: false,
      vibrate: [200, 100, 200],
      requireInteraction: true,
      data: {
        ...pData,
        url: pData.url || pData.link || 'https://thienlong.pro.vn'
      }
    });
  });
} catch (e) {
  console.warn('[fcm-sw-helper] Firebase init error:', e);
}

// Notification Click Event Handler
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
