import React, { useState, useEffect } from 'react';
import { UserProfile, Department, Lead, UserRole } from './types';
import { getUserProfile, createUserProfile, subscribeToUsersByDepartment, getUserProfileByEmail, subscribeToAllUsers } from './services/userService';
import { subscribeToDepartments } from './services/departmentService';

import { Layout } from './components/Layout';
import { subscribeToMutations } from './api';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { DepartmentHierarchy } from './components/DepartmentHierarchy';
import { LeadList } from './components/LeadList';
import { StaffList } from './components/StaffList';
import { ProjectList } from './components/ProjectList';
import { Settings } from './components/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { AppUpdateScreen } from './components/AppUpdateScreen';
import { Loader2 } from 'lucide-react';
import { MandatoryZaloModal } from './components/MandatoryZaloModal';
import { SoftNotificationModal } from './components/SoftNotificationModal';
import { NotificationSettings } from './components/NotificationSettings';
import { AppSettings, subscribeToSettings } from './services/settingsService';
import { registerNotifications } from './services/notificationService';


const getSubDepartmentIds = (deptId: string, allDepts: Department[]): string[] => {
  const ids = [deptId];
  const children = allDepts.filter(d => d.parentId === deptId);
  children.forEach(child => {
    ids.push(...getSubDepartmentIds(child.id, allDepts));
  });
  return ids;
};

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const storedUid = localStorage.getItem('salespro_uid');
      if (storedUid) {
        const profile = await getUserProfile(storedUid);
        if (profile) {
          setUser(profile);
        } else {
          localStorage.removeItem('salespro_uid');
        }
      }
      setLoading(false);
    };

    checkSession();
  }, []);

  useEffect(() => {
    if (user && user.email) {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        registerNotifications(user.email);
      }
    }
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('salespro_uid');
    setUser(null);
    setActiveTab('dashboard');
  };

  useEffect(() => {
    if (!user) return;

    const unsubDepts = subscribeToDepartments(setDepartments);
    const unsubSettings = subscribeToSettings(setSettings);

    return () => {
      unsubDepts();
      unsubSettings();
    };
  }, [user]);

  const effectiveUser = React.useMemo(() => {
    if (!user) return null;
    
    // Determine if user is a manager of any department
    const managedDepts = departments.filter(d => d.managerEmail === user.email);
    const isManager = managedDepts.length > 0;
    
    let effectiveRole: UserRole = user.role;
    
    if (isManager) {
      // Find the highest level department they manage
      const highestDept = [...managedDepts].sort((a,b) => a.level - b.level)[0];
      if (highestDept.level === 0) effectiveRole = 'tgd';
      else if (highestDept.level === 1) effectiveRole = 'admin';
      else if (highestDept.level === 2) effectiveRole = 'gds';
      else if (highestDept.level === 3) effectiveRole = 'tp';
    } 

    const effectiveDeptId = user.departmentId || (isManager ? managedDepts[0].id : undefined);
    
    return {
      ...user,
      role: effectiveRole as UserRole,
      departmentId: effectiveDeptId,
      managedDeptIds: managedDepts.map(d => d.id)
    };
  }, [user, departments]);

  const userRole = effectiveUser?.role;
  const userEmail = effectiveUser?.email;
  const userDeptId = effectiveUser?.departmentId;

  const allowedDeptIdsStr = React.useMemo(() => {
    if (!effectiveUser) return '';
    const isHighLevel = ['tgd', 'admin'].includes(effectiveUser.role);
    if (isHighLevel) return 'ALL';
    const ids = effectiveUser.departmentId ? getSubDepartmentIds(effectiveUser.departmentId, departments) : [];
    return ids.sort().join(',');
  }, [effectiveUser?.role, effectiveUser?.departmentId, departments]);

  useEffect(() => {
    if (!userRole || !userEmail) return;

    const unsubMutations = subscribeToMutations((event) => {
      // Handle optimistic updates for each entity type
      if (event.entity === 'leads') {
        if (event.type === 'CREATE') {
          setLeads(prev => [event.data, ...prev]);
        } else if (event.type === 'UPDATE') {
          setLeads(prev => prev.map(l => l.id === event.data.id ? { ...l, ...event.data } : l));
        } else if (event.type === 'DELETE') {
          if (event.data.rollback) {
            // Revert state on error
            if (event.data.originalType === 'CREATE') {
              setLeads(prev => prev.filter(l => l.id !== event.data.originalData.id));
            } else if (event.data.originalType === 'UPDATE') {
              // Wait for next subscribe cycle
            } else if (event.data.originalType === 'DELETE') {
               setLeads(prev => [event.data.originalData, ...prev]);
            }
          } else {
            setLeads(prev => prev.filter(l => l.id !== event.data.id));
          }
        }
      } else if (event.entity === 'departments') {
         if (event.type === 'CREATE') {
           setDepartments(prev => [...prev.filter(d => d.id !== event.data.id), event.data]);
         } else if (event.type === 'UPDATE') {
           setDepartments(prev => prev.map(d => d.id === event.data.id ? { ...d, ...event.data } : d));
         } else if (event.type === 'DELETE') {
           setDepartments(prev => prev.filter(d => d.id !== event.data.id));
         }
      } else if (event.entity === 'users') {
        if (event.type === 'CREATE') {
          setStaff(prev => [event.data, ...prev.filter(s => s.uid !== event.data.uid)]);
        } else if (event.type === 'UPDATE') {
          setStaff(prev => prev.map(s => s.uid === event.data.uid ? { ...s, ...event.data } : s));
          setUser(prev => prev && prev.uid === event.data.uid ? { ...prev, ...event.data } : prev);
        } else if (event.type === 'DELETE') {
          if (event.data.rollback) {
             setStaff(prev => [event.data.originalData, ...prev]);
          } else {
             const deletedId = event.data.uid || event.data.id;
             setStaff(prev => prev.filter(s => s.uid !== deletedId));
          }
        }
      } else if (event.entity === 'settings') {
        if (event.type === 'UPDATE') {
          setSettings(event.data);
        }
      }
    });

    let unsubStaff: () => void = () => {};
    if (['tgd', 'admin', 'gds', 'tp'].includes(userRole)) {
      unsubStaff = subscribeToAllUsers(setStaff);
    }

    return () => {
      unsubStaff();
      unsubMutations();
    };
  }, [userRole, userEmail, userDeptId, allowedDeptIdsStr]);

  const filteredStaff = React.useMemo(() => {
    if (!effectiveUser) return [];
    if (['tgd', 'admin'].includes(effectiveUser.role)) return staff;
    if (['gds', 'tp'].includes(effectiveUser.role) && effectiveUser.departmentId) {
      const allowedDeptIds = getSubDepartmentIds(effectiveUser.departmentId, departments);
      return staff.filter(s => s.departmentId && allowedDeptIds.includes(s.departmentId));
    }
    return staff.filter(s => s.uid === effectiveUser.uid);
  }, [staff, effectiveUser, departments]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches || 
    (navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );

  const isMobileDevice = typeof window !== 'undefined' && (
    /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase()) ||
    window.innerWidth < 768
  );

  // Mandatory mobile PWA enforcement: Mobile browser MUST install app and cannot use web browser for login
  if (isMobileDevice && !isStandalone) {
    return <PWAInstallPrompt />;
  }

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  const renderContent = () => {
    if (!effectiveUser) return null;
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard leads={leads} departments={departments} user={effectiveUser} />;
      case 'departments':
        return <DepartmentHierarchy departments={departments} user={effectiveUser} allUsers={filteredStaff} />;
      case 'leads':
        return <LeadList leads={leads} departments={departments} user={effectiveUser} staff={filteredStaff} initialProjectId={selectedProjectId || undefined} />;
      case 'projects':
        return (
          <ProjectList 
            user={effectiveUser} 
            departments={departments}
            onProjectClick={(projectId) => {
              setSelectedProjectId(projectId);
              setActiveTab('leads');
            }} 
          />
        );
      case 'staff':
        return <StaffList users={filteredStaff} departments={departments} currentUser={effectiveUser} />;
      case 'notifications':
        return <NotificationSettings user={effectiveUser} />;
      case 'settings':
        return <Settings user={effectiveUser} />;
      default:
        return <Dashboard leads={leads} departments={departments} user={effectiveUser} />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout 
        user={effectiveUser} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        settings={settings}
        departments={departments}
      >
        {renderContent()}
      </Layout>
      {effectiveUser && (
        <>
          <MandatoryZaloModal 
            user={effectiveUser} 
            onUpdateSuccess={(updatedUser) => setUser(updatedUser)} 
          />
          <SoftNotificationModal user={effectiveUser} />
        </>
      )}
      <PWAInstallPrompt />
      <AppUpdateScreen />
      <div 
        className="fixed bottom-1 right-2 z-50 pointer-events-none select-none text-[10px] font-mono text-slate-400 opacity-40 hover:opacity-100 transition-opacity bg-slate-900/10 dark:bg-slate-900/30 px-1.5 py-0.5 rounded backdrop-blur-xs"
        title={`Phiên bản ứng dụng: v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.2'}`}
      >
        v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.2'}
      </div>
    </ErrorBoundary>
  );
}
