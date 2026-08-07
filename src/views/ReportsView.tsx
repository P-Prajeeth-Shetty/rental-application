import React, { useState, useEffect } from 'react';
import './views.css';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CustomSelect } from '../components/ui/CustomSelect';

interface ExpenseRow {
  name: string;
  Maintenance: number;
  Utilities: number;
  Marketing: number;
}

interface TenantAssignmentRow {
  id: string;
  unit_number: string;
  current_rent: number;
  lease_start: string;
  lease_end: string | null;
  security_deposit: number;
  status: string;
  tenants: { full_name: string; phone: string | null } | null;
  properties: { name: string } | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const emptyExpenses = (): ExpenseRow[] =>
  MONTHS.map((m) => ({ name: m, Maintenance: 0, Utilities: 0, Marketing: 0 }));

const fmtRupee = (v: number) => `₹${Number(v).toLocaleString('en-IN')}`;

export const ReportsView: React.FC = () => {
  const [expensesData, setExpensesData] = useState<ExpenseRow[]>(emptyExpenses());
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [loadingExp, setLoadingExp] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const [assignments, setAssignments] = useState<TenantAssignmentRow[]>([]);
  const [paymentStatusMap, setPaymentStatusMap] = useState<Record<string, { status: string; isOverdue: boolean; balance: number }>>({});
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  useEffect(() => {
    fetchExpenses();
    fetchAssignments();
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

  const fetchAssignments = async () => {
    setLoadingAssignments(true);
    try {
      const { data, error } = await supabase
        .from('tenant_assignments')
        .select(`
          id, unit_number, current_rent, lease_start, lease_end, security_deposit, status,
          tenants(full_name, phone), properties(name)
        `)
        .eq('status', 'active');
      
      if (error) throw error;
      setAssignments(data as unknown as TenantAssignmentRow[]);

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const { data: statusData, error: statusErr } = await supabase.functions.invoke('payment-stats', {
        body: { action: 'payment-status', filterMonth: currentMonth, filterYear: currentYear },
      });
      if (!statusErr && statusData?.statusMap) {
        setPaymentStatusMap(statusData.statusMap);
      }
    } catch (err) {
      console.error('Assignments fetch error:', err);
    } finally {
      setLoadingAssignments(false);
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
      
      csv += '\n--- TENANT LEASE REPORT ---\n';
      csv += 'TENANT,PHONE,PROPERTY,UNIT,START DATE,END DATE,RENT,DEPOSIT,BALANCE AMOUNT,PAYMENT STATUS\n';
      assignments.forEach(a => {
        const statusInfo = paymentStatusMap[a.id];
        const badgeText = statusInfo?.status === 'paid' ? 'Paid' : statusInfo?.isOverdue ? 'Overdue' : statusInfo?.status === 'partial' ? 'Partial' : 'Pending';
        const balanceAmount = statusInfo?.balance > 0 ? statusInfo.balance : 0;
        csv += `"${a.tenants?.full_name || ''}","${a.tenants?.phone || ''}","${a.properties?.name || ''}","${a.unit_number}",${a.lease_start},${a.lease_end || 'Ongoing'},${a.current_rent},${a.security_deposit || 0},${balanceAmount},${badgeText}\n`;
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

      {/* Toolbar (Search + Filters + Actions) */}
      <div className="search-filter-row">
        <div className="search-input-container">
          <Search size={18} color="var(--text-secondary)" />
          <input 
            type="text" 
            placeholder="Search reports..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <CustomSelect
              value={String(filterMonth)}
              onChange={(val) => setFilterMonth(parseInt(val))}
              options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
              width="120px"
              height={48}
            />
            <input 
              type="number" 
              value={filterYear} 
              onChange={e => setFilterYear(parseInt(e.target.value))} 
              style={{ padding: '0 12px', height: '48px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', width: '80px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }} 
            />
          </div>
          <button
            onClick={handleExportCSV}
            className="btn-primary"
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              padding: '0 16px',
              borderRadius: '8px',
              height: '48px',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Download size={16} /> Export CSV
          </button>
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

      {/* Detailed Tenant & Lease Report */}
      <div className="surface-card glass-card static-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
            Detailed Tenant &amp; Lease Report
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
            Real-time monitoring of all active leases, deposits, and payment status for the current month
          </p>
        </div>
        
        <div className="glass-table-wrapper" style={{ overflowX: 'auto' }}>
          <table className="glass-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Property &amp; Unit</th>
                <th>Lease Timeline</th>
                <th>Rent (₹)</th>
                <th>Advance (₹)</th>
                <th>Balance (₹)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loadingAssignments ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Loading lease data...</td>
                </tr>
              ) : assignments.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>No active tenants found.</td>
                </tr>
              ) : (
                assignments
                  .filter(a => {
                    if (!searchQuery) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      a.tenants?.full_name?.toLowerCase().includes(q) ||
                      a.properties?.name?.toLowerCase().includes(q) ||
                      a.unit_number.toLowerCase().includes(q)
                    );
                  })
                  .map(a => {
                  const statusInfo = paymentStatusMap[a.id];
                  const badgeClass = statusInfo?.status === 'paid' ? 'success' : statusInfo?.isOverdue ? 'danger' : statusInfo?.status === 'partial' ? 'warning' : 'default';
                  const badgeText = statusInfo?.status === 'paid' ? 'Paid' : statusInfo?.isOverdue ? 'Overdue' : statusInfo?.status === 'partial' ? 'Partial' : 'Pending';
                  
                  return (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{a.tenants?.full_name || 'N/A'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{a.tenants?.phone || 'No phone'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{a.properties?.name || 'N/A'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Unit: {a.unit_number}</div>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        <div style={{ color: 'var(--text-primary)' }}>{new Date(a.lease_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          to {a.lease_end ? new Date(a.lease_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Ongoing'}
                        </div>
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {fmtRupee(a.current_rent)}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {fmtRupee(a.security_deposit || 0)}
                      </td>
                      <td style={{ color: statusInfo?.isOverdue ? 'var(--danger)' : 'var(--text-primary)', fontWeight: statusInfo?.isOverdue ? 600 : 500 }}>
                        {statusInfo?.balance > 0 ? fmtRupee(statusInfo.balance) : '—'}
                      </td>
                      <td>
                        <span className={`status-badge ${badgeClass}`}>
                          {badgeText}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
