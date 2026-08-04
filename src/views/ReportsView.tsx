import React, { useState, useEffect } from 'react';
import './views.css';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ExpenseRow {
  name: string;
  Maintenance: number;
  Utilities: number;
  Marketing: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const emptyExpenses = (): ExpenseRow[] =>
  MONTHS.map((m) => ({ name: m, Maintenance: 0, Utilities: 0, Marketing: 0 }));

const fmtRupee = (v: number) =>
  v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`;

export const ReportsView: React.FC = () => {
  const [expensesData, setExpensesData] = useState<ExpenseRow[]>(emptyExpenses());
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [loadingExp, setLoadingExp] = useState(true);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setLoadingExp(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount, category, expense_date');

      if (error) throw error;

      const currentYear = new Date().getFullYear();
      const monthly = emptyExpenses();
      let total = 0;

      (data || []).forEach((exp: any) => {
        const d = new Date(exp.expense_date);
        if (d.getFullYear() !== currentYear) return;
        const amount = Number(exp.amount) || 0;
        const cat = exp.category as string;
        const idx = d.getMonth();
        total += amount;
        if (cat === 'maintenance') monthly[idx].Maintenance += amount;
        else if (cat === 'utilities') monthly[idx].Utilities += amount;
        else if (cat === 'marketing') monthly[idx].Marketing += amount;
      });

      setExpensesData(monthly);
      setTotalExpenses(total);
    } catch (err) {
      console.error('Expenses fetch error:', err);
    } finally {
      setLoadingExp(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const { data: payments } = await supabase
        .from('payments')
        .select(`amount, payment_date, status, period_month, period_year, tenant_assignments(properties(name))`)
        .eq('status', 'paid')
        .order('payment_date', { ascending: true });

      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, category, expense_date, notes')
        .order('expense_date', { ascending: true });

      let csv = 'TYPE,DATE,AMOUNT,DETAILS\n';
      (payments || []).forEach((p: any) => {
        csv += `Revenue,${p.payment_date},${p.amount},"${p.tenant_assignments?.properties?.name || ''}"\n`;
      });
      (expenses || []).forEach((e: any) => {
        csv += `Expense,${e.expense_date},${e.amount},"${e.category}${e.notes ? ' - ' + e.notes : ''}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial-report-${new Date().getFullYear()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  return (
    <div className="view-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="view-title" style={{ marginBottom: '4px' }}>Financial Reports</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            Year-to-date summary for {new Date().getFullYear()}
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            padding: '8px 16px',
            borderRadius: '100px',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Summary KPI card for expenses */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
      }}>
        <div className="surface-card glass-card" style={{ padding: '20px' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 6px 0' }}>Maintenance (YTD)</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ef4444', margin: 0 }}>
            {loadingExp ? '—' : `₹${expensesData.reduce((s, m) => s + m.Maintenance, 0).toLocaleString('en-IN')}`}
          </p>
        </div>
        <div className="surface-card glass-card" style={{ padding: '20px' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 6px 0' }}>Utilities (YTD)</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f59e0b', margin: 0 }}>
            {loadingExp ? '—' : `₹${expensesData.reduce((s, m) => s + m.Utilities, 0).toLocaleString('en-IN')}`}
          </p>
        </div>
        <div className="surface-card glass-card" style={{ padding: '20px' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 6px 0' }}>Total Expenses (YTD)</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {loadingExp ? '—' : `₹${totalExpenses.toLocaleString('en-IN')}`}
          </p>
        </div>
      </div>

      {/* Revenue Chart */}
      <div style={{ height: '380px' }}>
        <RevenueChart />
      </div>

      {/* Expenses Breakdown */}
      <div className="surface-card glass-card" style={{ height: '340px', display: 'flex', flexDirection: 'column', padding: '24px 24px 8px' }}>
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
            Expenses Breakdown (YTD)
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
            Maintenance, Utilities &amp; Marketing — monthly view
          </p>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={expensesData} barSize={14} barGap={3} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
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
                wrapperStyle={{ fontSize: '0.8rem', paddingTop: '4px', color: 'var(--text-secondary)' }}
              />
              <Bar dataKey="Maintenance" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Utilities" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Marketing" stackId="a" fill="#dea389" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};
