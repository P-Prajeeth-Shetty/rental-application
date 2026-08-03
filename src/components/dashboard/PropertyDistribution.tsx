import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const data = [
  { name: 'Residential (Occupied)', value: 450 },
  { name: 'Residential (Vacant)', value: 30 },
  { name: 'Commercial (Occupied)', value: 120 },
  { name: 'Commercial (Vacant)', value: 15 },
];

const COLORS = ['#6366f1', '#4f46e5', '#10b981', '#059669'];

export const PropertyDistribution: React.FC = () => {
  return (
    <div className="surface-card chart-card">
      <div className="chart-header">
        <h2>Property Portfolio</h2>
      </div>
      <div className="chart-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#13161c', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
              itemStyle={{ color: '#f8fafc' }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px', width: '100%', fontSize: '0.875rem' }}>
          {data.map((entry, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: COLORS[index] }}></span>
              <span style={{ color: 'var(--text-secondary)' }}>{entry.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
