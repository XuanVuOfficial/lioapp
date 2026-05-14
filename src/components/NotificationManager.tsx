import React, { useEffect, useState, useRef } from 'react';
import { Lead } from '../types';
import { Bell } from 'lucide-react';
import { messaging, getToken, onMessage, database, ref, set } from '../firebase';

interface NotificationManagerProps {
  userEmail: string;
  leads: Lead[];
}

export const NotificationManager: React.FC<NotificationManagerProps> = ({ userEmail, leads }) => {
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const prevLeadsRef = useRef<Map<string, Lead>>(new Map());
  const initialLoadRef = useRef(true);

  // Ask for permission popup
  useEffect(() => {
    const checkPermission = async () => {
      if (!('Notification' in window)) return;
      
      if (Notification.permission === 'default') {
        // Delay a bit before showing to not flash immediately on load
        setTimeout(() => setShowPermissionModal(true), 1500);
      } else if (Notification.permission === 'granted') {
        setupFCM();
      }
    };
    checkPermission();
  }, [userEmail]);

  const setupFCM = async () => {
    if (!messaging) return;
    try {
      // NOTE: For a production app, you can pass a vapidKey generated from Firebase Console
      // to getToken(messaging, { vapidKey: "YOUR_PUBLIC_VAPID_KEY_HERE" });
      const currentToken = await getToken(messaging);
      
      if (currentToken) {
        // Save token to Realtime Database so backend/server can push
        const encodedEmail = userEmail.replace(/\./g, '_');
        await set(ref(database, `fcmTokens/${encodedEmail}`), currentToken);
        console.log("FCM Token saved for push notifications.");
      } else {
        console.warn('No registration token available. Request permission to generate one.');
      }

      // Foreground message handler
      onMessage(messaging, (payload) => {
        console.log("Foreground message received:", payload);
        if (payload.notification) {
          sendLocalNotification(payload.notification.title || "Thông báo", payload.notification.body || "");
        }
      });

    } catch (err) {
      console.error('An error occurred while retrieving token. ', err);
    }
  };

  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setShowPermissionModal(false);
        setupFCM();
      } else {
        setShowPermissionModal(false);
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      setShowPermissionModal(false);
    }
  };

  const sendLocalNotification = async (title: string, body: string) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          registration.showNotification(title, {
            body,
            icon: '/pwa-192x192.png',
            vibrate: [200, 100, 200]
          } as any);
        } else {
           new Notification(title, { body, icon: '/pwa-192x192.png' });
        }
      } catch (err) {
        new Notification(title, { body, icon: '/pwa-192x192.png' });
      }
    }
  };

  useEffect(() => {
    if (initialLoadRef.current) {
      // populate ref on first load
      const map = new Map();
      leads.forEach(l => map.set(l.id, l));
      prevLeadsRef.current = map;
      initialLoadRef.current = false;
      return;
    }

    const currentMap = new Map();
    leads.forEach(l => currentMap.set(l.id, l));
    const prevMap = prevLeadsRef.current;

    // Check for new assignments (Local fallback in front-end when app is OPEN)
    leads.forEach(lead => {
      const prevLead = prevMap.get(lead.id);
      
      if (!prevLead && lead.assignedToEmail === userEmail) {
        sendLocalNotification("Khách hàng mới", `Bạn vừa được chia: ${lead.name || lead.phone}`);
      }
      else if (prevLead && prevLead.assignedToEmail !== userEmail && lead.assignedToEmail === userEmail) {
        sendLocalNotification("Nhận khách hàng mới", `Khách hàng ${lead.name || lead.phone} vừa được chuyển cho bạn.`);
      }
    });

    prevLeadsRef.current = currentMap;
  }, [leads, userEmail]);

  if (!showPermissionModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Bell className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-center text-slate-900 mb-2">
          Bật thông báo
        </h3>
        <p className="text-sm text-slate-600 text-center mb-6">
          Cho phép gửi thông báo khi có khách hàng mới được chia. Khi bạn tắt màn hình, thông báo vẫn sẽ hoạt động nhờ FCM.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPermissionModal(false)}
            className="flex-1 px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
          >
            Để sau
          </button>
          <button
            onClick={requestPermission}
            className="flex-1 px-4 py-2 bg-emerald-600 text-white font-medium hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
          >
            Cho phép
          </button>
        </div>
      </div>
    </div>
  );
};
