import React, { useState, useEffect } from 'react';
import './views.css';
import { RevenueChart } from '../components/dashboard/RevenueChart';

import { Download, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CustomSelect } from '../components/ui/CustomSelect';


interface TenantAssignmentRow {
  id: string;
  unit_number: string;
  current_rent: number;
  lease_start: string;
  lease_end: string | null;
  security_deposit: number;
  status: string;
  gst_rate?: number;
  tds_rate?: number;
  tenants: { full_name: string; phone: string | null } | null;
  properties: { id: string, name: string } | null;
  rent_revisions?: { previous_rent: number; new_rent: number; effective_from: string }[];
}

function getEffectiveRentAsOf(assignment: TenantAssignmentRow, date: Date = new Date()) {
  if (!assignment.rent_revisions || assignment.rent_revisions.length === 0) {
    return assignment.current_rent;
  }
  const sortedRevisions = [...assignment.rent_revisions].sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime());
  
  const compareDate = new Date(date);
  compareDate.setHours(0,0,0,0);

  for (const rev of sortedRevisions) {
    const effectiveDate = new Date(rev.effective_from);
    effectiveDate.setHours(0,0,0,0);
    if (compareDate >= effectiveDate) {
      return rev.new_rent;
    }
  }
  return sortedRevisions[sortedRevisions.length - 1].previous_rent;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtRupee = (v: number) => `₹${Number(v).toLocaleString('en-IN')}`;

