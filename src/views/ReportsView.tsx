import React from 'react';
import './views.css';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const expensesData = [
    { name: 'Jan', maintenance: 1200, marketing: 400, utilities: 800 },
    { name: 'Feb', maintenance: 1500, marketing: 300, utilities: 750 },
    { name: 'Mar', maintenance: 800, marketing: 500, utilities: 820 },
    { name: 'Apr', maintenance: 2100, marketing: 400, utilities: 780 },
    { name: 'May', maintenance: 900, marketing: 600, utilities: 850 },
    { name: 'Jun', maintenance: 3200, marketing: 400, utilities: 900 } // Big maintenance month
  ];

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="view-title">Financial Reports</h1>
        <button className="btn-white" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Download size={18} /> Export CSV
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)', marginTop: '16px' }}>
        
        {/* Existing Revenue Chart Component re-used for consistency */}
        <div style={{ height: '350px' }}>
          <RevenueChart />
        </div>

        {/* Expenses Breakdown */}
        <div className="surface-card glass-card" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 'var(--spacing-lg)', paddingBottom: '0' }}>
            <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#1e293b' }}>Expenses Breakdown (YTD)</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '4px 0 16px 0' }}>Maintenance, Marketing, and Utilities</p>
          </div>
          
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expensesData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.2)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', color: 'var(--text-primary)' }}
                />
                <Bar dataKey="maintenance" stackId="a" fill="#ef4444" radius={[0, 0, 4, 4]} />
                <Bar dataKey="utilities" stackId="a" fill="#f59e0b" />
                <Bar dataKey="marketing" stackId="a" fill="#dea389" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};
