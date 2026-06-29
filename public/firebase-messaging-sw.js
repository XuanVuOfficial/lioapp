// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker.
// These credentials match firebase-applet-config.json
firebase.initializeApp({
  apiKey: "AIzaSyBHcEy4GNb8LKrcx3onJb1ERpL2pRZduTU",
  authDomain: "tets-14775.firebaseapp.com",
  projectId: "tets-14775",
  storageBucket: "tets-14775.firebasestorage.app",
  messagingSenderId: "469611606338",
  appId: "1:469611606338:web:d95dd111e5dfa4d32158db"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'HKTT CRM';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: 'https://app.xuanvu.click/khachhang/icon.jpg',
    badge: 'https://app.xuanvu.click/khachhang/icon.jpg',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
