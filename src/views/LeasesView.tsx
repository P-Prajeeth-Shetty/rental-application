import React, { useState, useEffect, useRef } from 'react';
import './views.css';
import { Upload, Plus, X, FileSpreadsheet, Check, AlertTriangle, Download, Search, History } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import { CustomSelect } from '../components/ui/CustomSelect';
import { 
  LiquidGlassOverlay, 
  LiquidGlassWindow, 
  LiquidGlassContent, 
  LiquidGlassInput 
} from '../components/ui/LiquidGlassModal';
import { TenantHistoryDrawer } from '../components/ui/TenantHistoryDrawer';
import { timingBadge } from '../lib/paymentUtils';
import type { PaymentTiming } from '../lib/paymentUtils';

interface AssignmentWithTenant {
  id: string;
  unit_number: string;
  current_rent: number;
  tenant_id: string;
  status: string;
  payment_mode: 'prepaid' | 'postpaid' | 'advance_on_entry';
  due_day: number;
  grace_days: number;
  lease_start: string;
  tenants: { id: string; full_name: string; phone: string | null; email: string | null } | null;
  properties: { id: string; name: string } | null;
}

interface Payment {
  id: string;
  assignment_id: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  period_month: number;
  period_year: number;
  reference_number: string | null;
  status: string;
  payment_type: string;
  payment_timing: PaymentTiming;
  days_late: number;
  credit_amount: number;
  expected_amount: number | null;
  is_reversed: boolean;
  notes: string | null;
  created_at: string;
}

interface ExcelRow {
  tenant_name: string;
  property: string;
  unit: string;
  amount: number;
  payment_date: string;
  method: string;
  reference: string;
  month: number;
  year: number;
  payment_type: string;
  months_covered: number;
  matched_assignment_id?: string;
  matched_assignment?: AssignmentWithTenant;
  error?: string;
}

type Toast = { id: number; type: 'success' | 'error'; message: string };

