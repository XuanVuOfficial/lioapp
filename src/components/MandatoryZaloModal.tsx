import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Phone, Check, User, Search, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';
import { updateUserProfile } from '../services/userService';

interface Props {
  user: UserProfile;
  onUpdateSuccess: (updatedUser: UserProfile) => void;
}

export const MandatoryZaloModal: React.FC<Props> = ({ user, onUpdateSuccess }) => {
  const [phone, setPhone] = useState(user.phone || '');
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [zaloPreview, setZaloPreview] = useState<{
    useridzalo: string;
    zalo_name: string;
    avatar: string;
  } | null>(null);

  // If user already has phone and useridzalo, do not show modal
  if (user.phone && user.useridzalo) {
    return null;
  }

  const handleCheckZalo = async () => {
    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length < 9) {
      alert('Vui lòng nhập Số điện thoại hợp lệ.');
      return;
    }

    setIsChecking(true);
    try {
      const res = await fetch(`https://n8n.thienlong.pro.vn/webhook/zalo-user?phone=${encodeURIComponent(cleanPhone)}`);
      if (!res.ok) {
        alert('Vui lòng mở tìm kiếm SĐT trên Zalo, hoặc kiểm tra lại SĐT nha');
        setIsChecking(false);
        return;
      }
      const data = await res.json();
      if (data && (data.useridzalo || data.zalo_name)) {
        setZaloPreview({
          useridzalo: String(data.useridzalo || ''),
          zalo_name: String(data.zalo_name || user.displayName),
          avatar: String(data.avatar || user.avatarUrl || '')
        });
      } else {
        alert('Vui lòng mở tìm kiếm SĐT trên Zalo, hoặc kiểm tra lại SĐT nha');
      }
    } catch (err) {
      console.error('Error checking Zalo phone:', err);
      alert('Vui lòng mở tìm kiếm SĐT trên Zalo, hoặc kiểm tra lại SĐT nha');
    } finally {
      setIsChecking(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!zaloPreview) return;
    setIsSaving(true);
    try {
      const updates = {
        phone: phone.trim(),
        useridzalo: zaloPreview.useridzalo
      };
      await updateUserProfile(user.uid, updates);
      onUpdateSuccess({
        ...user,
        ...updates
      });
    } catch (err: any) {
      alert('Có lỗi xảy ra khi cập nhật thông tin Zalo: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center relative"
      >
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100">
          <ShieldCheck className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-bold text-slate-900 mb-1">Cập nhật Số điện thoại Zalo</h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          Vui lòng bổ sung và xác thực Số điện thoại Zalo chính chủ để hoàn tất tài khoản và nhận thông báo công việc.
        </p>

        {!zaloPreview ? (
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Số điện thoại Zalo *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Nhập số điện thoại Zalo (vd: 0912345678)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleCheckZalo}
              disabled={isChecking || !phone.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isChecking ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Kiểm tra tài khoản Zalo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-20 h-20 rounded-full mx-auto overflow-hidden border-4 border-blue-100 shadow-md bg-slate-100 flex items-center justify-center">
              {zaloPreview.avatar ? (
                <img src={zaloPreview.avatar} alt="Zalo Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-10 h-10 text-slate-400" />
              )}
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-xs mb-2">
                <Check className="w-3.5 h-3.5" /> Đã tìm thấy Zalo
              </div>
              <h4 className="text-lg font-bold text-slate-900">{zaloPreview.zalo_name}</h4>
              <p className="text-xs text-slate-500 font-mono">ID Zalo: {zaloPreview.useridzalo}</p>
              <p className="text-xs text-slate-600 font-semibold mt-1">SĐT: {phone}</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setZaloPreview(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50"
              >
                Đổi SĐT
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={isSaving}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Xác nhận & Hoàn tất
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
