import React, { useState, useEffect } from 'react';
import { Bell, Settings, LogOut, ChevronDown, User, Users } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
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
  const { activeNotifications, reminders, updateReminder } = useNotifications();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'profile' | 'settings' | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

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

  const dueReminders = reminders.filter(r => r.status === 'pending' && new Date(r.date) <= new Date());

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
            
            <div style={{ position: 'relative' }}>
              <button className="action-btn" onClick={() => { setIsNotificationsOpen(!isNotificationsOpen); setIsProfileOpen(false); }}>
                <Bell size={20} />
                {activeNotifications > 0 && <span className="notification-dot" style={{ position: 'absolute', top: '6px', right: '6px', width: '8px', height: '8px', background: 'red', borderRadius: '50%' }}></span>}
              </button>
              
              {isNotificationsOpen && (
                <div className="profile-dropdown" style={{ right: '-60px', width: '320px', padding: '16px', zIndex: 100 }}>
                  <div className="dropdown-header" style={{ padding: '0 0 12px 0' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Notifications</h4>
                    {activeNotifications > 0 && <span style={{ fontSize: '0.8rem', color: 'red', fontWeight: 600 }}>{activeNotifications} Due</span>}
                  </div>
                  <div className="dropdown-divider" style={{ margin: '0 0 12px 0' }}></div>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {dueReminders.length === 0 ? (
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0', margin: 0 }}>No due reminders.</p>
                    ) : (
                      dueReminders.map(r => (
                        <div key={r.id} style={{ background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)' }}>
                          <h5 style={{ margin: '0 0 4px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{r.title}</h5>
                          <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(r.date).toLocaleString()}</p>
                          <button 
                            onClick={() => updateReminder(r.id, { status: 'completed' })}
                            style={{ background: '#dea389', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Mark Completed
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="user-profile-container" style={{ position: 'relative' }}>
              <div className="user-profile" onClick={() => { setIsProfileOpen(!isProfileOpen); setIsNotificationsOpen(false); }}>
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
