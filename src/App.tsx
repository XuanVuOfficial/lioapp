import React, { useState, useEffect } from 'react';
import { UserProfile, Department, Lead, UserRole } from './types';
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

  const effectiveUser = React.useMemo(() => {
    if (!user) return null;
    
    // Determine if user is a manager of any department
    const managedDepts = departments.filter(d => d.managerEmail === user.email);
    const isManager = managedDepts.length > 0;
    
    const effectiveRole = user.email === ADMIN_EMAIL ? 'admin' : (isManager ? 'tp' : user.role);
    
    // If they are a manager but don't have a departmentId set to one of their managed depts, 
    // we should prioritize their managed depts for visibility
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

    const allowedDeptIds = effectiveUser.role === 'tp' && effectiveUser.departmentId
      ? getSubDepartmentIds(effectiveUser.departmentId, departments)
      : (effectiveUser.departmentId ? [effectiveUser.departmentId] : undefined);

    const unsubLeads = subscribeToLeads(effectiveUser.role, effectiveUser.email, allowedDeptIds, setLeads);

    let unsubStaff: () => void = () => {};
    if (effectiveUser.role === 'admin' || effectiveUser.role === 'tp') {
      unsubStaff = subscribeToAllUsers(setStaff);
    }

    return () => {
      unsubLeads();
      unsubStaff();
    };
  }, [effectiveUser, departments]);

  const filteredStaff = React.useMemo(() => {
    if (!effectiveUser) return [];
    if (effectiveUser.role === 'admin') return staff;
    if (effectiveUser.role === 'tp' && effectiveUser.departmentId) {
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
      >
        {renderContent()}
      </Layout>
      <PWAInstallPrompt />
    </ErrorBoundary>
  );
}
