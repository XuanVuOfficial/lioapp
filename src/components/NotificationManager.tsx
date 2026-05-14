import React, { useEffect, useState, useRef } from 'react';
import { Lead } from '../types';
import { Bell, X } from 'lucide-react';

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
      }
    };
    checkPermission();
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setShowPermissionModal(false);
      } else {
        setShowPermissionModal(false);
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      setShowPermissionModal(false);
    }
  };

  const sendNotification = async (title: string, body: string) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          registration.showNotification(title, {
            body,
            icon: 'https://app.xuanvu.click/khachhang/icon.jpg',
            vibrate: [200, 100, 200]
          });
        } else {
           new Notification(title, { body, icon: 'https://app.xuanvu.click/khachhang/icon.jpg' });
        }
      } catch (err) {
        new Notification(title, { body, icon: 'https://app.xuanvu.click/khachhang/icon.jpg' });
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

    // Check for new assignments
    leads.forEach(lead => {
      const prevLead = prevMap.get(lead.id);
      
      // If it's a new lead assigned to me
      if (!prevLead && lead.assignedToEmail === userEmail) {
        sendNotification(
          "Khách hàng mới được chia",
          `Bạn vừa được chia khách hàng: ${lead.name || lead.phone}`
        );
      }
      // Or if it's an existing lead but newly assigned to me
      else if (prevLead && prevLead.assignedToEmail !== userEmail && lead.assignedToEmail === userEmail) {
        sendNotification(
          "Nhận khách hàng mới",
          `Khách hàng ${lead.name || lead.phone} vừa được chuyển cho bạn.`
        );
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
          Cho phép ứng dụng gửi thông báo cho bạn mỗi khi có khách hàng mới được chia để không bỏ lỡ công việc.
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
