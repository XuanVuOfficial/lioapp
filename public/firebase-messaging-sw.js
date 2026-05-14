// Provide default config for the service worker
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDgI3tKou03KY50r7y-xgR86V32sdck0ZQ",
  authDomain: "untitled1-b15a7.firebaseapp.com",
  projectId: "untitled1-b15a7",
  storageBucket: "untitled1-b15a7.firebasestorage.app",
  messagingSenderId: "696442413906",
  appId: "1:696442413906:web:aae870477f7c6d3aded08b",
  measurementId: "G-WNP1WQWETN"
};

// Initialize Firebase in the service worker
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification?.title || 'Thông báo mới';
  const notificationOptions = {
    body: payload.notification?.body || 'Bạn có một khách hàng mới được chia.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
