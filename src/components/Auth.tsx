import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Briefcase, LogIn, Mail, Lock, AlertCircle } from 'lucide-react';
import { verifyCredentials, createUserProfile } from '../services/userService';

interface Props {
  onLogin: (user: any) => void;
}

export const Auth: React.FC<Props> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const loginEmail = email === 'admin' ? 'admin@salespro.com' : email;
      
      let profile = await verifyCredentials(loginEmail, password);
      
      // Bootstrap admin if it doesn't exist
      if (!profile && email === 'admin' && password === 'admin12345') {
        profile = {
          uid: 'admin_root',
          email: 'admin@salespro.com',
          displayName: 'Admin',
          role: 'admin',
          password: 'admin12345'
        };
        await createUserProfile(profile);
      }

      if (profile) {
        localStorage.setItem('salespro_uid', profile.uid);
        onLogin(profile);
      } else {
        setError('Email hoặc mật khẩu không đúng. Vui lòng thử lại.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-100">
            <Briefcase className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">SalesPro CRM</h1>
          <p className="text-slate-600">Đăng nhập để quản lý quy trình bán hàng.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email hoặc Tên đăng nhập</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="admin hoặc email@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-emerald-100 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <LogIn className="w-5 h-5" />
            )}
            Đăng nhập
          </button>
        </form>

        <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-xs text-slate-500 font-medium mb-1">Tài khoản mặc định:</p>
          <p className="text-xs text-slate-400">Tên đăng nhập: <span className="text-slate-600 font-mono">admin</span></p>
          <p className="text-xs text-slate-400">Mật khẩu: <span className="text-slate-600 font-mono">admin12345</span></p>
        </div>
      </motion.div>
    </div>
  );
};
