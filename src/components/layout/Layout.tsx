import React, { useState, useEffect } from 'react';
import { Bell, Settings, LogOut, ChevronDown, User, LayoutDashboard, Building2, Users, CreditCard, Wrench, BarChart3, ShieldCheck, UserCircle, HelpCircle, Home } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
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
  
  const getAvatarUrl = (url?: string | null) => {
    if (!url) return defaultAvatar;
    if (url.startsWith('http')) return url;
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${url}`;
  };

  const avatarUrl = getAvatarUrl(profile?.avatar_url);

  const displayName = profile?.full_name || 'User';

  const dueReminders = reminders.filter(r => r.status === 'pending' && new Date(r.date) <= new Date());

  const getViewInfo = (view: string) => {
    switch (view) {
      case 'dashboard': return { title: 'Dashboard', subtitle: 'Use cases to plan, prioritize, and complete your tasks' };
      case 'properties': return { title: 'Properties', subtitle: 'Manage your real estate portfolio' };
      case 'tenants': return { title: 'Tenants & Rent', subtitle: 'Manage tenant information and details' };
      case 'leases': return { title: 'Payments', subtitle: 'Track rent payments and invoices' };
      case 'maintenance': return { title: 'Maintenance Billing', subtitle: 'Generate and track maintenance invoices for your properties' };
      case 'reports': return { title: 'Financial Reports', subtitle: 'Financial and operational analytics' };
      case 'users': return { title: 'Users Management', subtitle: 'Manage system administrators and staff' };
      case 'help': return { title: 'Help Center', subtitle: 'Support, documentation and resources' };
      default: return { title: 'RentBook', subtitle: 'Property Management System' };
    }
  };

  const currentViewInfo = getViewInfo(activeView);

  return (
    <div className="app-container">
      <div className="app-layout">
        
        {/* Sidebar */}
        <aside className="sidebar">
          {/* Logo Section */}
          <div className="logo-section">
            <div className="logo-icon" style={{ background: 'var(--primary-accent)', borderRadius: '10px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Home size={18} color="white" strokeWidth={2.5} />
            </div>
            <span className="logo-text" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>
              rent<span style={{ color: 'var(--primary-accent)' }}>book</span>
            </span>
          </div>

          <div className="sidebar-menu">
            <div>
              <p className="menu-label">MENU</p>
              <nav className="nav-vertical">
                <button className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveView('dashboard')}>
                  <LayoutDashboard size={18} /> Dashboard
                  {activeNotifications > 0 && <span className="notification-badge">{activeNotifications}</span>}
                </button>
                <button className={`nav-item ${activeView === 'properties' ? 'active' : ''}`} onClick={() => setActiveView('properties')}><Building2 size={18} /> Properties</button>
                <button className={`nav-item ${activeView === 'tenants' ? 'active' : ''}`} onClick={() => setActiveView('tenants')}><Users size={18} /> Tenants</button>
                <button className={`nav-item ${activeView === 'leases' ? 'active' : ''}`} onClick={() => setActiveView('leases')}><CreditCard size={18} /> Payments</button>
                <button className={`nav-item ${activeView === 'maintenance' ? 'active' : ''}`} onClick={() => setActiveView('maintenance')}><Wrench size={18} /> Maintenance</button>
                <button className={`nav-item ${activeView === 'reports' ? 'active' : ''}`} onClick={() => setActiveView('reports')}><BarChart3 size={18} /> Reports</button>
                {userRole === 'admin' && (
                  <button className={`nav-item ${activeView === 'users' ? 'active' : ''}`} onClick={() => setActiveView('users')}>
                    <ShieldCheck size={18} /> Users
                  </button>
                )}
              </nav>
            </div>
            
            <div style={{ marginTop: '24px' }}>
              <p className="menu-label">GENERAL</p>
              <nav className="nav-vertical">
                <button className="nav-item" onClick={() => setActiveModal('profile')}>
                   <UserCircle size={18} /> Profile
                </button>
                <button className="nav-item" onClick={() => setActiveModal('settings')}>
                   <Settings size={18} /> Settings
                </button>
                <button className={`nav-item ${activeView === 'help' ? 'active' : ''}`} onClick={() => setActiveView('help')}>
                   <HelpCircle size={18} /> Help Center
                </button>
                <button className="nav-item" onClick={onLogout} style={{ color: 'var(--danger)' }}>
                   <LogOut size={18} /> Log Out
                </button>
              </nav>
            </div>
          </div>

        </aside>

        {/* Main Content Wrapper (Controls all padding and layout alignment) */}
        <main className="main-content">
          
          {/* Top Header Row */}
          <header className="header-section">
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>{currentViewInfo.title}</h1>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>{currentViewInfo.subtitle}</p>
            </div>
            <div className="header-actions">
              <div style={{ position: 'relative' }}>
                <button className="action-btn" onClick={() => { setIsNotificationsOpen(!isNotificationsOpen); setIsProfileOpen(false); }}>
                  <Bell size={18} />
                  {activeNotifications > 0 && <span className="notification-dot"></span>}
                </button>
                
                {isNotificationsOpen && (
                  <div className="profile-dropdown" style={{ right: '0px', width: '320px', padding: '16px', zIndex: 100 }}>
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
                              style={{ background: 'var(--primary-accent)', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
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
                    <img 
                      src={avatarUrl} 
                      alt="Profile" 
                      className="avatar" 
                      onError={(e) => { e.currentTarget.src = defaultAvatar; }}
                    />
                    <div className="user-info">
                      <span className="user-name">{displayName}</span>
                      <span className="user-email" style={{textTransform: 'capitalize'}}>{userRole || 'User'}</span>
                    </div>
                    <ChevronDown size={14} className="text-secondary" style={{ marginLeft: '4px' }} />
                  </div>
                
                {isProfileOpen && (
                  <div className="profile-dropdown">
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

          {/* Children sections (KPI Cards, Toolbar, Table) will be injected here as siblings of header */}
          {children}

        </main>
      </div>
      
      <ProfileSettingsModals 
        activeModal={activeModal} 
        onClose={() => setActiveModal(null)}
        profile={profile}
        email={email}
        userRole={userRole || 'user'}
        onProfileUpdate={fetchProfile}
      />
    </div>
  );
};
