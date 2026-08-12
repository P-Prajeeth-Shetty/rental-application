import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '../../lib/supabase';
import { ChartDropdown } from './ChartDropdown';
import './dashboard.css';

const COLORS = ['#0f766e', '#7c3aed', '#9ca3af', '#e2e8f0'];

export const DashboardDonutChart: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchData();
  }, [filterType]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: properties, error } = await supabase
        .from('properties')
        .select('property_type');

      if (error) throw error;

      const counts: Record<string, number> = {};
      let totalCount = 0;

      (properties || []).forEach(p => {
        const pt = p.property_type || 'Residential';
        
        if (filterType === 'residential' && pt.toLowerCase() !== 'residential') return;
        if (filterType === 'commercial' && pt.toLowerCase() !== 'commercial') return;

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
    <div className="surface-card" style={{ padding: '24px', borderRadius: '20px', minHeight: '368px', height: '368px', position: 'relative', zIndex: 5, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', position: 'relative', zIndex: 10 }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Properties (%)</h3>
        <ChartDropdown 
          value={filterType} 
          onChange={setFilterType} 
          options={[
            { value: 'all', label: 'All Properties' },
            { value: 'residential', label: 'Residential Only' },
            { value: 'commercial', label: 'Commercial Only' }
          ]} 
        />
      </div>
      
      {loading ? (
        <div style={{ height: '255px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', height: '255px' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Total Properties</p>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>{total} Units</h2>
          </div>
          <div style={{ flex: 2, height: '100%', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="40%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={90}
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
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f766e' }}>100%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

