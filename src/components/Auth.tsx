import React from 'react';
import { motion } from 'motion/react';
import { Briefcase, LogIn } from 'lucide-react';
import { signIn } from '../firebase';

export const Auth: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center"
      >
        <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-100">
          <Briefcase className="text-white w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Quản lý Bán hàng</h1>
        <p className="text-slate-600 mb-8">Đăng nhập để quản lý quy trình bán hàng và các phòng ban của bạn.</p>
        
        <button
          onClick={signIn}
          className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-emerald-100 active:scale-95"
        >
          <LogIn className="w-5 h-5" />
          Đăng nhập bằng Google
        </button>
        
        <p className="mt-8 text-xs text-slate-400">
          Bằng cách đăng nhập, bạn đồng ý với Điều khoản Dịch vụ và Chính sách Bảo mật của chúng tôi.
        </p>
      </motion.div>
    </div>
  );
};
