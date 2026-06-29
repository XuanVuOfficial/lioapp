import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Briefcase, LogIn, Mail, Lock, AlertCircle, Save } from 'lucide-react';
import { verifyCredentials, createUserProfile, updateUserProfile } from '../services/userService';

interface Props {
  onLogin: (user: any) => void;
}

export const Auth: React.FC<Props> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tempProfile, setTempProfile] = useState<any>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const loginEmail = email === 'admin' ? 'Tongsan@gmail.com' : email;
      
      let profile = await verifyCredentials(loginEmail, password);
      
      // Bootstrap TGĐ if it doesn't exist
      if (!profile && loginEmail === 'Tongsan@gmail.com' && password === '342343234232') {
        profile = {
          uid: 'tgd_root',
          email: 'Tongsan@gmail.com',
          displayName: 'Tổng giám đốc',
          role: 'tgd',
          password: '342343234232'
        };
        await createUserProfile(profile);
      }

      if (profile) {
        // Force TGD role for TGD email
        if (profile.email === 'Tongsan@gmail.com') {
          profile.role = 'tgd';
        }

        if (profile.mustChangePassword) {
          setTempProfile(profile);
          setRequirePasswordChange(true);
        } else {
          localStorage.setItem('salespro_uid', profile.uid);
          onLogin(profile);
        }
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (newPassword.length < 5) {
      setError('Mật khẩu phải có ít nhất 5 ký tự.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await updateUserProfile(tempProfile.uid, {
        password: newPassword,
        mustChangePassword: false
      });
      const updatedProfile = { ...tempProfile, password: newPassword, mustChangePassword: false };
      localStorage.setItem('salespro_uid', updatedProfile.uid);
      onLogin(updatedProfile);
    } catch (err: any) {
      console.error('Change password error:', err);
      setError('Đã xảy ra lỗi khi đổi mật khẩu.');
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
          <img src="https://app.xuanvu.click/khachhang/icon.jpg" alt="HKTT Icon" className="w-16 h-16 rounded-2xl mx-auto mb-6 object-cover shadow-lg shadow-emerald-100" />
          <h1 className="text-3xl font-bold text-slate-900 mb-2">HKTT</h1>
          <p className="text-slate-600">
            {requirePasswordChange ? 'Đổi mật khẩu bảo mật' : 'Đăng nhập để quản lý quy trình bán hàng.'}
          </p>
        </div>

        {requirePasswordChange ? (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="mb-4 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-100">
              Đây là lần đăng nhập đầu tiên của bạn với mật khẩu được cấp hoặc mật khẩu của bạn vừa được làm mới. Vui lòng đổi mật khẩu mới để tiếp tục.
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu mới</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="Nhập mật khẩu mới"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Xác nhận mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="Nhập lại mật khẩu"
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
                <Save className="w-5 h-5" />
              )}
              Lưu và đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setRequirePasswordChange(false);
                setTempProfile(null);
                setPassword('');
                setError(null);
              }}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
            >
              Hủy
            </button>
          </form>
        ) : (
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
        )}
      </motion.div>
    </div>
  );
};
