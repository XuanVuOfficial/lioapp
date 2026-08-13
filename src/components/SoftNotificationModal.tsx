import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BellRing, ShieldCheck, CheckCircle2, X } from 'lucide-react';
import { UserProfile } from '../types';
import { registerNotifications } from '../services/notificationService';

interface Props {
  user: UserProfile | null;
}

export const SoftNotificationModal: React.FC<Props> = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    // Show soft prompt if permission is 'default' and not dismissed
    const isDismissed = localStorage.getItem('soft_notif_dismissed') === 'true';
    if (Notification.permission === 'default' && !isDismissed) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleEnableNotifications = async () => {
    setIsRegistering(true);
    try {
      // 1. Request native browser notification permission
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // 2. Register FCM push token
        await registerNotifications(user.email, true);
        localStorage.removeItem('soft_notif_dismissed');
      } else {
        localStorage.setItem('soft_notif_dismissed', 'true');
      }
    } catch (e) {
      console.error('Error enabling notifications:', e);
    } finally {
      setIsRegistering(false);
      setIsOpen(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('soft_notif_dismissed', 'true');
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative text-center"
        >
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-100 shadow-sm animate-bounce">
            <BellRing className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-bold text-slate-900 mb-2">Bật Thông báo công việc 🔔</h3>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Nhận thông báo ngay lập tức khi được chia khách hàng mới, thu hồi khách quá hạn hoặc có cập nhật công việc quan trọng.
          </p>

          <div className="bg-amber-50/80 border border-amber-200/80 p-3.5 rounded-2xl text-left text-xs text-amber-900 font-medium mb-6 leading-relaxed flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <span>Để nhận thông báo vui lòng bấm <strong>Cho phép</strong> ở màn hình tiếp theo (Allow)</span>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleEnableNotifications}
              disabled={isRegistering}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isRegistering ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-4.5 h-4.5" />
              )}
              Tôi đã hiểu, Bật thông báo ngay
            </button>

            <button
              onClick={handleDismiss}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs transition-colors"
            >
              Để sau
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
