import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
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
import { Loader2 } from 'lucide-react';

const ADMIN_EMAIL = 'xuan.vu.official@gmail.com';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [staff, setStaff] = useState<UserProfile[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let profile = await getUserProfile(firebaseUser.uid);
        
        if (!profile) {
          // Check if a profile with this email was pre-created
          const existingProfile = await getUserProfileByEmail(firebaseUser.email || '');
          
          if (existingProfile) {
            // Update the existing profile with the new UID
            profile = {
              ...existingProfile,
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || existingProfile.displayName
            };
            await createUserProfile(profile);
            // If the old profile was under a different ID (pre-created), we might want to delete it
            // but for simplicity, we're just creating/updating the one at doc(firebaseUser.uid)
          } else {
            profile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              role: firebaseUser.email === ADMIN_EMAIL ? 'admin' : 'staff',
            };
            await createUserProfile(profile);
          }
        }
        
        setUser(profile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
    return <Auth />;
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
      <Layout user={user} activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderContent()}
      </Layout>
    </ErrorBoundary>
  );
}
