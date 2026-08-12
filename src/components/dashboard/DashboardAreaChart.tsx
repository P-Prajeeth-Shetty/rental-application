import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabase';
import { ChartDropdown } from './ChartDropdown';
import './dashboard.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const DashboardAreaChart: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('monthly');

  useEffect(() => {
    fetchData();
  }, [viewMode]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: payments, error } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .eq('status', 'paid');

      if (error) throw error;

      const currentYear = new Date().getFullYear();

      if (viewMode === 'quarterly') {
        const quarterly = [
          { name: 'Q1 (Jan-Mar)', Total: 0 },
          { name: 'Q2 (Apr-Jun)', Total: 0 },
          { name: 'Q3 (Jul-Sep)', Total: 0 },
          { name: 'Q4 (Oct-Dec)', Total: 0 },
        ];

        (payments || []).forEach((pay: any) => {
          const d = new Date(pay.payment_date);
          if (d.getFullYear() !== currentYear) return;
          const qIdx = Math.floor(d.getMonth() / 3);
          if (qIdx >= 0 && qIdx < 4) {
            quarterly[qIdx].Total += Number(pay.amount) || 0;
          }
        });
        setData(quarterly);
      } else {
        // Full 12 Months (Jan - Dec)
        const monthly = MONTHS.map(m => ({ name: m, Total: 0 }));

        (payments || []).forEach((pay: any) => {
          const d = new Date(pay.payment_date);
          if (d.getFullYear() !== currentYear) return;
          const monthIdx = d.getMonth();
          if (monthIdx >= 0 && monthIdx < 12) {
            monthly[monthIdx].Total += Number(pay.amount) || 0;
          }
        });
        setData(monthly);
      }
    } catch (err) {
      console.error('Error fetching activity data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fmtRupee = (v: number) => `₹${Number(v).toLocaleString('en-IN')}`;

  return (
    <div className="surface-card" style={{ padding: '24px', borderRadius: '1px', minHeight: '368px', height: '368px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Monthly Activity</h3>
        <ChartDropdown 
          value={viewMode} 
          onChange={setViewMode} 
          options={[
            { value: 'monthly', label: 'Monthly View' },
            { value: 'quarterly', label: 'Quarterly View' }
          ]} 
        />
      </div>

      {loading ? (
        <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>
      ) : (
        <div style={{ height: '280px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 15, right: 25, left: 25, bottom: 10 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f766e" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#9ca3af', fontSize: 12 }} 
                dy={10} 
                padding={{ left: 15, right: 15 }}
              />
              <Tooltip 
                formatter={(value: any) => [fmtRupee(Number(value) || 0), 'Total']}
                contentStyle={{ borderRadius: '1px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 600 }}
              />
              <Area 
                type="monotone" 
                dataKey="Total" 
                stroke="#0f766e" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorTotal)" 
                activeDot={{ r: 6, fill: 'white', stroke: '#0f766e', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

