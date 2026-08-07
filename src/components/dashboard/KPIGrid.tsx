import React, { useEffect, useState } from 'react';
import { Wallet, PieChart, Contact, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import './dashboard.css';

export const KPIGrid: React.FC = () => {
  const [stats, setStats] = useState({ totalRevenue: 0, pendingRent: 0, availableUnits: 0, totalTenants: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('payment-stats', {
          body: { action: 'dashboard' },
        });
        if (error) throw error;
        if (data) {
          setStats({
            totalRevenue: data.totalRevenue || 0,
            pendingRent: data.pendingRent || 0,
            availableUnits: data.availableUnits || 0,
            totalTenants: data.totalTenants || 0,
          });
        }
      } catch (err) {
        console.error('KPI fetch error:', err);
      }
    };
    fetchStats();
  }, []);

  const kpis = [
    { value: `₹${(stats.totalRevenue/1000).toFixed(1)}K`, subtitle: 'Total Revenue', icon: <Wallet size={24} strokeWidth={2} />, colorClass: 'pastel-purple', iconColor: '#6366f1' },
    { value: `₹${(stats.pendingRent/1000).toFixed(1)}K`, subtitle: 'Pending Rent', icon: <PieChart size={24} strokeWidth={2} />, colorClass: 'pastel-blue', iconColor: '#3b82f6' },
    { value: `${(stats.totalTenants/1000).toFixed(1)}K`, subtitle: 'Active Tenants', icon: <Contact size={24} strokeWidth={2} />, colorClass: 'pastel-pink', iconColor: '#ec4899' },
    { value: String(stats.availableUnits), subtitle: 'Available Units', icon: <CreditCard size={24} strokeWidth={2} />, colorClass: 'pastel-green', iconColor: '#10b981' },
  ];

  return (
    <div className="kpi-grid">
      {kpis.map((kpi, index) => (
        <div key={index} className={`kpi-card ${kpi.colorClass}`}>
          <div className="kpi-header-new">
            <div className="kpi-icon-wrap" style={{ color: kpi.iconColor }}>{kpi.icon}</div>
          </div>
          <div className="kpi-body-new">
            <p className="kpi-subtitle-new">{kpi.subtitle}</p>
            <h2 className="kpi-value-new">{kpi.value}</h2>
          </div>
        </div>
      ))}
    </div>
  );
};
