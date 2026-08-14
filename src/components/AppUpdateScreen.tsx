import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, RefreshCw } from 'lucide-react';

export const AppUpdateScreen: React.FC = () => {
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleUpdateEvent = () => {
      setIsUpdating(true);
    };

    window.addEventListener('pwa-updating-app', handleUpdateEvent);
    return () => {
      window.removeEventListener('pwa-updating-app', handleUpdateEvent);
    };
  }, []);

  return (
    <AnimatePresence>
      {isUpdating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-white text-center select-none"
        >
          {/* Logo with pulsing glow & spinning border */}
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 flex items-center justify-center shadow-2xl shadow-emerald-500/20">
              <img
                src="https://thienlong.pro.vn/icon.jpg"
                alt="HKTT CRM Logo"
                className="w-full h-full object-cover rounded-2xl"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="absolute -inset-2.5 border-2 border-emerald-400/80 border-t-transparent rounded-[28px] animate-spin" />
          </div>

          {/* Heading */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Đang nâng cấp ứng dụng</span>
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
            Đang cập nhật phiên bản mới...
          </h2>
          <p className="text-sm text-slate-400 max-w-xs md:max-w-sm leading-relaxed mb-6">
            Hệ thống đang đồng bộ dữ liệu mới nhất từ máy chủ. Trang sẽ tự động tải lại trong giây lát.
          </p>

          {/* Animated Progress bar */}
          <div className="w-56 md:w-64 h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/60 relative">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 rounded-full w-full"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-4">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Tự động cập nhật không cần thoát ứng dụng</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
