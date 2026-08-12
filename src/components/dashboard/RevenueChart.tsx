import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './dashboard.css';
import { supabase } from '../../lib/supabase';

interface RevenueData {
  name: string;
  Residential: number;
  Commercial: number;
  Maintenance: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const emptyData = (): RevenueData[] =>
  MONTHS.map((m) => ({ name: m, Residential: 0, Commercial: 0, Maintenance: 0 }));

const fmtRupee = (v: number) => `₹${Number(v).toLocaleString('en-IN')}`;

export const RevenueChart: React.FC<{ filterPropertyId?: string, filterYear: number, filterMonth: number }> = ({ filterPropertyId, filterYear, filterMonth }) => {
  const [chartData, setChartData] = useState<RevenueData[]>(emptyData());
  const [resTotal, setResTotal] = useState(0);
  const [comTotal, setComTotal] = useState(0);
  const [mainTotal, setMainTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Helper to get days in month
  const getDaysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate();

  const getEmptyData = () => {
    if (filterMonth > 0) {
      const days = getDaysInMonth(filterMonth, filterYear);
      return Array.from({ length: days }, (_, i) => ({
        name: `${i + 1}`, Residential: 0, Commercial: 0, Maintenance: 0
      }));
    }
    return MONTHS.map(m => ({ name: m, Residential: 0, Commercial: 0, Maintenance: 0 }));
  };

  useEffect(() => {
    fetchRevenue();
  }, [filterPropertyId, filterYear, filterMonth]);

  const fetchRevenue = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('payments')
        .select(`
          amount,
          payment_date,
          status,
          payment_type,
          tenant_assignments (
            property_id,
            properties (
              property_type
            )
          )
        `)
        .eq('status', 'paid');
        
      if (filterPropertyId) {
        query = query.eq('tenant_assignments.property_id', filterPropertyId);
      }

      const { data, error } = await query;

      if (error) throw error;


      const chartRows = getEmptyData();
      let totalR = 0;
      let totalC = 0;
      let totalM = 0;

      (data || []).forEach((pay: any) => {
        // Since we are filtering using inner join style in postgrest, if we did eq('tenant_assignments.property_id')
        // it filters the tenant_assignments array. But actually, payments to tenant_assignments is many-to-one.
        // Wait, supabase returns `tenant_assignments: null` if it doesn't match the inner filter!
        if (filterPropertyId && !pay.tenant_assignments) return;

        const d = new Date(pay.payment_date);
        if (d.getFullYear() !== filterYear) return;
        if (filterMonth > 0 && d.getMonth() + 1 !== filterMonth) return;

        const amount = Number(pay.amount) || 0;
        const pType = pay.tenant_assignments?.properties?.property_type ?? 'Residential';
        const pMethodType = pay.payment_type;
        const idx = filterMonth > 0 ? d.getDate() - 1 : d.getMonth();

        if (pMethodType === 'maintenance') {
          chartRows[idx].Maintenance += amount;
          totalM += amount;
        } else if (pType.toLowerCase() === 'commercial') {
          chartRows[idx].Commercial += amount;
          totalC += amount;
        } else {
          chartRows[idx].Residential += amount;
          totalR += amount;
        }
      });

      setChartData(chartRows);
      setResTotal(totalR);
      setComTotal(totalC);
      setMainTotal(totalM);
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
          <p>Rent collected by property type — {filterMonth > 0 ? `${MONTHS[filterMonth - 1]} ${filterYear}` : filterYear}</p>
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
            <h3 style={{ color: '#10b981', fontSize: '1.4rem' }}>
              {loading ? '—' : `₹${comTotal.toLocaleString('en-IN')}`}
            </h3>
          </div>
        </div>
        <div className="stat-group">
          <span className="stat-label">Maintenance</span>
          <div className="stat-value-row">
            <h3 style={{ color: '#f59e0b', fontSize: '1.4rem' }}>
              {loading ? '—' : `₹${mainTotal.toLocaleString('en-IN')}`}
            </h3>
          </div>
        </div>
        <div className="stat-group">
          <span className="stat-label">Total YTD</span>
          <div className="stat-value-row">
            <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>
              {loading ? '—' : `₹${(resTotal + comTotal + mainTotal).toLocaleString('en-IN')}`}
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
                borderRadius: '1px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
              formatter={(value: any, name: any) => [`₹${Number(value).toLocaleString('en-IN')}`, name]}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="circle" 
              iconSize={8}
              wrapperStyle={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
            />
            <Bar dataKey="Commercial" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Maintenance" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Residential" stackId="a" fill="#7fa8c4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
