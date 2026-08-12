import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '../../lib/supabase';
import { ChartDropdown } from './ChartDropdown';
import './dashboard.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const DashboardLineChart: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('full_year');

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: payments, error } = await supabase
        .from('payments')
        .select(`
          amount,
          payment_date,
          status,
          tenant_assignments (
            properties (
              property_type
            )
          )
        `)
        .eq('status', 'paid');

      if (error) throw error;

      const currentYear = new Date().getFullYear();
      const monthly = MONTHS.map(m => ({ name: m, Residential: 0, Commercial: 0 }));

      (payments || []).forEach((pay: any) => {
        const d = new Date(pay.payment_date);
        if (d.getFullYear() !== currentYear) return;

        const amount = Number(pay.amount) || 0;
        const pType = pay.tenant_assignments?.properties?.property_type ?? 'Residential';
        const monthIdx = d.getMonth();

        if (monthIdx >= 0 && monthIdx < 12) {
          if (pType.toLowerCase() === 'commercial') {
            monthly[monthIdx].Commercial += amount;
          } else {
            monthly[monthIdx].Residential += amount;
          }
        }
      });

      if (timeRange === 'last_6_months') {
        const currentMonthIdx = new Date().getMonth();
        const startIdx = Math.max(0, currentMonthIdx - 5);
        setData(monthly.slice(startIdx, currentMonthIdx + 1));
      } else {
        // Full 12-month timeline (Jan - Dec)
        setData(monthly);
      }
    } catch (err) {
      console.error('Error fetching revenue data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fmtRupee = (v: number) => `₹${Number(v).toLocaleString('en-IN')}`;

  return (
    <div className="surface-card" style={{ padding: '24px', borderRadius: '1px', minHeight: '368px', height: '368px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Revenue by Type</h3>
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '12px', height: '12px', background: '#0f766e', borderRadius: '2px' }}></span>
              Residential
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '12px', height: '12px', background: '#7c3aed', borderRadius: '2px' }}></span>
              Commercial
            </span>
          </div>
        </div>
        <ChartDropdown 
          value={timeRange} 
          onChange={setTimeRange} 
          options={[
            { value: 'full_year', label: 'This Year (Jan - Dec)' },
            { value: 'last_6_months', label: 'Last 6 Months' }
          ]} 
        />
      </div>

      {loading ? (
        <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>
      ) : (
        <div style={{ height: '280px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#9ca3af', fontSize: 12 }} 
                dy={10} 
                padding={{ left: 15, right: 15 }}
              />
              <Tooltip 
                formatter={(value: any, name: any) => [fmtRupee(Number(value) || 0), name]}
                contentStyle={{ borderRadius: '1px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 600 }}
              />
              <Line 
                type="monotone" 
                dataKey="Residential" 
                stroke="#0f766e" 
                strokeWidth={3} 
                dot={{ r: 4, strokeWidth: 2, fill: 'white' }} 
                activeDot={{ r: 6 }} 
              />
              <Line 
                type="monotone" 
                dataKey="Commercial" 
                stroke="#7c3aed" 
                strokeWidth={3} 
                dot={{ r: 4, strokeWidth: 2, fill: 'white' }} 
                activeDot={{ r: 6 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

