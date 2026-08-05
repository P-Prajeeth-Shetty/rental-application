import React, { useEffect, useState } from 'react';
import { KPIGrid } from '../components/dashboard/KPIGrid';
import { OverdueAlerts } from '../components/dashboard/OverdueAlerts';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { RecentActivities } from '../components/dashboard/RecentActivities';
import { SideWidgets } from '../components/dashboard/SideWidgets';
import { CalendarWidget } from '../components/dashboard/CalendarWidget';
import { supabase } from '../lib/supabase';
import '../components/dashboard/dashboard.css';

interface DashboardProps {
  onNavigate?: (view: string) => void;
}

export const DashboardView: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const fetchName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        setUserName(profile?.full_name || user.email?.split('@')[0] || 'User');
      }
    };
    fetchName();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div className="dashboard-layout" style={{ height: 'auto', overflowY: 'visible', flex: 'none', paddingBottom: 'var(--spacing-lg)' }}>
        <div className="main-column">
          <h1 style={{ fontSize: '1.5rem', marginBottom: '-8px' }}>{greeting}, {userName}!</h1>
          <KPIGrid />
          <OverdueAlerts />
          <RecentActivities />
        </div>
        
        <div className="side-column">
          <SideWidgets onNavigate={onNavigate} />
          <CalendarWidget />
        </div>
      </div>
      
      <div style={{ padding: '0 var(--spacing-lg) var(--spacing-lg) var(--spacing-lg)', flexShrink: 0 }}>
        <RevenueChart />
      </div>
    </div>
  );
};
