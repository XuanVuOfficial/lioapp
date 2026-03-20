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

  if (platform === 'other') return null;

  // If already standalone, don't show anything
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
  if (isStandalone) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[9999] bg-slate-900 flex items-center justify-center p-6 text-center"
      >
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600"></div>
          
          <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Smartphone className="text-emerald-600 w-10 h-10" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Yêu cầu cài đặt</h2>
          <p className="text-slate-600 mb-8">
            Để sử dụng <strong>SalesPro CRM</strong> trên {platform === 'android' ? 'Android' : 'iOS'}, bạn cần cài đặt ứng dụng vào màn hình chính.
          </p>
          
          <div className="space-y-6 text-left">
            {platform === 'android' ? (
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="bg-emerald-600 p-2 rounded-lg shrink-0">
                    <Download className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Bước 1</p>
                    <p className="text-slate-600 text-xs">Bấm nút cài đặt bên dưới</p>
                  </div>
                </div>
                <button
                  onClick={handleInstallClick}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-100 active:scale-95"
                >
                  <Download className="w-5 h-5" />
                  Cài đặt ứng dụng
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="bg-blue-500 p-2 rounded-lg shrink-0">
                    <Share className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Bước 1</p>
                    <p className="text-slate-600 text-xs">Bấm vào biểu tượng <strong>Chia sẻ</strong> trên trình duyệt Safari</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="bg-slate-700 p-2 rounded-lg shrink-0">
                    <PlusSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Bước 2</p>
                    <p className="text-slate-600 text-xs">Kéo xuống và chọn <strong>Thêm vào MH chính</strong></p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              SalesPro CRM • Phiên bản di động
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
