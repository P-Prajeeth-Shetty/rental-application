import React, { useEffect, useState } from 'react';
import { KPIGrid } from '../components/dashboard/KPIGrid';
import { OverdueAlerts } from '../components/dashboard/OverdueAlerts';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { RecentActivities } from '../components/dashboard/RecentActivities';
import { SideWidgets } from '../components/dashboard/SideWidgets';
import { CalendarWidget } from '../components/dashboard/CalendarWidget';
import { supabase } from '../lib/supabase';
import '../components/dashboard/dashboard.css';

export const DashboardView: React.FC = () => {
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
    <div className="dashboard-layout">
      <div className="main-column">
        <h1 style={{ fontSize: '1.5rem', marginBottom: '-8px' }}>{greeting}, {userName}!</h1>
        <KPIGrid />
        <OverdueAlerts />
        <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
          <div style={{ flex: 2, minWidth: 0 }}>
            <RevenueChart />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <CalendarWidget />
          </div>
        </div>
        <RecentActivities />
      </div>
      
      <div className="side-column">
        <SideWidgets />
      </div>
    </div>
  );
};
