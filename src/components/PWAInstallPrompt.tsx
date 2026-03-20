import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Share, PlusSquare, X, Smartphone } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'other'>('other');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(ua);
    const isIos = /iphone|ipad|ipod/.test(ua);

    if (isAndroid) setPlatform('android');
    else if (isIos) setPlatform('ios');

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    
    if (isStandalone) {
      setShowPrompt(false);
      return;
    }

    // Handle Android install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (isAndroid) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, we show it after a short delay if not standalone
    if (isIos && !isStandalone) {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  if (!showPrompt || platform === 'other') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-4 right-4 z-[100] md:hidden"
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 relative overflow-hidden">
          <button 
            onClick={() => setShowPrompt(false)}
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-100">
              <Smartphone className="text-white w-6 h-6" />
            </div>
            
            <div className="flex-1 pr-6">
              <h3 className="font-bold text-slate-900 text-lg mb-1">Cài đặt SalesPro</h3>
              
              {platform === 'android' ? (
                <>
                  <p className="text-slate-600 text-sm mb-4">Cài đặt ứng dụng để truy cập nhanh hơn và nhận thông báo.</p>
                  <button
                    onClick={handleInstallClick}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    Cài đặt ngay
                  </button>
                </>
              ) : (
                <>
                  <p className="text-slate-600 text-sm mb-3">Thêm SalesPro vào màn hình chính của bạn:</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm text-slate-700 bg-slate-50 p-2 rounded-lg">
                      <div className="bg-white p-1 rounded shadow-sm">
                        <Share className="w-4 h-4 text-blue-500" />
                      </div>
                      <span>Bấm vào nút <strong>Chia sẻ</strong> ở dưới</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-700 bg-slate-50 p-2 rounded-lg">
                      <div className="bg-white p-1 rounded shadow-sm">
                        <PlusSquare className="w-4 h-4 text-slate-700" />
                      </div>
                      <span>Chọn <strong>Thêm vào MH chính</strong></span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
