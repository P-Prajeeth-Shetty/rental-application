import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '../../lib/supabase';
import './dashboard.css';

const COLORS = ['#3b82f6', '#6366f1', '#f472b6', '#10b981'];

export const DashboardDonutChart: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: properties, error } = await supabase
        .from('properties')
        .select('property_type');

      if (error) throw error;

      const counts: Record<string, number> = {};
      let totalCount = 0;
      (properties || []).forEach(p => {
        const pt = p.property_type || 'Unknown';
        counts[pt] = (counts[pt] || 0) + 1;
        totalCount++;
      });

      const formattedData = Object.keys(counts).map(key => ({
        name: key,
        value: counts[key]
      }));

      setData(formattedData);
      setTotal(totalCount);
    } catch (err) {
      console.error('Error fetching property types:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderCustomizedLabel = () => null;

  return (
    <div className="surface-card" style={{ padding: '24px', borderRadius: '20px', minHeight: '340px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Properties (%)</h3>
        <select style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'white', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          <option>All Time</option>
        </select>
      </div>
      
      {loading ? (
        <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', height: '220px' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Total Properties</p>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{total} Units</h2>
          </div>
          <div style={{ flex: 2, height: '100%', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="40%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomizedLabel}
                >
                  {data.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontWeight: 600 }}
                />
                <Legend 
                  layout="vertical" 
                  verticalAlign="middle" 
                  align="right"
                  iconType="square"
                  wrapperStyle={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', top: '50%', left: '40%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Total</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#3b82f6' }}>100%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
