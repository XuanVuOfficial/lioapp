import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Share, PlusSquare, X, Smartphone } from 'lucide-react';

const SHOW_PWA_PROMPT: number = 1; // 1 bật, 0 tắt

export const PWAInstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(true);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'other'>('other');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (SHOW_PWA_PROMPT === 0) return;

    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(ua);
    const isIos = /iphone|ipad|ipod/.test(ua);

    if (isAndroid) setPlatform('android');
    else if (isIos) setPlatform('ios');
    else setPlatform('android'); // Default fallback for mobile testing

    // Check window.deferredPrompt global variable
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    const handlePwaAvailable = () => {
      if ((window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt);
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-install-available', handlePwaAvailable);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-install-available', handlePwaAvailable);
    };
  }, []);

  const handleInstallClick = async () => {
    const activePrompt = deferredPrompt || (window as any).deferredPrompt;
    if (activePrompt && typeof activePrompt.prompt === 'function') {
      try {
        activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          (window as any).deferredPrompt = null;
          setDeferredPrompt(null);
          setShowPrompt(false);
        }
      } catch (e) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  // Check if standalone PWA mode
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );

  const isMobileDevice = typeof window !== 'undefined' && (
    /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase()) ||
    window.innerWidth < 768
  );

  if (isStandalone || !showPrompt || (!isMobileDevice && !deferredPrompt)) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 text-center overflow-y-auto"
      >
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 sm:p-8 border border-slate-200 relative overflow-hidden my-auto">
          <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600"></div>

          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-inner">
            <Smartphone className="text-emerald-600 w-8 h-8 sm:w-10 sm:h-10" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Cài đặt ứng dụng 📱</h2>

          <div className="space-y-4 text-left">            {platform === 'android' || platform === 'other' ? (
            <div className="space-y-3">
              <button
                onClick={handleInstallClick}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3.5 px-5 rounded-2xl transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-100 text-sm active:scale-95"
              >
                <Download className="w-4.5 h-4.5" />
                Cài đặt ứng dụng ngay
              </button>

              {showGuide && (
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs space-y-1.5 animate-in fade-in duration-200">
                  <p className="font-bold text-amber-950">Hướng dẫn cài thủ công trên Chrome:</p>
                  <p>1. Bấm vào biểu tượng <strong>Menu (⋮)</strong> góc trên bên phải.</p>
                  <p>2. Chọn <strong>"Thêm vào màn hình chính"</strong> hoặc <strong>"Cài đặt ứng dụng"</strong>.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="bg-blue-500 p-2 rounded-lg shrink-0 text-white">
                  <Share className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-xs">Bước 1</p>
                  <p className="text-slate-600 text-[11px]">Bấm nút <strong>Chia sẻ (Share)</strong> ở thanh dưới Safari</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="bg-slate-700 p-2 rounded-lg shrink-0 text-white">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-xs">Bước 2</p>
                  <p className="text-slate-600 text-[11px]">Kéo xuống chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong></p>
                </div>
              </div>
            </div>
          )}

            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 text-xs text-center leading-relaxed">
              💡 Sau khi thêm xong, mở biểu tượng <strong>HKTT CRM</strong> trên màn hình chính để sử dụng.
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              SalesPro CRM • Phiên bản di động
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
