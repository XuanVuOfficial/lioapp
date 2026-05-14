import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, User, LayoutDashboard, Users, UserPlus, Briefcase, Menu, X, UserCircle, Settings as SettingsIcon, Edit2, Upload, Lock, Save, Copy } from 'lucide-react';
import { UserProfile, Department } from '../types';
import { AppSettings } from '../services/settingsService';
import { updateUserProfile } from '../services/userService';

import { compressImage } from '../utils/imageUtils';

interface LayoutProps {
  user: UserProfile | null;
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  settings: AppSettings | null;
  departments: Department[];
}

export const Layout: React.FC<LayoutProps> = ({ user, children, activeTab, setActiveTab, onLogout, settings, departments }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = React.useState(false);
  const [editingProfile, setEditingProfile] = React.useState<{ password?: string; avatarUrl?: string }>({});
  const [isSaving, setIsSaving] = React.useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'leads', label: 'Khách hàng', icon: UserPlus },
    { id: 'projects', label: 'Dự án', icon: Briefcase },
    { id: 'departments', label: 'Phòng ban', icon: Users },
    { id: 'staff', label: 'Nhân viên', icon: UserCircle },
    { id: 'settings', label: 'Cài đặt', icon: SettingsIcon },
  ];

  const filteredNavItems = React.useMemo(() => {
    if (!user || !settings) return [];
    
    // 1. Try role-based mapping
    let allowedTabs = settings.tabVisibility[user.role];
    
    // 2. Handle flat boolean map (legacy/manual SQL)
    if (!allowedTabs) {
      const isFlat = navItems.some(item => (settings.tabVisibility as any)[item.id] === true);
      if (isFlat) {
        return navItems.filter(item => (settings.tabVisibility as any)[item.id] === true);
      }
      allowedTabs = [];
    }

    // 3. Fallback for admin/tgd if nothing configured
    if (allowedTabs.length === 0 && ['tgd', 'admin'].includes(user.role)) {
      return navItems;
    }
    
    return navItems.filter(item => allowedTabs.includes(item.id));
  }, [user, settings]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsSaving(true);
        const compressedFile = await compressImage(file, 2000);
        const formData = new FormData();
        formData.append("image", compressedFile);
        
        const res = await fetch("https://app.xuanvu.click/hktt/upload_avatar.php", {
            method: "POST",
            body: formData
        });
        
        const result = await res.json();
        
        if (result.success && result.data && result.data.avatar_1080) {
          const avatarUrl = `https://app.xuanvu.click${result.data.avatar_1080}`;
          setEditingProfile(prev => ({ ...prev, avatarUrl }));
        } else {
          alert('Upload ảnh thất bại: ' + (result.message || 'Lỗi không xác định'));
        }
      } catch (error) {
        console.error('Lỗi upload avatar:', error);
        alert('Có lỗi xảy ra khi upload ảnh');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSaving(true);
    try {
      const updates: any = {};
      if (editingProfile.password) {
        if (editingProfile.password.length < 5) {
          alert('Mật khẩu phải có ít nhất 5 ký tự.');
          setIsSaving(false);
          return;
        }
        updates.password = editingProfile.password;
        updates.mustChangePassword = false;
      }
      if (editingProfile.avatarUrl) {
        updates.avatarUrl = editingProfile.avatarUrl;
        user.avatarUrl = editingProfile.avatarUrl; // Optimistic update
      }

      if (Object.keys(updates).length > 0) {
        await updateUserProfile(user.uid, updates);
        alert('Cập nhật thông tin thành công!');
        setIsEditProfileOpen(false);
        setEditingProfile({});
      } else {
        setIsEditProfileOpen(false);
      }
    } catch (error: any) {
      alert('Lỗi khi cập nhật: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleDisplay = (role?: string) => {
    switch (role) {
      case 'tgd': return 'Tổng giám đốc';
      case 'admin': return 'Admin';
      case 'gds': return 'Giám đốc sàn';
      case 'tp': return 'Trưởng phòng / Quản lý';
      default: return 'Nhân viên';
    }
  };

  const getDepartmentPath = (deptId?: string): string => {
    if (!deptId) return 'Chưa phân bổ phòng ban';
    const path: string[] = [];
    let currentDept = departments.find(d => d.id === deptId);
    while (currentDept) {
      path.unshift(currentDept.name);
      currentDept = departments.find(d => d.id === currentDept?.parentId);
    }
    return path.join(' > ');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <img src="https://app.xuanvu.click/khachhang/icon.jpg" alt="HKTT Icon" className="w-8 h-8 rounded-lg object-cover" />
          <h1 className="text-lg font-bold text-slate-900">HKTT</h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar / Mobile Overlay Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 p-4 flex flex-col transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="hidden md:flex items-center gap-2 mb-8 px-2">
            <img src="https://app.xuanvu.click/khachhang/icon.jpg" alt="HKTT Icon" className="w-8 h-8 rounded-lg object-cover" />
            <h1 className="text-xl font-bold text-slate-900">HKTT</h1>
          </div>

          <nav className="flex-1 space-y-1">
            {filteredNavItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === item.id ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{user?.displayName}</p>
                <p className="text-xs text-slate-500 truncate mb-1">{user?.email}</p>
                <p className="text-xs text-emerald-600 font-medium truncate">
                  {getRoleDisplay(user?.role)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 whitespace-normal break-words leading-tight">
                  {getDepartmentPath(user?.departmentId)}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => {
                setEditingProfile({ avatarUrl: user?.avatarUrl, password: user?.password });
                setIsEditProfileOpen(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors mb-1"
            >
              <Edit2 className="w-4 h-4" />
              Sửa thông tin
            </button>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors mb-2"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </button>
            <div className="px-3 py-1">
              <p className="text-[10px] text-slate-400 font-mono">
                v1.2.2
              </p>
            </div>
          </div>
        </aside>

        {/* Backdrop for mobile sidebar */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="max-w-7xl mx-auto"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 flex items-center justify-around z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        {filteredNavItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all relative ${
              activeTab === item.id ? 'text-emerald-600' : 'text-slate-400'
            }`}
          >
            <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'scale-110' : ''} transition-transform`} />
            <span className="text-[10px] font-medium">{item.label}</span>
            {activeTab === item.id && (
              <motion.div 
                layoutId="activeTabIndicator"
                className="absolute -bottom-1 w-1 h-1 bg-emerald-600 rounded-full"
              />
            )}
          </button>
        ))}
      </nav>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditProfileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditProfileOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-white rounded-2xl shadow-xl z-[70] overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-900">Sửa thông tin cá nhân</h3>
                <button
                  onClick={() => setIsEditProfileOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto">
                <form id="editProfileForm" onSubmit={handleSaveProfile} className="space-y-6">
                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                        {editingProfile.avatarUrl ? (
                          <img src={editingProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User className="w-10 h-10 text-slate-300" />
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center justify-center cursor-pointer shadow-sm transition-all border-2 border-white">
                        <Upload className="w-4 h-4" />
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
                    <div className="relative group/copy">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={editingProfile.password || ''}
                        onChange={(e) => setEditingProfile({ ...editingProfile, password: e.target.value })}
                        className="w-full pl-10 pr-12 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-mono"
                        placeholder="Mật khẩu của bạn"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (editingProfile.password) {
                            navigator.clipboard.writeText(editingProfile.password);
                            alert('Đã sao chép mật khẩu!');
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                        title="Sao chép mật khẩu"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Sẽ tự động yêu cầu đổi mật khẩu khi đăng nhập lại nếu bạn là người quản lý cấp tài khoản.</p>
                  </div>
                </form>
              </div>

              <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  form="editProfileForm"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Lưu thay đổi
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
