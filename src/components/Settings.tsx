import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Settings as SettingsIcon, LayoutDashboard, UserPlus, Briefcase, Users, UserCircle, Save, Check, Bell, MessageCircle, Lock, AlertCircle } from 'lucide-react';
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
    { id: 'notifications', label: 'Thông báo', icon: Bell },
    { id: 'settings', label: 'Cài đặt', icon: SettingsIcon },
  ];

  const roles: { id: UserRole; label: string }[] = [
    { id: 'admin', label: 'Admin' },
    { id: 'tp', label: 'Trưởng phòng' },
    { id: 'staff', label: 'Nhân viên' },
  ];

  const toggleTab = (role: string, tabId: string) => {
    if (!settings) return;
    
    // Convert flat format to role-based if needed before editing
    let currentTabVisibility = { ...settings.tabVisibility };
    if (typeof (currentTabVisibility as any).dashboard === 'boolean') {
      const activeTabs = allTabs.filter(t => (currentTabVisibility as any)[t.id] === true).map(t => t.id);
      currentTabVisibility = {
        tgd: [...activeTabs],
        admin: [...activeTabs],
        gds: [...activeTabs],
        tp: [...activeTabs],
        staff: [...activeTabs]
      };
    }

    const currentTabs = currentTabVisibility[role] || [];
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
        ...currentTabVisibility,
        [role]: newTabs
      }
    });
  };

  const [savingLockRoleId, setSavingLockRoleId] = useState<string | null>(null);

  const handleToggleLockPermission = async (roleId: string, currentVal: boolean) => {
    if (!settings) return;
    const nextVal = !currentVal;
    const newLockPerms = {
      ...(settings.lockPermissions || { admin: true, tp: false, gds: false }),
      [roleId]: nextVal
    };
    const updatedSettings: AppSettings = {
      ...settings,
      lockPermissions: newLockPerms
    };
    setSettings(updatedSettings);
    setSavingLockRoleId(roleId);

    try {
      await updateAppSettings(updatedSettings);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err: any) {
      alert('Lỗi lưu quyền khóa tài khoản: ' + (err?.message || err));
    } finally {
      setSavingLockRoleId(null);
    }
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
                  let isVisible = settings.tabVisibility[role.id]?.includes(tab.id);
                  if (isVisible === undefined && typeof (settings.tabVisibility as any).dashboard === 'boolean') {
                    isVisible = (settings.tabVisibility as any)[tab.id] === true;
                  }
                  
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="font-bold text-slate-900">Giới hạn số lượng nhân sự theo phòng ban</h3>
          <p className="text-sm text-slate-500 mt-1">
            Thiết lập số lượng tối đa nhân sự từng vào trò có thể được thêm vào 1 phòng ban. Để trống để không giới hạn.
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { id: 'tgd', label: 'Tổng giám đốc (TGD)' },
              { id: 'admin', label: 'Admin' },
              { id: 'gds', label: 'Giám đốc sàn (GĐS)' },
              { id: 'tp', label: 'Trưởng phòng (TP)' },
              { id: 'staff', label: 'Nhân viên (Staff)' }
            ].map(role => (
              <div key={role.id} className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  {role.label}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    placeholder="Không giới hạn"
                    className="w-full pl-4 pr-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 outline-none transition-all"
                    value={settings.roleLimits?.[role.id as keyof AppSettings['roleLimits']] || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : null;
                      setSettings({
                        ...settings,
                        roleLimits: {
                          ...(settings.roleLimits || {
                            tgd: null, admin: null, gds: null, tp: null, staff: null
                          }),
                          [role.id]: val
                        }
                      });
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Zalo Webhook Group ID Setting */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Cấu hình Zalo Webhook (Group ID)</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              ID nhóm Zalo nhận tin nhắn thông báo khi phân bổ hoặc tạo mới khách hàng tiềm năng.
            </p>
          </div>
        </div>
        <div className="p-6">
          <div className="max-w-md space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              DEFAULT_ZALO_GROUP_ID
            </label>
            <input
              type="text"
              placeholder="4814904778699793764"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 font-mono text-sm outline-none transition-all"
              value={settings.zaloGroupId ?? ''}
              onChange={(e) => {
                setSettings({
                  ...settings,
                  zaloGroupId: e.target.value
                });
              }}
            />
            <p className="text-xs text-slate-400">
              Mặc định: <code className="text-slate-600 font-mono font-semibold">4814904778699793764</code>
            </p>
          </div>
        </div>
      </motion.div>

      {/* Quyền Khóa / Mở khóa tài khoản */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Quyền Khóa / Mở khóa tài khoản nhân sự</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Bật/tắt quyền khóa tài khoản cho từng vai trò quản lý.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 leading-relaxed">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-0.5">Quy tắc phân quyền bảo mật:</p>
              <p>
                Dù được cấp quyền, người dùng <strong>tuyệt đối không được phép khóa người cùng cấp hoặc cấp trên</strong> mà <strong>chỉ được khóa các nhân sự cấp dưới trực thuộc phạm vi quản lý</strong> của họ. Tổng giám đốc luôn có toàn quyền quản trị cao nhất.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {[
              {
                id: 'admin',
                label: 'Admin (Quản trị viên)',
                desc: 'Được phép khóa/mở khóa tài khoản Giám đốc sàn, Trưởng phòng và Nhân viên. Không được khóa Admin khác hoặc TGĐ.',
                defaultVal: true
              },
              {
                id: 'tp',
                label: 'Trưởng phòng (TP)',
                desc: 'Được phép khóa/mở khóa tài khoản Nhân viên trực thuộc phòng ban của mình. Không được khóa Trưởng phòng khác hay cấp trên.',
                defaultVal: false
              },
              {
                id: 'gds',
                label: 'Giám đốc sàn (GĐS)',
                desc: 'Được phép khóa/mở khóa tài khoản Trưởng phòng và Nhân viên trực thuộc sàn do mình phụ trách.',
                defaultVal: false
              }
            ].map(item => {
              const isEnabled = settings.lockPermissions?.[item.id] ?? item.defaultVal;

              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    isEnabled
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800">{item.label}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${
                          savingLockRoleId === item.id
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : isEnabled
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {savingLockRoleId === item.id ? 'Đang lưu...' : isEnabled ? 'Được phép' : 'Đang tắt'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>

                  <button
                    type="button"
                    disabled={savingLockRoleId === item.id}
                    onClick={() => handleToggleLockPermission(item.id, isEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                    } ${savingLockRoleId === item.id ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
