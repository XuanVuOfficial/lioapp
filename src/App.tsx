import React, { useState, useEffect } from 'react';
import { UserProfile, Department, Lead } from './types';
import { getUserProfile, createUserProfile, subscribeToUsersByDepartment, getUserProfileByEmail, subscribeToAllUsers } from './services/userService';
import { subscribeToDepartments } from './services/departmentService';
import { subscribeToLeads } from './services/leadService';
import { Layout } from './components/Layout';
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

const ADMIN_EMAIL = 'admin@salespro.com';

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
          // Force admin role for admin email
          if (profile.email === ADMIN_EMAIL) {
            profile.role = 'admin';
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

  useEffect(() => {
    if (!user) return;

    const allowedDeptIds = user.role === 'tp' && user.departmentId
      ? getSubDepartmentIds(user.departmentId, departments)
      : (user.departmentId ? [user.departmentId] : undefined);

    const unsubLeads = subscribeToLeads(user.role, user.email, allowedDeptIds, setLeads);

    let unsubStaff: () => void = () => {};
    if (user.role === 'admin' || user.role === 'tp') {
      unsubStaff = subscribeToAllUsers(setStaff);
    }

    return () => {
      unsubLeads();
      unsubStaff();
    };
  }, [user, departments]);

  const filteredStaff = React.useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return staff;
    if (user.role === 'tp' && user.departmentId) {
      const allowedDeptIds = getSubDepartmentIds(user.departmentId, departments);
      return staff.filter(s => s.departmentId && allowedDeptIds.includes(s.departmentId));
    }
    return staff.filter(s => s.uid === user.uid);
  }, [staff, user, departments]);

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
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard leads={leads} departments={departments} user={user} />;
      case 'departments':
        return <DepartmentHierarchy departments={departments} user={user} allUsers={filteredStaff} />;
      case 'leads':
        return <LeadList leads={leads} departments={departments} user={user} staff={filteredStaff} initialProjectId={selectedProjectId || undefined} />;
      case 'projects':
        return (
          <ProjectList 
            user={user} 
            leads={leads}
            onProjectClick={(projectId) => {
              setSelectedProjectId(projectId);
              setActiveTab('leads');
            }} 
          />
        );
      case 'staff':
        return <StaffList users={filteredStaff} departments={departments} currentUser={user} />;
      case 'settings':
        return <Settings user={user} />;
      default:
        return <Dashboard leads={leads} departments={departments} user={user} />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout 
        user={user} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        settings={settings}
      >
        {renderContent()}
      </Layout>
      <PWAInstallPrompt />
    </ErrorBoundary>
  );
}
