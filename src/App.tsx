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
import { ErrorBoundary } from './components/ErrorBoundary';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { Loader2 } from 'lucide-react';

const ADMIN_EMAIL = 'admin@salespro.com';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [staff, setStaff] = useState<UserProfile[]>([]);

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

  const handleLogout = () => {
    localStorage.removeItem('salespro_uid');
    setUser(null);
  };

  useEffect(() => {
    if (!user) return;

    const unsubDepts = subscribeToDepartments(setDepartments);
    const unsubLeads = subscribeToLeads(user.role, user.email, user.departmentId, setLeads);

    let unsubStaff: () => void = () => {};
    if (user.role === 'manager' && user.departmentId) {
      unsubStaff = subscribeToUsersByDepartment(user.departmentId, setStaff);
    } else if (user.role === 'admin') {
      unsubStaff = subscribeToAllUsers(setStaff);
    }

    return () => {
      unsubDepts();
      unsubLeads();
      unsubStaff();
    };
  }, [user]);

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
        return <DepartmentHierarchy departments={departments} user={user} allUsers={staff} />;
      case 'leads':
        return <LeadList leads={leads} departments={departments} user={user} staff={staff} />;
      case 'staff':
        return <StaffList users={staff} departments={departments} currentUser={user} />;
      default:
        return <Dashboard leads={leads} departments={departments} user={user} />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout user={user} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout}>
        {renderContent()}
      </Layout>
      <PWAInstallPrompt />
    </ErrorBoundary>
  );
}
