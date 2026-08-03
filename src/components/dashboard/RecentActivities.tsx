import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import './dashboard.css';

interface RecentPayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  status: string;
  tenant_name: string;
  property_name: string;
  unit_number: string;
}

export const RecentActivities: React.FC = () => {
  const [activities, setActivities] = useState<RecentPayment[]>([]);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('id, amount, payment_date, payment_method, status, tenant_assignments(unit_number, tenants(full_name), properties(name))')
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;

        const mapped = (data || []).map((p: any) => ({
          id: p.id,
          amount: p.amount,
          payment_date: p.payment_date,
          payment_method: p.payment_method,
          status: p.status,
          tenant_name: p.tenant_assignments?.tenants?.full_name || 'Unknown',
          property_name: p.tenant_assignments?.properties?.name || '',
          unit_number: p.tenant_assignments?.unit_number || '',
        }));
        setActivities(mapped);
      } catch (err) {
        console.error('RecentActivities error:', err);
      }
    };
    fetchRecent();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#10b981';
      case 'partial': return '#f59e0b';
      default: return '#ef4444';
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  return (
    <div className="surface-card email-list-card glass-card">
      <h3>Recent Payments</h3>
      <div className="email-list">
        {activities.length === 0 ? (
          <div style={{ padding: '16px', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem' }}>
            No recent payments yet.
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="email-row">
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.85rem', flexShrink: 0 }}>
                {activity.tenant_name.charAt(0).toUpperCase()}
              </div>
              <span className="email-name">{activity.tenant_name}</span>
              <span className="email-subject">{activity.property_name} — {activity.unit_number}</span>
              <span className="email-attendees">₹{Number(activity.amount).toLocaleString('en-IN')}</span>
              <span className="email-status" style={{ color: getStatusColor(activity.status) }}>
                {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
              </span>
              <span className="email-time">{formatTimeAgo(activity.payment_date)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