export const LeasesView: React.FC = () => {
  const [assignments, setAssignments] = useState<AssignmentWithTenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Server-computed payment status per assignment
  const [paymentStatusMap, setPaymentStatusMap] = useState<Record<string, { paidAmount: number; balance: number; isOverdue: boolean; fullyPaid: boolean; status: string }>>({});

  // Filters
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  // Record Payment modal
  const [payModal, setPayModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payForm, setPayForm] = useState({ assignment_id: '', amount: '', payment_date: '', payment_method: 'UPI', reference_number: '', notes: '', payment_type: 'rent' });

  // Excel upload
  const [excelModal, setExcelModal] = useState(false);
  const [excelRows, setExcelRows] = useState<ExcelRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Tenant history drawer
  const [historyTarget, setHistoryTarget] = useState<AssignmentWithTenant | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [{ data: aData, error: aErr }, { data: pData, error: pErr }] = await Promise.all([
        supabase.from('tenant_assignments').select('id, unit_number, current_rent, tenant_id, status, payment_mode, due_day, grace_days, lease_start, tenants(id, full_name, phone, email), properties(id, name)').eq('status', 'active'),
        supabase.from('payments').select('*').eq('period_month', filterMonth).eq('period_year', filterYear).order('payment_date', { ascending: false }),
      ]);
      if (aErr) throw aErr;
      if (pErr) throw pErr;
      setAssignments((aData as any) || []);
      setPayments(pData || []);

      // Fetch payment status from edge function (overdue detection on server)
      const { data: statusData, error: statusErr } = await supabase.functions.invoke('payment-stats', {
        body: { action: 'payment-status', filterMonth, filterYear },
      });
      if (!statusErr && statusData?.statusMap) {
        setPaymentStatusMap(statusData.statusMap);
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [filterMonth, filterYear]);

  // ── Record Payment ────────────────────────────────────────────────────────

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const assignment = assignments.find(a => a.id === payForm.assignment_id);
      const amount = parseFloat(payForm.amount);
      const periodMonth = parseInt(payForm.period_month);
      const periodYear = parseInt(payForm.period_year);
      const payload = [{
        assignment_id: payForm.assignment_id,
        amount: payForm.amount,
        payment_date: payForm.payment_date,
        payment_method: payForm.payment_method || null,
        payment_type: payForm.payment_type || 'rent'
      }];

      const { data, error } = await supabase.functions.invoke('process-payments', {
        body: { payments: payload }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPayModal(false);
      showToast('success', 'Payment recorded!');

      fetchAll();
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Excel Upload ──────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(sheet);

      // Map Excel rows and try to match tenants
      const rows: ExcelRow[] = json.map((row: any) => {
        const tenantName = String(row['Tenant Name'] || row['tenant_name'] || row['Name'] || '').trim();
        const property = String(row['Property'] || row['property'] || '').trim();
        const unit = String(row['Unit'] || row['unit'] || '').trim();
        const amount = parseFloat(row['Amount'] || row['amount'] || 0);
        const paymentDate = row['Payment Date'] || row['payment_date'] || row['Date'] || '';
        const method = String(row['Method'] || row['payment_method'] || row['Payment Method'] || 'UPI');
        const reference = String(row['Reference'] || row['reference_number'] || row['Reference No'] || '');
        const month = parseInt(row['Month'] || row['month'] || filterMonth);
        const year = parseInt(row['Year'] || row['year'] || filterYear);
        const paymentType = String(row['Payment Type'] || row['payment_type'] || 'rent').toLowerCase().replace(' ', '_');
        const monthsCovered = Math.max(1, parseInt(row['Months Covered'] || row['months_covered'] || '1') || 1);

        // Match by tenant name + property + unit (handles duplicate names)
        let match: AssignmentWithTenant | undefined;
        if (property && unit) {
          match = assignments.find(a => 
            a.tenants?.full_name.toLowerCase() === tenantName.toLowerCase() &&
            a.properties?.name.toLowerCase() === property.toLowerCase() &&
            a.unit_number.toLowerCase() === unit.toLowerCase()
          );
        }
        if (!match && property) {
          match = assignments.find(a => 
            a.tenants?.full_name.toLowerCase() === tenantName.toLowerCase() &&
            a.properties?.name.toLowerCase() === property.toLowerCase()
          );
        }
        if (!match) {
          match = assignments.find(a => a.tenants?.full_name.toLowerCase() === tenantName.toLowerCase());
        }

        const parsed: ExcelRow = { tenant_name: tenantName, property, unit, amount, payment_date: formatExcelDate(paymentDate), method, reference, month, year, payment_type: paymentType, months_covered: monthsCovered };

        if (!tenantName) parsed.error = 'Missing tenant name';
        else if (!match) parsed.error = 'Tenant not found';
        else if (!amount || amount <= 0) parsed.error = 'Invalid amount';
        else { parsed.matched_assignment_id = match.id; parsed.matched_assignment = match; }

        return parsed;
      });

      setExcelRows(rows);
      setExcelModal(true);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const formatExcelDate = (val: any): string => {
    if (!val) return new Date().toISOString().split('T')[0];
    if (typeof val === 'number') {
      // Excel serial date
      const date = new Date((val - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    try { return new Date(val).toISOString().split('T')[0]; } catch { return new Date().toISOString().split('T')[0]; }
  };

  const handleBulkUpload = async () => {
    const valid = excelRows.filter(r => r.matched_assignment_id && !r.error);
    if (valid.length === 0) { showToast('error', 'No valid rows to upload.'); return; }

    setUploading(true);
    try {
      // Create upload batch record
      const user = (await supabase.auth.getUser()).data.user;
      const { data: batch, error: batchErr } = await supabase.from('payment_uploads').insert([{
        file_name: 'excel_upload.xlsx',
        uploaded_by: user?.id || null,
        record_count: excelRows.length,
        success_count: valid.length,
        error_count: excelRows.length - valid.length,
        status: 'completed',
        error_details: excelRows.filter(r => r.error).length > 0 ? excelRows.filter(r => r.error).map(r => ({ tenant: r.tenant_name, error: r.error })) : null,
      }]).select().single();
      if (batchErr) throw batchErr;

      // Bulk insert payments using the backend edge function
      const payload = valid.map(r => ({
        assignment_id: r.matched_assignment_id!,
        amount: r.amount,
        payment_date: r.payment_date,
        payment_method: r.method || null,
        reference_number: r.reference || null,
        payment_type: r.payment_type || 'rent'
      }));

      const { data, error: insertErr } = await supabase.functions.invoke('process-payments', {
        body: { payments: payload, upload_batch_id: batch.id }
      });

      if (insertErr) throw insertErr;
      if (data?.error) throw new Error(data.error);

      setExcelModal(false);
      setExcelRows([]);
      const totalRecords = excelRows.filter(r => !r.error).reduce((s, r) => s + (r.months_covered || 1), 0);
      showToast('success', `${totalRecords} payment records uploaded successfully!`);
      fetchAll();
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = assignments.length > 0 
      ? assignments.map(a => ({
          'Tenant Name': a.tenants?.full_name || '',
          'Email': a.tenants?.email || '',
          'Phone': a.tenants?.phone || '',
          'Property': a.properties?.name || '',
          'Unit': a.unit_number || '',
          'Amount': a.current_rent,
          'Payment Date': new Date().toISOString().split('T')[0],
          'Method': 'UPI',
          'Reference': '',
          'Payment Type': 'rent'
        }))
      : [{ 'Tenant Name': 'Example Tenant', 'Email': 'example@email.com', 'Phone': '9876543210', 'Property': 'Example Property', 'Unit': '101', 'Amount': 25000, 'Payment Date': new Date().toISOString().split('T')[0], 'Method': 'UPI', 'Reference': 'TXN12345', 'Payment Type': 'rent' }];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `payment_template_${monthNames[filterMonth - 1]}_${filterYear}.xlsx`);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Get ALL payments for an assignment in the current period
  const getPaymentsForAssignment = (assignId: string) => payments.filter(p => p.assignment_id === assignId);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const totalExpected = assignments.reduce((s, a) => s + Number(a.current_rent), 0);
  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  // Get status from edge function (server-computed overdue/balance)
  const getStatus = (assignId: string) => paymentStatusMap[assignId] || {
    paidAmount: 0, balance: Number(assignments.find(a => a.id === assignId)?.current_rent || 0),
    isOverdue: false, fullyPaid: false, status: 'pending'
  };

  const filteredAssignments = assignments.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.tenants?.full_name?.toLowerCase().includes(q) ||
      a.properties?.name?.toLowerCase().includes(q) ||
      a.unit_number?.toLowerCase().includes(q)
    );
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="view-container">
      {/* Toasts */}
      <div style={{ position: 'fixed', top: '80px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px', borderRadius: '10px', minWidth: '260px',
            background: t.type === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
            color: 'white', fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', animation: 'slideIn 0.3s ease' }}>
            {t.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}{t.message}
          </div>
        ))}
      </div>
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); }}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 className="view-title" style={{ margin: 0 }}>Payments</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Month/Year filter */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <CustomSelect
              value={String(filterMonth)}
              onChange={(val) => setFilterMonth(parseInt(val))}
              options={monthNames.map((m, i) => ({ value: String(i + 1), label: m }))}
              width="110px"
            />
            <input type="number" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} style={{ padding: '0 12px', height: '42px', borderRadius: '8px', background: 'var(--bg-surface)', border: '2px solid var(--input-border)', color: 'var(--text-primary)', width: '80px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <button onClick={handleDownloadTemplate} className="btn-secondary" style={{ display: 'flex', gap: '6px', alignItems: 'center', borderRadius: '20px', padding: '8px 16px', border: 'none', background: 'transparent', color: 'var(--text-secondary)' }}>
            <Download size={16} /> Template
          </button>
          <input type="file" ref={fileRef} onChange={handleFileSelect} accept=".xlsx,.xls,.csv" style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} className="btn-secondary" style={{ display: 'flex', gap: '6px', alignItems: 'center', borderRadius: '20px', padding: '8px 16px' }}>
            <Upload size={16} /> Upload Excel
          </button>
          <button onClick={() => { setPayForm({ ...payForm, assignment_id: assignments[0]?.id || '', amount: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'UPI', reference_number: '', notes: '', payment_type: 'rent' }); setPayModal(true); }} className="btn btn-primary" style={{ display: 'flex', gap: '6px', alignItems: 'center', borderRadius: '20px' }}>
            <Plus size={16} /> Record Payment
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="surface-card glass-card" style={{ flex: 1, minWidth: '160px', padding: '18px 20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '4px' }}>Expected</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700 }}>₹{totalExpected.toLocaleString('en-IN')}</p>
        </div>
        <div className="surface-card glass-card" style={{ flex: 1, minWidth: '160px', padding: '18px 20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '4px' }}>Collected</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>₹{totalCollected.toLocaleString('en-IN')}</p>
        </div>
        <div className="surface-card glass-card" style={{ flex: 1, minWidth: '160px', padding: '18px 20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '4px' }}>Outstanding</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: totalExpected - totalCollected > 0 ? '#ef4444' : '#10b981' }}>₹{Math.max(0, totalExpected - totalCollected).toLocaleString('en-IN')}</p>
        </div>
        <div className="surface-card glass-card" style={{ flex: 1, minWidth: '160px', padding: '18px 20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '4px' }}>Collection Rate</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700 }}>{collectionRate}%</p>
        </div>
      </div>

      {/* Payments Table */}
      <div className="surface-card glass-card static-card" style={{ padding: 0, overflow: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{monthNames[filterMonth - 1]} {filterYear} — Payment Status</h3>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', borderRadius: '8px', padding: '6px 12px', border: '1px solid var(--border-color)' }}>
            <Search size={14} style={{ color: 'var(--text-secondary)', marginRight: '8px' }} />
            <input 
              type="text" 
              placeholder="Search tenant or unit..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: '0.9rem', width: '200px' }}
            />
          </div>
        </div>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Tenant</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Property / Unit</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Expected</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Paid / Balance</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Timing</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Date & Method</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map(a => {
                const assignPays = getPaymentsForAssignment(a.id);
                const expected = Number(a.current_rent);
                const latestPay = assignPays.length > 0 ? assignPays[0] : null; // sorted desc by payment_date
                const badge = latestPay ? timingBadge(latestPay.payment_timing, latestPay.days_late) : null;
                // Use server-computed status
                const st = getStatus(a.id);
                const { paidAmount, balance, isOverdue: overdue, fullyPaid } = st;
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s', background: overdue ? 'rgba(239,68,68,0.03)' : 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = overdue ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = overdue ? 'rgba(239,68,68,0.03)' : 'transparent')}>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{a.tenants?.full_name || '—'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{a.properties?.name} — {a.unit_number}</td>
                    <td style={{ padding: '12px 16px' }}>₹{expected.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: paidAmount > 0 ? '#10b981' : 'var(--text-secondary)' }}>
                          {paidAmount > 0 ? `₹${paidAmount.toLocaleString('en-IN')}` : '₹0'}
                        </div>
                        {balance > 0 && (
                          <div style={{ fontSize: '0.78rem', marginTop: '2px', color: '#ef4444', fontWeight: 600 }}>
                            Bal: ₹{balance.toLocaleString('en-IN')}
                          </div>
                        )}
                        {balance < 0 && (
                          <div style={{ fontSize: '0.78rem', marginTop: '2px', color: '#10b981', fontWeight: 500 }}>
                            +₹{Math.abs(balance).toLocaleString('en-IN')} credit
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {overdue ? (
                        <span style={{ display: 'inline-block', minWidth: '75px', textAlign: 'center', fontSize: '0.78rem', padding: '3px 9px', borderRadius: '20px', fontWeight: 600, background: 'rgba(239,68,68,0.12)', color: '#ef4444', whiteSpace: 'nowrap', animation: 'overdueBlink 2s ease-in-out infinite' }}>
                          Overdue
                        </span>
                      ) : badge ? (
                        <span style={{ display: 'inline-block', minWidth: '75px', textAlign: 'center', fontSize: '0.78rem', padding: '3px 9px', borderRadius: '20px', fontWeight: 500, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>
                          {badge.label}
                        </span>
                      ) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {latestPay ? (
                        <div>
                          <div>{new Date(latestPay.payment_date).toLocaleDateString('en-IN')}</div>
                          {latestPay.payment_method && <div style={{ marginTop: '2px', opacity: 0.7 }}>{latestPay.payment_method}</div>}
                        </div>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block', minWidth: '75px', textAlign: 'center',
                        padding: '3px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500,
                        backgroundColor: fullyPaid ? 'rgba(16,185,129,0.15)' : overdue ? 'rgba(239,68,68,0.15)' : paidAmount > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                        color: fullyPaid ? '#10b981' : overdue ? '#ef4444' : paidAmount > 0 ? '#f59e0b' : '#ef4444'
                      }}>
                        {fullyPaid ? 'Paid' : overdue ? 'Overdue' : paidAmount > 0 ? 'Partial' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          onClick={() => setHistoryTarget(a)}
                          title="View payment history"
                          style={{ padding: '6px', borderRadius: '6px', background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <History size={14} />
                        </button>
                          <button
                            onClick={() => {
                              setPayForm({ ...payForm, assignment_id: a.id, amount: String(Math.max(0, balance)), payment_date: new Date().toISOString().split('T')[0], payment_method: 'UPI', reference_number: '', notes: '', payment_type: 'rent' });
                              setPayModal(true);
                            }}
                            style={{ padding: '6px 10px', fontSize: '0.78rem', borderRadius: '6px', background: overdue ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)', color: overdue ? '#ef4444' : '#3b82f6', border: 'none', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}
                          >
                            + Record
                          </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredAssignments.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No tenant assignments found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Tenant History Drawer */}
      {historyTarget && (
        <TenantHistoryDrawer
          assignmentId={historyTarget.id}
          tenantName={historyTarget.tenants?.full_name || 'Tenant'}
          propertyName={historyTarget.properties?.name || ''}
          unitNumber={historyTarget.unit_number}
          currentRent={historyTarget.current_rent}
          backendBalance={getStatus(historyTarget.id).balance}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      {/* ══ Record Payment Modal ══════════════════════════════════════════ */}
      {payModal && (
        <LiquidGlassOverlay onClose={() => !isSubmitting && setPayModal(false)}>
          <LiquidGlassWindow>
            <div className="lg-modal-header">
              <h2 className="modal-title">Record Payment</h2>
              <button className="lg-close-btn" onClick={() => setPayModal(false)}><X size={20} /></button>
            </div>
            <LiquidGlassContent>
              <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div className="lg-input-group">
                  <label className="lg-input-label">Tenant *</label>
                  <div className="lg-input-wrapper">
                    <CustomSelect
                      value={payForm.assignment_id}
                      onChange={(val) => setPayForm({ ...payForm, assignment_id: val })}
                      placeholder="Select tenant..."
                      searchable={true}
                      options={assignments.map(a => ({
                        value: a.id,
                        label: `${a.tenants?.full_name} — ${a.properties?.name} ${a.unit_number} (₹${Number(a.current_rent).toLocaleString('en-IN')})`
                      }))}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <LiquidGlassInput 
                    type="number" 
                    label="Amount (₹) *" 
                    value={payForm.amount} 
                    onChange={e => setPayForm({ ...payForm, amount: e.target.value })} 
                    required 
                    min="0" 
                  />
                  <LiquidGlassInput 
                    type="date" 
                    label="Payment Date *" 
                    value={payForm.payment_date} 
                    onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })} 
                    required 
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="lg-input-group">
                    <label className="lg-input-label">Method</label>
                    <div className="lg-input-wrapper">
                      <CustomSelect
                        value={payForm.payment_method}
                        onChange={(val) => setPayForm({ ...payForm, payment_method: val })}
                        options={[
                          { value: 'UPI', label: 'UPI' },
                          { value: 'Cash', label: 'Cash' },
                          { value: 'Bank Transfer', label: 'Bank Transfer' },
                          { value: 'Cheque', label: 'Cheque' }
                        ]}
                      />
                    </div>
                  </div>
                  <LiquidGlassInput 
                    label="Reference No" 
                    value={payForm.reference_number} 
                    onChange={e => setPayForm({ ...payForm, reference_number: e.target.value })} 
                    placeholder="TXN12345" 
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="lg-input-group">
                    <label className="lg-input-label">Payment Type</label>
                    <div className="lg-input-wrapper">
                      <CustomSelect
                        value={payForm.payment_type}
                        onChange={(val) => setPayForm({ ...payForm, payment_type: val })}
                        options={[
                          { value: 'rent', label: 'Rent' },
                          { value: 'security_deposit', label: 'Security Deposit' },
                          { value: 'advance', label: 'Advance' },
                          { value: 'penalty', label: 'Penalty' },
                          { value: 'adjustment', label: 'Adjustment' }
                        ]}
                        menuPlacement="top"
                      />
                    </div>
                  </div>
                </div>
                <div className="lg-actions" style={{ marginTop: '16px' }}>
                  <button type="button" className="lg-btn lg-btn-secondary" onClick={() => setPayModal(false)}>Cancel</button>
                  <button type="submit" className="lg-btn lg-btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Recording...' : 'Record Payment'}</button>
                </div>
              </form>
            </LiquidGlassContent>
          </LiquidGlassWindow>
        </LiquidGlassOverlay>
      )}

      {/* ══ Excel Preview Modal ═══════════════════════════════════════════ */}
      {excelModal && (
        <LiquidGlassOverlay onClose={() => !uploading && setExcelModal(false)}>
          <LiquidGlassWindow style={{ maxWidth: '720px' }}>
            <div className="lg-modal-header">
              <h2 className="modal-title"><FileSpreadsheet size={20} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />Excel Upload Preview</h2>
              <button className="lg-close-btn" onClick={() => setExcelModal(false)} disabled={uploading}><X size={20} /></button>
            </div>
            <LiquidGlassContent>
              <div style={{ marginBottom: '12px', display: 'flex', gap: '16px', fontSize: '0.88rem' }}>
                <span>Total: <strong>{excelRows.length}</strong></span>
                <span style={{ color: '#10b981' }}>Valid: <strong>{excelRows.filter(r => !r.error).length}</strong></span>
                <span style={{ color: '#ef4444' }}>Errors: <strong>{excelRows.filter(r => r.error).length}</strong></span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>Tenant</th>
                    <th style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>Amount</th>
                    <th style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>Date</th>
                    <th style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>Month/Year</th>
                    <th style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {excelRows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', backgroundColor: r.error ? 'rgba(239,68,68,0.05)' : 'rgba(16,185,129,0.03)' }}>
                      <td style={{ padding: '8px 10px' }}>{r.tenant_name}</td>
                      <td style={{ padding: '8px 10px' }}>₹{r.amount?.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '8px 10px' }}>{r.payment_date}</td>
                      <td style={{ padding: '8px 10px' }}>{monthNames[(r.month || 1) - 1]} {r.year}</td>
                      <td style={{ padding: '8px 10px' }}>
                        {r.error ? (
                          <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> {r.error}</span>
                        ) : (
                          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={12} /> Matched</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="lg-actions" style={{ marginTop: '16px' }}>
                <button className="lg-btn lg-btn-secondary" onClick={() => setExcelModal(false)} disabled={uploading}>Cancel</button>
                <button className="lg-btn lg-btn-primary" onClick={handleBulkUpload} disabled={uploading || excelRows.filter(r => !r.error).length === 0}>
                  {uploading ? 'Uploading...' : `Upload ${excelRows.filter(r => !r.error).length} Payments`}
                </button>
              </div>
            </LiquidGlassContent>
          </LiquidGlassWindow>
        </LiquidGlassOverlay>
      )}
    </div>
  );
};
