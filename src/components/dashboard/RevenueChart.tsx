import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import './dashboard.css';

const data = [
  { name: 'Jan', offline: 400, online: 600 },
  { name: 'Feb', offline: 600, online: 900 },
  { name: 'Mar', offline: 300, online: 450 },
  { name: 'Apr', offline: 400, online: 500 },
  { name: 'May', offline: 700, online: 1200 },
  { name: 'Jun', offline: 350, online: 750 },
  { name: 'Jul', offline: 250, online: 400 },
  { name: 'Aug', offline: 300, online: 450 },
  { name: 'Sep', offline: 400, online: 550 },
];

export const RevenueChart: React.FC = () => {
  return (
    <div className="surface-card chart-card glass-card">
      <div className="chart-header">
        <div className="chart-title-group">
          <h2>Revenue Overview</h2>
          <p>Revenue across properties</p>
        </div>
      </div>
      
      <div className="chart-stats-row">
        <div className="stat-group">
          <span className="stat-label">Residential</span>
          <div className="stat-value-row">
            <h3>$12,201<span className="stat-decimals">.00</span></h3>
            <span className="stat-badge bg-danger">-11%</span>
          </div>
        </div>
        <div className="stat-group">
          <span className="stat-label">Commercial</span>
          <div className="stat-value-row">
            <h3>$100,799<span className="stat-decimals">.00</span></h3>
            <span className="stat-badge bg-success">+6%</span>
          </div>
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={40} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value/1000}k`} />
            <Tooltip
              cursor={{fill: 'transparent'}}
              contentStyle={{ backgroundColor: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', color: 'var(--text-primary)' }}
            />
            <Bar dataKey="offline" radius={[10, 10, 10, 10]}>
              {data.map((entry, index) => (
                <Cell key={`cell-off-${index}`} fill={entry.name === 'May' ? '#b7cbde' : 'rgba(183, 203, 222, 0.3)'} />
              ))}
            </Bar>
            <Bar dataKey="online" radius={[10, 10, 10, 10]} style={{ transform: 'translateY(15px)' }}>
              {data.map((entry, index) => (
                 <Cell key={`cell-on-${index}`} fill={entry.name === 'May' ? '#dea389' : 'rgba(222, 163, 137, 0.3)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
