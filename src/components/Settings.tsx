import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Settings as SettingsIcon, LayoutDashboard, UserPlus, Briefcase, Users, UserCircle, Save, Check } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { AppSettings, updateAppSettings, getAppSettings } from '../services/settingsService';

interface Props {
  user: UserProfile;
}

export const Settings: React.FC<Props> = ({ user }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const data = await getAppSettings();
      setSettings(data);
    };
    fetchSettings();
  }, []);

  const allTabs = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'leads', label: 'Khách hàng', icon: UserPlus },
    { id: 'projects', label: 'Dự án', icon: Briefcase },
    { id: 'departments', label: 'Phòng ban', icon: Users },
    { id: 'staff', label: 'Nhân viên', icon: UserCircle },
    { id: 'settings', label: 'Cài đặt', icon: SettingsIcon },
  ];

  const roles: { id: UserRole; label: string }[] = [
    { id: 'admin', label: 'Admin' },
    { id: 'tp', label: 'Trưởng phòng' },
    { id: 'staff', label: 'Nhân viên' },
  ];

  const toggleTab = (role: string, tabId: string) => {
    if (!settings) return;
    
    const currentTabs = settings.tabVisibility[role] || [];
    let newTabs: string[];
    
    if (currentTabs.includes(tabId)) {
      // Don't allow removing 'dashboard' or 'settings' for admin
      if (role === 'admin' && (tabId === 'dashboard' || tabId === 'settings')) return;
      newTabs = currentTabs.filter(id => id !== tabId);
    } else {
      newTabs = [...currentTabs, tabId];
    }

    setSettings({
      ...settings,
      tabVisibility: {
        ...settings.tabVisibility,
        [role]: newTabs
      }
    });
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await updateAppSettings(settings);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cài đặt hệ thống</h1>
          <p className="text-slate-500 mt-1">Thiết lập quyền xem các tab cho từng vai trò người dùng.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : showSuccess ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {showSuccess ? 'Đã lưu' : 'Lưu cài đặt'}
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {roles.map(role => (
          <motion.div
            key={role.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="font-bold text-slate-900">{role.label}</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {allTabs.map(tab => {
                  const isVisible = settings.tabVisibility[role.id]?.includes(tab.id);
                  const isRequired = role.id === 'admin' && (tab.id === 'dashboard' || tab.id === 'settings');
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => toggleTab(role.id, tab.id)}
                      disabled={isRequired}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all gap-2 ${
                        isVisible 
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' 
                          : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                      } ${isRequired ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <tab.icon className={`w-6 h-6 ${isVisible ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <span className="text-xs font-semibold">{tab.label}</span>
                      {isVisible && <div className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
