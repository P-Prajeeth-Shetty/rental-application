import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import './dashboard.css';
import { supabase } from '../../lib/supabase';

interface RevenueData {
  name: string;
  residential: number;
  commercial: number;
}

export const RevenueChart: React.FC = () => {
  const [data, setData] = useState<RevenueData[]>([
    { name: 'Jan', residential: 0, commercial: 0 },
    { name: 'Feb', residential: 0, commercial: 0 },
    { name: 'Mar', residential: 0, commercial: 0 },
    { name: 'Apr', residential: 0, commercial: 0 },
    { name: 'May', residential: 0, commercial: 0 },
    { name: 'Jun', residential: 0, commercial: 0 },
    { name: 'Jul', residential: 0, commercial: 0 },
    { name: 'Aug', residential: 0, commercial: 0 },
    { name: 'Sep', residential: 0, commercial: 0 },
    { name: 'Oct', residential: 0, commercial: 0 },
    { name: 'Nov', residential: 0, commercial: 0 },
    { name: 'Dec', residential: 0, commercial: 0 },
  ]);

  const [resTotal, setResTotal] = useState(0);
  const [comTotal, setComTotal] = useState(0);

  useEffect(() => {
    fetchRevenue();
  }, []);

  const fetchRevenue = async () => {
    try {
      // Fetch payments that are 'paid' and join with property type
      const { data: paymentsData, error } = await supabase
        .from('payments')
        .select(`
          amount,
          payment_date,
          tenant_assignments!inner (
            properties!inner (
              property_type
            )
          )
        `)
        .eq('status', 'paid');

      if (error) {
        console.error('Error fetching revenue:', error);
        return;
      }

      if (paymentsData) {
        const currentYear = new Date().getFullYear();
        const monthlyData = [
          { name: 'Jan', residential: 0, commercial: 0 },
          { name: 'Feb', residential: 0, commercial: 0 },
          { name: 'Mar', residential: 0, commercial: 0 },
          { name: 'Apr', residential: 0, commercial: 0 },
          { name: 'May', residential: 0, commercial: 0 },
          { name: 'Jun', residential: 0, commercial: 0 },
          { name: 'Jul', residential: 0, commercial: 0 },
          { name: 'Aug', residential: 0, commercial: 0 },
          { name: 'Sep', residential: 0, commercial: 0 },
          { name: 'Oct', residential: 0, commercial: 0 },
          { name: 'Nov', residential: 0, commercial: 0 },
          { name: 'Dec', residential: 0, commercial: 0 },
        ];

        let totalR = 0;
        let totalC = 0;

        paymentsData.forEach((pay: any) => {
          const date = new Date(pay.payment_date);
          if (date.getFullYear() === currentYear) {
            const monthIndex = date.getMonth();
            const amount = Number(pay.amount);
            
            const pType = pay.tenant_assignments?.properties?.property_type || 'Residential';
            
            if (pType.toLowerCase() === 'commercial') {
              monthlyData[monthIndex].commercial += amount;
              totalC += amount;
            } else {
              monthlyData[monthIndex].residential += amount;
              totalR += amount;
            }
          }
        });

        setData(monthlyData);
        setResTotal(totalR);
        setComTotal(totalC);
      }
    } catch (err) {
      console.error('Failed to fetch revenue', err);
    }
  };

  return (
    <div className="surface-card chart-card glass-card">
      <div className="chart-header">
        <div className="chart-title-group">
          <h2>Revenue Overview</h2>
          <p>Revenue across properties ({new Date().getFullYear()})</p>
        </div>
      </div>
      
      <div className="chart-stats-row">
        <div className="stat-group">
          <span className="stat-label">Residential</span>
          <div className="stat-value-row">
            <h3>₹{resTotal.toLocaleString('en-IN')}</h3>
          </div>
        </div>
        <div className="stat-group">
          <span className="stat-label">Commercial</span>
          <div className="stat-value-row">
            <h3>₹{comTotal.toLocaleString('en-IN')}</h3>
          </div>
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={40} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => value >= 1000 ? `₹${value/1000}k` : `₹${value}`} />
            <Tooltip
              cursor={{fill: 'transparent'}}
              contentStyle={{ backgroundColor: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', color: 'var(--text-primary)' }}
              formatter={(value: any) => `₹${Number(value).toLocaleString('en-IN')}`}
            />
            <Bar dataKey="residential" radius={[10, 10, 10, 10]}>
              {data.map((entry, index) => (
                <Cell key={`cell-res-${index}`} fill={entry.name === 'May' ? '#b7cbde' : 'rgba(183, 203, 222, 0.8)'} />
              ))}
            </Bar>
            <Bar dataKey="commercial" radius={[10, 10, 10, 10]}>
              {data.map((entry, index) => (
                 <Cell key={`cell-com-${index}`} fill={entry.name === 'May' ? '#dea389' : 'rgba(222, 163, 137, 0.8)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