export const ReportsView: React.FC = () => {

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterPropertyId, setFilterPropertyId] = useState('');
  const [properties, setProperties] = useState<{id: string, name: string}[]>([]);

  const [assignments, setAssignments] = useState<TenantAssignmentRow[]>([]);
  const [paymentStatusMap, setPaymentStatusMap] = useState<Record<string, { status: string; isOverdue: boolean; balance: number }>>({});
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  const [rentKPIs, setRentKPIs] = useState({ expected: 0, collected: 0 });
  const [maintKPIs, setMaintKPIs] = useState({ expected: 0, collected: 0 });

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    fetchAssignmentsAndKPIs();
  }, [filterMonth, filterYear, filterPropertyId]);

  const fetchProperties = async () => {
    const { data } = await supabase.from('properties').select('id, name').order('name');
    if (data) setProperties(data);
  };


  const fetchAssignmentsAndKPIs = async () => {
    setLoadingAssignments(true);
    try {
      let query = supabase
        .from('tenant_assignments')
        .select(`
          id, unit_number, current_rent, lease_start, lease_end, security_deposit, status, property_id,
          gst_rate, tds_rate, rent_revisions(previous_rent, new_rent, effective_from),
          tenants(full_name, phone), properties(id, name)
        `)
        .eq('status', 'active');
        
      if (filterPropertyId) {
        query = query.eq('property_id', filterPropertyId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const assignmentsData = (data || []) as unknown as TenantAssignmentRow[];
      setAssignments(assignmentsData);

      // KPI Calculations
      const currentMonth = filterMonth;
      const currentYear = filterYear;
      
      // Expected Rent
      const filterPeriodDate = new Date(currentYear, currentMonth === 0 ? 0 : currentMonth - 1, 1);
      const expectedRent = assignmentsData.reduce((s, a) => {
        // If All Year (0), we can approximate by multiplying by 12, but realistically if they select All Year, expected is hard to track accurately without historical records.
        // For simplicity, if filterMonth is 0, we'll just multiply the current expected by 12 as a rough estimate for the whole year.
        const rent = Number(getEffectiveRentAsOf(a, filterPeriodDate));
        const gR = Number(a.gst_rate ?? 18);
        const tR = Number(a.tds_rate ?? 10);
        const monthlyRent = rent + Math.round(rent * gR / 100) - Math.round(rent * tR / 100);
        return s + (currentMonth === 0 ? monthlyRent * 12 : monthlyRent);
      }, 0);

      // Expected Maintenance
      let maintQuery = supabase
        .from('maintenance_bills')
        .select('total_amount, property_id')
        .eq('billing_year', currentYear);
      if (currentMonth > 0) maintQuery = maintQuery.eq('billing_month', currentMonth);
      if (filterPropertyId) maintQuery = maintQuery.eq('property_id', filterPropertyId);
      
      const { data: maintData } = await maintQuery;
      const expectedMaint = (maintData || []).reduce((s, b) => s + Number(b.total_amount), 0);

      // Collected Rent & Maintenance
      let pQuery = supabase
        .from('payments')
        .select('amount, payment_type, tenant_assignments!inner(property_id)')
        .eq('status', 'paid')
        .eq('period_year', currentYear);
      if (currentMonth > 0) pQuery = pQuery.eq('period_month', currentMonth);
      if (filterPropertyId) pQuery = pQuery.eq('tenant_assignments.property_id', filterPropertyId);

      const { data: pData } = await pQuery;
      let collectedRent = 0;
      let collectedMaint = 0;
      (pData || []).forEach((p: any) => {
        if (p.payment_type === 'rent') collectedRent += Number(p.amount);
        if (p.payment_type === 'maintenance') collectedMaint += Number(p.amount);
      });

      setRentKPIs({ expected: expectedRent, collected: collectedRent });
      setMaintKPIs({ expected: expectedMaint, collected: collectedMaint });
      
      // Status Edge Function
      const { data: statusData, error: statusErr } = await supabase.functions.invoke('payment-stats', {
        body: { action: 'payment-status', filterMonth: currentMonth, filterYear: currentYear },
      });
      if (!statusErr && statusData?.statusMap) {
        setPaymentStatusMap(statusData.statusMap);
      }
    } catch (err) {
      console.error('Assignments/KPI fetch error:', err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      let pQuery = supabase
        .from('payments')
        .select(`amount, payment_date, status, period_month, period_year, tenant_assignments(property_id, properties(name))`)
        .eq('status', 'paid')
        .order('payment_date', { ascending: true });


      if (filterPropertyId) {
        pQuery = pQuery.eq('tenant_assignments.property_id', filterPropertyId);
      }

      const { data: payments } = await pQuery;

      let csv = 'TYPE,DATE,AMOUNT,DETAILS\n';
      (payments || []).forEach((p: any) => {
        if (filterPropertyId && !p.tenant_assignments) return; // Ignore non-matching inner joins
        csv += `Revenue,${p.payment_date},${p.amount},"${p.tenant_assignments?.properties?.name || ''}"\n`;
      });
      
      csv += '\n--- TENANT LEASE REPORT ---\n';
      csv += 'TENANT,PHONE,PROPERTY,UNIT,START DATE,END DATE,RENT,GST (%),TDS (%),DEPOSIT,BALANCE AMOUNT,PAYMENT STATUS\n';
      assignments.forEach(a => {
        const statusInfo = paymentStatusMap[a.id];
        const badgeText = statusInfo?.status === 'paid' ? 'Paid' : statusInfo?.isOverdue ? 'Overdue' : statusInfo?.status === 'partial' ? 'Partial' : 'Pending';
        const balanceAmount = statusInfo?.balance > 0 ? statusInfo.balance : 0;
        const gst = a.gst_rate ?? 18;
        const tds = a.tds_rate ?? 10;
        csv += `"${a.tenants?.full_name || ''}","${a.tenants?.phone || ''}","${a.properties?.name || ''}","${a.unit_number}",${a.lease_start},${a.lease_end || 'Ongoing'},${a.current_rent},${gst},${tds},${a.security_deposit || 0},${balanceAmount},${badgeText}\n`;
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

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '8px' }}>
        {/* Rent Row */}
        <div className="surface-card glass-card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(59,130,246,0) 100%)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <p style={{ fontSize: '0.8rem', color: '#3b82f6', margin: '0 0 6px 0', fontWeight: 600 }}>Rent Expected ({filterMonth > 0 ? MONTHS[filterMonth - 1] : 'All Year'})</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {fmtRupee(rentKPIs.expected)}
          </p>
        </div>
        <div className="surface-card glass-card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(16,185,129,0) 100%)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <p style={{ fontSize: '0.8rem', color: '#10b981', margin: '0 0 6px 0', fontWeight: 600 }}>Rent Collected</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {fmtRupee(rentKPIs.collected)}
          </p>
        </div>
        <div className="surface-card glass-card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(239,68,68,0.05) 0%, rgba(239,68,68,0) 100%)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p style={{ fontSize: '0.8rem', color: '#ef4444', margin: '0 0 6px 0', fontWeight: 600 }}>Rent Outstanding</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {fmtRupee(Math.max(0, rentKPIs.expected - rentKPIs.collected))}
          </p>
        </div>
        
        {/* Maintenance Row */}
        <div className="surface-card glass-card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(245,158,11,0.05) 0%, rgba(245,158,11,0) 100%)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <p style={{ fontSize: '0.8rem', color: '#f59e0b', margin: '0 0 6px 0', fontWeight: 600 }}>Maintenance Expected ({filterMonth > 0 ? MONTHS[filterMonth - 1] : 'All Year'})</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {fmtRupee(maintKPIs.expected)}
          </p>
        </div>
        <div className="surface-card glass-card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(16,185,129,0) 100%)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <p style={{ fontSize: '0.8rem', color: '#10b981', margin: '0 0 6px 0', fontWeight: 600 }}>Maintenance Collected</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {fmtRupee(maintKPIs.collected)}
          </p>
        </div>
        <div className="surface-card glass-card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(239,68,68,0.05) 0%, rgba(239,68,68,0) 100%)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p style={{ fontSize: '0.8rem', color: '#ef4444', margin: '0 0 6px 0', fontWeight: 600 }}>Maintenance Outstanding</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {fmtRupee(Math.max(0, maintKPIs.expected - maintKPIs.collected))}
          </p>
        </div>
      </div>

      {/* Toolbar (Search + Filters + Actions) */}
      <div className="search-filter-row">
        <div style={{ display: 'flex', gap: '16px', flex: 1, alignItems: 'center' }}>
          <div className="search-input-container" style={{ flex: 1 }}>
            <Search size={18} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ width: '250px' }}>
            <CustomSelect
              value={filterPropertyId}
              onChange={setFilterPropertyId}
              options={[
                { value: '', label: 'All Properties' },
                ...properties.map(p => ({ value: p.id, label: p.name }))
              ]}
              placeholder="All Properties"
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <CustomSelect
              value={String(filterMonth)}
              onChange={(val) => setFilterMonth(parseInt(val))}
              options={[
                { value: '0', label: 'All Year' },
                ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))
              ]}
              width="120px"
              height="48px"
            />
            <input 
              type="number" 
              value={filterYear} 
              onChange={e => setFilterYear(parseInt(e.target.value))} 
              style={{ padding: '0 12px', height: '48px', borderRadius: '2px', background: 'var(--bg-surface)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', width: '80px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }} 
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
              borderRadius: '2px',
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
        <RevenueChart filterPropertyId={filterPropertyId} filterYear={filterYear} filterMonth={filterMonth} />
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
                <th>GST / TDS</th>
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
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{a.current_rent.toLocaleString('en-IN')}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>GST: {a.gst_rate ?? 18}%</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>TDS: {a.tds_rate ?? 10}%</div>
                      </td>
                      <td>
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
