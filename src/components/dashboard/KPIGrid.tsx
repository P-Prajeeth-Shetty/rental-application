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
    { value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`, subtitle: 'Total\nRevenue', icon: <Wallet size={24} strokeWidth={1.5} /> },
    { value: `₹${stats.pendingRent.toLocaleString('en-IN')}`, subtitle: 'Pending\nRent', icon: <PieChart size={24} strokeWidth={1.5} /> },
    { value: String(stats.availableUnits), subtitle: 'Available\nUnits', icon: <Contact size={24} strokeWidth={1.5} /> },
    { value: String(stats.totalTenants), subtitle: 'Active\nTenants', icon: <CreditCard size={24} strokeWidth={1.5} /> },
  ];

  return (
    <div className="kpi-grid">
      {kpis.map((kpi, index) => (
        <div key={index} className="surface-card kpi-card glass-card">
          <div className="kpi-header">
            <div className="kpi-icon">{kpi.icon}</div>
          </div>
          <div className="kpi-body">
            <h2 className="kpi-value">{kpi.value}</h2>
            <p className="kpi-subtitle text-muted">
              {kpi.subtitle.split('\n').map((line, i) => (
                <React.Fragment key={i}>{line}<br /></React.Fragment>
              ))}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
