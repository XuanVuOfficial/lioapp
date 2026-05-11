import React, { useState, useEffect } from 'react';
import { UserProfile, Department, Lead, UserRole } from './types';
import { getUserProfile, createUserProfile, subscribeToUsersByDepartment, getUserProfileByEmail, subscribeToAllUsers } from './services/userService';
import { subscribeToDepartments } from './services/departmentService';
import { subscribeToLeads } from './services/leadService';
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
import { Loader2 } from 'lucide-react';
import { AppSettings, subscribeToSettings } from './services/settingsService';

const TGD_EMAIL = 'Tongsan@gmail.com';

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
          // Force TGD role for TGD email
          if (profile.email === TGD_EMAIL) {
            profile.role = 'tgd';
          }
          setUser(profile);
        } else {
          localStorage.removeItem('salespro_uid');
        }
      }
      setLoading(false);
    };

    checkSession();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('salespro_uid');
    setUser(null);
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
    
    if (user.email === TGD_EMAIL) {
      effectiveRole = 'tgd';
    } else if (isManager) {
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

  useEffect(() => {
    if (!effectiveUser) return;

    const isHighLevel = ['tgd', 'admin'].includes(effectiveUser.role);
    
    const allowedDeptIds = isHighLevel 
      ? undefined // See all for high level
      : (effectiveUser.departmentId ? getSubDepartmentIds(effectiveUser.departmentId, departments) : undefined);

    const unsubLeads = subscribeToLeads(effectiveUser.role, effectiveUser.email, allowedDeptIds, setLeads);

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
              // Wait for next subscribe cycle or implement complex rollback
              // Polling will naturally fix updates, but for CREATE/DELETE we need manual fix
            } else if (event.data.originalType === 'DELETE') {
               setLeads(prev => [event.data.originalData, ...prev]);
            }
          } else {
            setLeads(prev => prev.filter(l => l.id !== event.data.id));
          }
        }
      } else if (event.entity === 'departments') {
         if (event.type === 'UPDATE') {
           setDepartments(prev => prev.map(d => d.id === event.data.id ? { ...d, ...event.data } : d));
         }
      } else if (event.entity === 'users') {
        if (event.type === 'UPDATE') {
          setStaff(prev => prev.map(s => s.uid === event.data.uid ? { ...s, ...event.data } : s));
        } else if (event.type === 'DELETE') {
          if (event.data.rollback) {
             setStaff(prev => [event.data.originalData, ...prev]);
          } else {
             setStaff(prev => prev.filter(s => s.uid !== event.data.id));
          }
        }
      } else if (event.entity === 'settings') {
        if (event.type === 'UPDATE') {
          setSettings(event.data);
        }
      }
    });

    let unsubStaff: () => void = () => {};
    if (['tgd', 'admin', 'gds', 'tp'].includes(effectiveUser.role)) {
      unsubStaff = subscribeToAllUsers(setStaff);
    }

    return () => {
      unsubLeads();
      unsubStaff();
      unsubMutations();
    };
  }, [effectiveUser, departments]);

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
            leads={leads}
            onProjectClick={(projectId) => {
              setSelectedProjectId(projectId);
              setActiveTab('leads');
            }} 
          />
        );
      case 'staff':
        return <StaffList users={filteredStaff} departments={departments} currentUser={effectiveUser} />;
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
      <PWAInstallPrompt />
    </ErrorBoundary>
  );
}
