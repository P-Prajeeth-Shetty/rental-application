import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabase';
import './dashboard.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const DashboardAreaChart: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: payments, error } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .eq('status', 'paid');

      if (error) throw error;

      const currentYear = new Date().getFullYear();
      const monthly = MONTHS.map(m => ({ name: m, Total: 0 }));

      (payments || []).forEach((pay: any) => {
        const d = new Date(pay.payment_date);
        if (d.getFullYear() !== currentYear) return;
        monthly[d.getMonth()].Total += Number(pay.amount) || 0;
      });

      setData(monthly.slice(0, new Date().getMonth() + 1));
    } catch (err) {
      console.error('Error fetching activity data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fmtRupee = (v: number) => `₹${Number(v).toLocaleString('en-IN')}`;

  return (
    <div className="surface-card" style={{ padding: '24px', borderRadius: '20px', minHeight: '340px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Monthly Activity</h3>
        <select style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'white', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          <option>Monthly</option>
        </select>
      </div>

      {loading ? (
        <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>
      ) : (
        <div style={{ height: '260px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} />
              <Tooltip 
                formatter={(value: any) => [fmtRupee(Number(value) || 0), 'Total']}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 600 }}
              />
              <Area 
                type="monotone" 
                dataKey="Total" 
                stroke="#8b5cf6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorTotal)" 
                activeDot={{ r: 6, fill: 'white', stroke: '#8b5cf6', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
