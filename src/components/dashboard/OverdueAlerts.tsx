import React, { useEffect, useState } from 'react';
import { AlertTriangle, IndianRupee } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import './dashboard.css';

interface OverdueItem {
  assignmentId: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  monthlyRent: number;
  overdueMonths: { month: number; year: number }[];
  totalOverdue: number;
}

export const OverdueAlerts: React.FC = () => {
  const [overdueItems, setOverdueItems] = useState<OverdueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOverdues = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('payment-stats', {
          body: { action: 'dashboard' },
        });
        if (error) throw error;
        if (data?.overdueItems) {
          setOverdueItems(data.overdueItems);
        }
      } catch (err) {
        console.error('OverdueAlerts error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOverdues();
  }, []);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (isLoading) {
    return (
      <div className="surface-card glass-card overdue-alerts-card">
        <div className="overdue-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="overdue-icon-wrap">
              <AlertTriangle size={18} />
            </div>
            <h3>Overdue Payments</h3>
          </div>
        </div>
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Checking overdue payments...
        </div>
      </div>
    );
  }

  if (overdueItems.length === 0) {
    return (
      <div className="surface-card glass-card overdue-alerts-card">
        <div className="overdue-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="overdue-icon-wrap" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
              <AlertTriangle size={18} />
            </div>
            <h3>Overdue Payments</h3>
          </div>
        </div>
        <div style={{ padding: '24px', textAlign: 'center', color: '#10b981', fontSize: '0.9rem', fontWeight: 500 }}>
          ✅ All payments are up to date!
        </div>
      </div>
    );
  }

  const totalOverdueAmount = overdueItems.reduce((s, i) => s + i.totalOverdue, 0);
  const totalOverdueCount = overdueItems.reduce((s, i) => s + i.overdueMonths.length, 0);

  return (
    <div className="surface-card glass-card overdue-alerts-card">
      <div className="overdue-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="overdue-icon-wrap overdue-pulse">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0 }}>Overdue Payments</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {overdueItems.length} tenant{overdueItems.length > 1 ? 's' : ''} · {totalOverdueCount} month{totalOverdueCount > 1 ? 's' : ''} overdue
            </p>
          </div>
        </div>
        <div className="overdue-total-badge">
          ₹{totalOverdueAmount.toLocaleString('en-IN')}
        </div>
      </div>

      <div className="overdue-list">
        {overdueItems.map(item => (
          <div key={item.assignmentId} className="overdue-row">
            <div className="overdue-row-left">
              <div className="overdue-avatar">
                {item.tenantName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="overdue-tenant-name">{item.tenantName}</div>
                <div className="overdue-property">{item.propertyName} — {item.unitNumber}</div>
              </div>
            </div>
            <div className="overdue-row-right">
              <div className="overdue-months-badges">
                {item.overdueMonths.slice(0, 3).map((om, i) => (
                  <span key={i} className="overdue-month-badge">
                    {monthNames[om.month - 1]} {om.year}
                  </span>
                ))}
                {item.overdueMonths.length > 3 && (
                  <span className="overdue-month-badge overdue-more">
                    +{item.overdueMonths.length - 3} more
                  </span>
                )}
              </div>
              <div className="overdue-amount">
                <IndianRupee size={13} />
                {item.totalOverdue.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
