import React, { useEffect, useState } from 'react';
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
    { value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`, subtitle: 'Total Revenue', colorClass: 'pastel-purple' },
    { value: `₹${stats.pendingRent.toLocaleString('en-IN')}`, subtitle: 'Pending Rent', colorClass: 'pastel-blue' },
    { value: String(stats.totalTenants), subtitle: 'Active Tenants', colorClass: 'pastel-pink' },
    { value: String(stats.availableUnits), subtitle: 'Available Units', colorClass: 'pastel-green' },
  ];

  return (
    <div className="kpi-grid">
      {kpis.map((kpi, index) => (
        <div key={index} className={`kpi-card ${kpi.colorClass}`}>
          <div className="kpi-body-new">
            <p className="kpi-subtitle-new">{kpi.subtitle}</p>
            <h2 className="kpi-value-new">{kpi.value}</h2>
          </div>
        </div>
      ))}
    </div>
  );
};

