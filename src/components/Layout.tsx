import React from 'react';
import { motion } from 'motion/react';
import { LogOut, User, LayoutDashboard, Users, UserPlus, Briefcase, Menu, X, UserCircle, Settings as SettingsIcon } from 'lucide-react';
import { UserProfile } from '../types';
import { AppSettings } from '../services/settingsService';

interface LayoutProps {
  user: UserProfile | null;
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  settings: AppSettings | null;
}

export const Layout: React.FC<LayoutProps> = ({ user, children, activeTab, setActiveTab, onLogout, settings }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

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
    const allowedTabs = settings.tabVisibility[user.role] || [];
    return navItems.filter(item => allowedTabs.includes(item.id));
  }, [user, settings]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <Briefcase className="text-white w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">SalesPro</h1>
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
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Briefcase className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">SalesPro</h1>
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
            <div className="flex items-center gap-3 px-3 py-2 mb-4">
              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{user?.displayName}</p>
                <p className="text-xs text-slate-500 truncate capitalize">
                  {user?.role === 'admin' ? 'Admin' : 
                   user?.role === 'tp' ? 'Trưởng phòng' : 'Nhân viên'}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors mb-2"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </button>
            <div className="px-3 py-1">
              <p className="text-[10px] text-slate-400 font-mono">
                v{(window as any).__APP_VERSION__ || '0.0.0'}
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
    </div>
  );
};
