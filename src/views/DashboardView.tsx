import React from 'react';
import { KPIGrid } from '../components/dashboard/KPIGrid';
import { DashboardDonutChart } from '../components/dashboard/DashboardDonutChart';
import { DashboardLineChart } from '../components/dashboard/DashboardLineChart';
import { DashboardAreaChart } from '../components/dashboard/DashboardAreaChart';
import { RecentActivities } from '../components/dashboard/RecentActivities';
import { OverdueAlerts } from '../components/dashboard/OverdueAlerts';
import { CalendarWidget } from '../components/dashboard/CalendarWidget';
import { SideWidgets } from '../components/dashboard/SideWidgets';
import '../components/dashboard/dashboard.css';

interface DashboardProps {
  onNavigate?: (view: string) => void;
}

export const DashboardView: React.FC<DashboardProps> = ({ onNavigate }) => {
  return (
    <>
      <div className="dashboard-new-grid">
        <div className="dashboard-left-col">
          <KPIGrid />
          <DashboardDonutChart />
        </div>
        
        <div className="dashboard-right-col">
          <DashboardLineChart />
          <DashboardAreaChart />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', width: '100%' }}>
        <OverdueAlerts />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', width: '100%' }}>
        <RecentActivities />
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', width: '100%' }}>
        <SideWidgets onNavigate={onNavigate} />
        <CalendarWidget />
      </div>
    </>
  );
};
