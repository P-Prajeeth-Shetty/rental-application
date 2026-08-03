import React, { useState, useEffect } from 'react';
import { Search, Bell, Settings, LogOut, Calendar, Phone, ChevronDown, User, Users } from 'lucide-react';
import { TimePill } from './TimePill';
import { ProfileSettingsModals } from './ProfileSettingsModals';
import { supabase } from '../../lib/supabase';
import './layout.css';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  setActiveView: (view: string) => void;
  onLogout?: () => void;
  userRole?: string | null;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  bio: string | null;
  avatar_url: string | null;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeView, setActiveView, onLogout, userRole }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'profile' | 'settings' | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');

  const fetchProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    setEmail(session.user.email || '');

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (data) {
      setProfile(data);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const defaultAvatar = "https://i.pravatar.cc/150?img=68";
  const avatarUrl = profile?.avatar_url 
    ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_url}`
    : defaultAvatar;

  const displayName = profile?.full_name || 'User';

  return (
    <div className="app-container">
      <div className="main-glass-container">
        
        {/* Top Header */}
        <header className="top-header">
          <div className="logo-container">
            <TimePill />
          </div>
          
          <nav className="top-nav">
            <button className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveView('dashboard')}>Dashboard</button>
            <button className={`nav-item ${activeView === 'properties' ? 'active' : ''}`} onClick={() => setActiveView('properties')}>Properties</button>
            <button className={`nav-item ${activeView === 'tenants' ? 'active' : ''}`} onClick={() => setActiveView('tenants')}>Tenants</button>
            <button className={`nav-item ${activeView === 'leases' ? 'active' : ''}`} onClick={() => setActiveView('leases')}>Payments</button>
            <button className={`nav-item ${activeView === 'maintenance' ? 'active' : ''}`} onClick={() => setActiveView('maintenance')}>Maintenance</button>
            <button className={`nav-item ${activeView === 'reports' ? 'active' : ''}`} onClick={() => setActiveView('reports')}>Reports</button>
            {userRole === 'admin' && (
              <button className={`nav-item ${activeView === 'users' ? 'active' : ''}`} onClick={() => setActiveView('users')}>
                <Users size={16} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                Users
              </button>
            )}
          </nav>
          
          <div className="header-actions">
            <button className="action-btn"><Phone size={20} /></button>
            <button className="action-btn"><Calendar size={20} /></button>
            <button className="action-btn"><Search size={20} /></button>
            <button className="action-btn">
              <Bell size={20} />
              <span className="notification-dot"></span>
            </button>
            <div className="user-profile-container" style={{ position: 'relative' }}>
              <div className="user-profile" onClick={() => setIsProfileOpen(!isProfileOpen)}>
                <img src={avatarUrl} alt="Profile" className="avatar" style={{ objectFit: 'cover' }} />
                <ChevronDown size={16} className="text-secondary" />
              </div>
              
              {isProfileOpen && (
                <div className="profile-dropdown">
                  <div className="dropdown-header">
                    <p className="dropdown-name">{displayName}</p>
                    <p className="dropdown-email" style={{textTransform: 'capitalize'}}>{userRole || 'User'} Account</p>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item" onClick={() => { setActiveModal('profile'); setIsProfileOpen(false); }}>
                    <User size={16} />
                    My Profile
                  </button>
                  <button className="dropdown-item" onClick={() => { setActiveModal('settings'); setIsProfileOpen(false); }}>
                    <Settings size={16} />
                    Account Settings
                  </button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item danger" onClick={onLogout}>
                    <LogOut size={16} />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="dashboard-content">
          {children}
        </main>
        
        
        <ProfileSettingsModals 
          activeModal={activeModal} 
          onClose={() => setActiveModal(null)}
          profile={profile}
          email={email}
          userRole={userRole || 'user'}
          onProfileUpdate={fetchProfile}
        />
      </div>
    </div>
  );
};
