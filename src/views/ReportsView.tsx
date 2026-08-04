import React, { useState, useEffect } from 'react';
import './views.css';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ExpenseData {
  name: string;
  maintenance: number;
  marketing: number;
  utilities: number;
}

export const ReportsView: React.FC = () => {
  const [expensesData, setExpensesData] = useState<ExpenseData[]>([
    { name: 'Jan', maintenance: 0, marketing: 0, utilities: 0 },
    { name: 'Feb', maintenance: 0, marketing: 0, utilities: 0 },
    { name: 'Mar', maintenance: 0, marketing: 0, utilities: 0 },
    { name: 'Apr', maintenance: 0, marketing: 0, utilities: 0 },
    { name: 'May', maintenance: 0, marketing: 0, utilities: 0 },
    { name: 'Jun', maintenance: 0, marketing: 0, utilities: 0 },
    { name: 'Jul', maintenance: 0, marketing: 0, utilities: 0 },
    { name: 'Aug', maintenance: 0, marketing: 0, utilities: 0 },
    { name: 'Sep', maintenance: 0, marketing: 0, utilities: 0 },
    { name: 'Oct', maintenance: 0, marketing: 0, utilities: 0 },
    { name: 'Nov', maintenance: 0, marketing: 0, utilities: 0 },
    { name: 'Dec', maintenance: 0, marketing: 0, utilities: 0 },
  ]);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount, category, expense_date');

      if (error) {
        console.error('Error fetching expenses:', error);
        return;
      }

      if (data) {
        const currentYear = new Date().getFullYear();
        const monthlyData = [
          { name: 'Jan', maintenance: 0, marketing: 0, utilities: 0 },
          { name: 'Feb', maintenance: 0, marketing: 0, utilities: 0 },
          { name: 'Mar', maintenance: 0, marketing: 0, utilities: 0 },
          { name: 'Apr', maintenance: 0, marketing: 0, utilities: 0 },
          { name: 'May', maintenance: 0, marketing: 0, utilities: 0 },
          { name: 'Jun', maintenance: 0, marketing: 0, utilities: 0 },
          { name: 'Jul', maintenance: 0, marketing: 0, utilities: 0 },
          { name: 'Aug', maintenance: 0, marketing: 0, utilities: 0 },
          { name: 'Sep', maintenance: 0, marketing: 0, utilities: 0 },
          { name: 'Oct', maintenance: 0, marketing: 0, utilities: 0 },
          { name: 'Nov', maintenance: 0, marketing: 0, utilities: 0 },
          { name: 'Dec', maintenance: 0, marketing: 0, utilities: 0 },
        ];

        data.forEach((expense: any) => {
          const date = new Date(expense.expense_date);
          if (date.getFullYear() === currentYear) {
            const monthIndex = date.getMonth();
            const category = expense.category;
            const amount = Number(expense.amount);
            
            if (category === 'maintenance') monthlyData[monthIndex].maintenance += amount;
            else if (category === 'marketing') monthlyData[monthIndex].marketing += amount;
            else if (category === 'utilities') monthlyData[monthIndex].utilities += amount;
            // 'insurance', 'taxes', 'other' are ignored in this specific chart for now
          }
        });

        setExpensesData(monthlyData);
      }
    } catch (err) {
      console.error('Failed to fetch expenses', err);
    }
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="view-title">Financial Reports</h1>
        <button className="btn-white" style={{ display: 'flex', gap: '8px', alignItems: 'center', width: 'auto' }}>
          <Download size={18} /> Export CSV
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)', marginTop: '16px' }}>
        
        {/* Existing Revenue Chart Component re-used for consistency */}
        <div style={{ height: '350px' }}>
          <RevenueChart />
        </div>

        {/* Expenses Breakdown */}
        <div className="surface-card glass-card" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 'var(--spacing-lg)', paddingBottom: '0' }}>
            <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#1e293b' }}>Expenses Breakdown (YTD)</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '4px 0 16px 0' }}>Maintenance, Marketing, and Utilities</p>
          </div>
          
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expensesData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.2)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', color: 'var(--text-primary)' }}
                />
                <Bar dataKey="maintenance" stackId="a" fill="#ef4444" radius={[0, 0, 4, 4]} />
                <Bar dataKey="utilities" stackId="a" fill="#f59e0b" />
                <Bar dataKey="marketing" stackId="a" fill="#dea389" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};
