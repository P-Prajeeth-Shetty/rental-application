import { useState, useEffect } from 'react';
import { Layout } from './components/layout/Layout';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { PropertiesView } from './views/PropertiesView';
import { TenantsView } from './views/TenantsView';
import { LeasesView } from './views/LeasesView';
import { MaintenanceView } from './views/MaintenanceView';
import { ReportsView } from './views/ReportsView';
import { UsersView } from './views/UsersView';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Safety timeout — if Supabase doesn't respond in 5s, stop initializing
    const timeout = setTimeout(() => {
      setIsInitializing(false);
    }, 5000);

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      setSession(session);
      if (session) fetchUserRole(session.user.id);
      else setIsInitializing(false);
    }).catch(() => {
      clearTimeout(timeout);
      setIsInitializing(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
        setIsInitializing(false);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching role:', error);
      }
      
      setUserRole(data?.role || 'user'); // Default to 'user' if not found
    } catch (err) {
      console.error('Unexpected error fetching role:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  const renderView = () => {
    switch(activeView) {
      case 'dashboard':
        return <DashboardView />;
      case 'properties':
        return <PropertiesView />;
      case 'tenants':
        return <TenantsView />;
      case 'leases':
        return <LeasesView />;
      case 'maintenance':
        return <MaintenanceView />;
      case 'reports':
        return <ReportsView />;
      case 'users':
        return userRole === 'admin' ? <UsersView /> : <DashboardView />;
      default:
        return <DashboardView />;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (isInitializing) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid rgba(255,255,255,0.2)', borderTop: '4px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '16px', fontSize: '0.95rem' }}>Loading application...</p>
      </div>
    );
  }


  if (!session) {
    return <LoginView />;
  }

  return (
    <Layout 
      activeView={activeView} 
      setActiveView={setActiveView}
      onLogout={handleLogout}
      userRole={userRole}
    >
      {renderView()}
    </Layout>
  );
}

export default App;
