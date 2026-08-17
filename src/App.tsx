import { useState, useEffect } from 'react';
import { NotificationProvider } from './contexts/NotificationContext';
import { Layout } from './components/layout/Layout';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { PropertiesView } from './views/PropertiesView';
import { TenantsView } from './views/TenantsView';
import { LeasesView } from './views/LeasesView';
import { MaintenanceBillingView } from './views/MaintenanceBillingView';
import { ReportsView } from './views/ReportsView';
import { UsersView } from './views/UsersView';
import { HelpCenterView } from './views/HelpCenterView';
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
        return <MaintenanceBillingView />;
      case 'reports':
        return <ReportsView />;
      case 'users':
        return userRole === 'admin' ? <UsersView /> : <DashboardView />;
      case 'help':
        return <HelpCenterView />;
      default:
        return <DashboardView />;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (isInitializing) {
    return (
      <div className="premium-loader-container">
        <style>{`
          .premium-loader-container {
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: linear-gradient(-45deg, #f8fafc, #f1f5f9, #e2e8f0, #cbd5e1);
            background-size: 400% 400%;
            animation: gradientBG 15s ease infinite;
            font-family: 'Inter', system-ui, sans-serif;
          }
          @keyframes gradientBG {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .glass-loader-card {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.8);
            border-radius: 24px;
            padding: 40px 60px;
            display: flex;
            flex-direction: column;
            align-items: center;
            box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.08), 0 0 20px rgba(255, 255, 255, 0.5) inset;
            animation: float 6s ease-in-out infinite;
          }
          @keyframes float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0px); }
          }
          .spinner-rings {
            position: relative;
            width: 80px;
            height: 80px;
            margin-bottom: 24px;
          }
          .ring {
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            border: 3px solid transparent;
          }
          .ring:nth-child(1) {
            border-top-color: #334155;
            animation: spinRing 2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
          }
          .ring:nth-child(2) {
            border-right-color: #64748b;
            animation: spinRing 2.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite reverse;
            inset: 8px;
            width: calc(100% - 16px);
            height: calc(100% - 16px);
          }
          .ring:nth-child(3) {
            border-bottom-color: #94a3b8;
            animation: spinRing 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
            inset: 16px;
            width: calc(100% - 32px);
            height: calc(100% - 32px);
          }
          @keyframes spinRing {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .loading-text {
            color: #1e293b;
            font-size: 1.125rem;
            font-weight: 600;
            letter-spacing: 0.05em;
            background: linear-gradient(to right, #0f172a, #334155, #475569);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: pulseText 2s ease-in-out infinite;
          }
          @keyframes pulseText {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
        <div className="glass-loader-card">
          <div className="spinner-rings">
            <div className="ring"></div>
            <div className="ring"></div>
            <div className="ring"></div>
          </div>
          <div className="loading-text">Preparing Application...</div>
        </div>
      </div>
    );
  }


  if (!session) {
    return <LoginView />;
  }

  return (
    <NotificationProvider>
      <Layout 
        activeView={activeView} 
        setActiveView={setActiveView}
        onLogout={handleLogout}
        userRole={userRole}
      >
        {renderView()}
      </Layout>
    </NotificationProvider>
  );
}

export default App;
