import React, { useState, useEffect } from 'react';
import { Bell, RefreshCw, Send, ShieldCheck, AlertTriangle, CheckCircle, Smartphone } from 'lucide-react';
import { UserProfile } from '../types';
import { registerNotifications, sendPushNotification } from '../services/notificationService';

interface Props {
  user: UserProfile;
}

export const NotificationSettings: React.FC<Props> = ({ user }) => {
  const [permissionState, setPermissionState] = useState<string>('default');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [hasCachedToken, setHasCachedToken] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const checkStatus = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionState(Notification.permission);
    }
    const token = localStorage.getItem(`fcm_registered_${user.email}`);
    setHasCachedToken(!!token);
  };

  useEffect(() => {
    checkStatus();
  }, [user]);

  const handleReRegister = async () => {
    setIsRegistering(true);
    setTestResult(null);
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const perm = await Notification.requestPermission();
        setPermissionState(perm);
        if (perm === 'granted') {
          await registerNotifications(user.email, true);
          checkStatus();
          alert('Đã đăng ký lại thông báo thành công!');
        } else {
          alert('Vui lòng bật quyền thông báo trong cài đặt ứng dụng của bạn!');
        }
      }
    } catch (e: any) {
      alert('Lỗi đăng ký lại thông báo: ' + e.message);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSendTestNotification = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      await sendPushNotification(
        user.email,
        'Thông báo thử nghiệm 🚀',
        `Xin chào ${user.displayName || user.email}, hệ thống thông báo LioApp đã sẵn sàng hoạt động!`,
        { type: 'test', timestamp: Date.now() }
      );
      setTestResult('Đã gửi lệnh phát thông báo thử nghiệm! Kiểm tra thanh thông báo thiết bị của bạn.');
    } catch (e: any) {
      setTestResult('Lỗi khi gửi thông báo thử nghiệm: ' + e.message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Thiết lập Thông báo Push</h3>
          <p className="text-xs text-slate-500">Kiểm tra trạng thái cấp quyền và kiểm thử nhận thông báo trên thiết bị này</p>
        </div>
      </div>

      {/* Permission & FCM Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Permission Status */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quyền ứng dụng</p>
          <div className="flex items-center gap-2">
            {permissionState === 'granted' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
                <CheckCircle className="w-3.5 h-3.5" /> Cho phép (Granted)
              </span>
            )}
            {permissionState === 'default' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 font-bold text-xs border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5" /> Chưa cấp quyền (Default)
              </span>
            )}
            {permissionState === 'denied' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 font-bold text-xs border border-red-200">
                <AlertTriangle className="w-3.5 h-3.5" /> Đã bị chặn (Denied)
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {permissionState === 'granted' && 'ứng dụng đã sẵn sàng nhận thông báo push.'}
            {permissionState === 'default' && 'Chưa cấp quyền. Hãy bấm "Đăng ký lại thông báo" bên dưới.'}
            {permissionState === 'denied' && 'ứng dụng đang chặn thông báo. Vui lòng mở cài đặt ứng dụng để bỏ chặn.'}
          </p>
        </div>

        {/* Device Registration Status */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Trạng thái thiết bị</p>
          <div className="flex items-center gap-2">
            {hasCachedToken ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200">
                <Smartphone className="w-3.5 h-3.5" /> Đã đăng ký FCM Push
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-600 font-bold text-xs">
                Chưa đăng ký FCM Token
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Tài khoản: <strong className="text-slate-700">{user.email}</strong>
          </p>
        </div>
      </div>

      {testResult && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-900 font-medium flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{testResult}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <button
          onClick={handleReRegister}
          disabled={isRegistering}
          className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isRegistering ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Đăng ký lại thông báo
        </button>

        <button
          onClick={handleSendTestNotification}
          disabled={isTesting || permissionState !== 'granted'}
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isTesting ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Gửi thông báo thử nghiệm
        </button>
      </div>
    </div>
  );
};
