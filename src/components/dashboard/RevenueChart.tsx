import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './dashboard.css';
import { supabase } from '../../lib/supabase';

interface RevenueData {
  name: string;
  Residential: number;
  Commercial: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const emptyData = (): RevenueData[] =>
  MONTHS.map((m) => ({ name: m, Residential: 0, Commercial: 0 }));

const fmtRupee = (v: number) => `₹${Number(v).toLocaleString('en-IN')}`;

export const RevenueChart: React.FC = () => {
  const [chartData, setChartData] = useState<RevenueData[]>(emptyData());
  const [resTotal, setResTotal] = useState(0);
  const [comTotal, setComTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRevenue();
  }, []);

  const fetchRevenue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
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
      const monthly = emptyData();
      let totalR = 0;
      let totalC = 0;

      (data || []).forEach((pay: any) => {
        const d = new Date(pay.payment_date);
        if (d.getFullYear() !== currentYear) return;

        const amount = Number(pay.amount) || 0;
        const pType = pay.tenant_assignments?.properties?.property_type ?? 'Residential';
        const monthIdx = d.getMonth();

        if (pType.toLowerCase() === 'commercial') {
          monthly[monthIdx].Commercial += amount;
          totalC += amount;
        } else {
          monthly[monthIdx].Residential += amount;
          totalR += amount;
        }
      });

      setChartData(monthly);
      setResTotal(totalR);
      setComTotal(totalC);
    } catch (err) {
      console.error('Revenue fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-card chart-card glass-card">
      <div className="chart-header">
        <div className="chart-title-group">
          <h2>Revenue Overview</h2>
          <p>Rent collected by property type — {new Date().getFullYear()}</p>
        </div>
      </div>

      <div className="chart-stats-row">
        <div className="stat-group">
          <span className="stat-label">Residential</span>
          <div className="stat-value-row">
            <h3 style={{ color: '#7fa8c4', fontSize: '1.4rem' }}>
              {loading ? '—' : `₹${resTotal.toLocaleString('en-IN')}`}
            </h3>
          </div>
        </div>
        <div className="stat-group">
          <span className="stat-label">Commercial</span>
          <div className="stat-value-row">
            <h3 style={{ color: '#dea389', fontSize: '1.4rem' }}>
              {loading ? '—' : `₹${comTotal.toLocaleString('en-IN')}`}
            </h3>
          </div>
        </div>
        <div className="stat-group">
          <span className="stat-label">Total YTD</span>
          <div className="stat-value-row">
            <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>
              {loading ? '—' : `₹${(resTotal + comTotal).toLocaleString('en-IN')}`}
            </h3>
          </div>
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barSize={18} barGap={4} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtRupee} />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              contentStyle={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
              formatter={(value: any, name: any) => [`₹${Number(value).toLocaleString('en-IN')}`, name]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '0.8rem', paddingTop: '8px', color: 'var(--text-secondary)' }}
            />
            <Bar dataKey="Residential" fill="#b7cbde" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Commercial" fill="#dea389" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
