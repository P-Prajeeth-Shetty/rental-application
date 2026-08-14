import React, { useState, useEffect, useRef } from 'react';
import './views.css';
import { Upload, Plus, Search, History, Download, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Modal, ModalInput, ModalActionButtons } from '../components/ui/Modal';

import { TenantHistoryDrawer } from '../components/ui/TenantHistoryDrawer';
import { timingBadge, rentBadge } from '../lib/paymentUtils';
import { uploadPaymentReceipt } from '../lib/storageUtils';
import type { PaymentTiming } from '../lib/paymentUtils';

interface AssignmentWithTenant {
  id: string;
  unit_number: string;
  current_rent: number;
  security_deposit: number;
  tenant_id: string;
  status: string;
  payment_mode: 'prepaid' | 'postpaid' | 'advance_on_entry';
  due_day: number;
  grace_days: number;
  lease_start: string;
  gst_rate: number;
  tds_rate: number;
  tenants: { id: string; full_name: string; phone: string | null; email: string | null } | null;
  properties: { id: string; name: string } | null;
  rent_revisions?: { previous_rent: number; new_rent: number; increase_pct: number | null; effective_from: string }[];
}

function getEffectiveRentAsOf(assignment: AssignmentWithTenant, date: Date = new Date()) {
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
  notes?: string;
}

type Toast = { id: number; type: 'success' | 'error'; message: string };

export const LeasesView: React.FC = () => {
  const [assignments, setAssignments] = useState<AssignmentWithTenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Server-computed payment status per assignment
  const [paymentStatusMap, setPaymentStatusMap] = useState<Record<string, { paidAmount: number; balance: number; isOverdue: boolean; fullyPaid: boolean; status: string; totalDepositPaid?: number }>>({});

  // Filters
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterPropertyId, setFilterPropertyId] = useState('');

  // Record Payment modal
  const [payModal, setPayModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payForm, setPayForm] = useState({ assignment_id: '', amount: '', payment_date: '', payment_method: 'UPI', reference_number: '', notes: '', payment_type: 'rent' });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

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
        supabase.from('tenant_assignments').select('id, unit_number, current_rent, security_deposit, tenant_id, status, payment_mode, due_day, grace_days, lease_start, gst_rate, tds_rate, tenants(id, full_name, phone, email), properties(id, name), rent_revisions(previous_rent, new_rent, increase_pct, effective_from)').eq('status', 'active'),
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
      let receipt_url = null;
      if (receiptFile) {
        receipt_url = await uploadPaymentReceipt(receiptFile);
      }

      const payload = [{
        assignment_id: payForm.assignment_id,
        amount: payForm.amount,
        payment_date: payForm.payment_date,
        payment_method: payForm.payment_method || null,
        payment_type: payForm.payment_type || 'rent',
        reference_number: payForm.reference_number || null,
        notes: payForm.notes || null,
        receipt_url: receipt_url
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
        const amount = parseFloat(row['Paid Amount'] || row['paid_amount'] || row['Amount'] || row['amount'] || 0);
        const paymentDate = row['Payment Date'] || row['payment_date'] || row['Date'] || '';
        const method = String(row['Method'] || row['payment_method'] || row['Payment Method'] || 'UPI');
        const reference = String(row['Reference'] || row['reference_number'] || row['Reference No'] || '');
        const month = parseInt(row['Month'] || row['month'] || filterMonth);
        const year = parseInt(row['Year'] || row['year'] || filterYear);
        const paymentType = String(row['Payment Type'] || row['payment_type'] || 'rent').toLowerCase().replace(' ', '_');
        const monthsCovered = Math.max(1, parseInt(row['Months Covered'] || row['months_covered'] || '1') || 1);
        const notes = String(row['Notes'] || row['notes'] || '');

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

        const parsed: ExcelRow = { tenant_name: tenantName, property, unit, amount, payment_date: formatExcelDate(paymentDate), method, reference, month, year, payment_type: paymentType, months_covered: monthsCovered, notes };

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
        payment_type: r.payment_type || 'rent',
        notes: r.notes || null
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
      ? assignments.map(a => {
          const rent = getEffectiveRentAsOf(a, new Date(filterYear, filterMonth - 1, 1));
          const gR = Number(a.gst_rate ?? 18);
          const tR = Number(a.tds_rate ?? 10);
          const gstAmt = Math.round(rent * gR / 100);
          const tdsAmt = Math.round(rent * tR / 100);
          const net = rent + gstAmt - tdsAmt;
          return {
            'Tenant Name': a.tenants?.full_name || '',
            'Email': a.tenants?.email || '',
            'Phone': a.tenants?.phone || '',
            'Property': a.properties?.name || '',
            'Unit': a.unit_number || '',
            'Rent': rent,
            'GST Rate (%)': gR,
            'TDS Rate (%)': tR,
            'GST Amount': gstAmt,
            'TDS Amount': tdsAmt,
            'Net Amount': net,
            'Paid Amount': net,
            'Bal Amount': getStatus(a.id).balance,
            'Payment Date': new Date().toISOString().split('T')[0],
            'Method': 'UPI',
            'Reference': '',
            'Notes': '',
            'Payment Type': 'rent'
          };
        })
      : [{ 'Tenant Name': 'Example Tenant', 'Email': 'example@email.com', 'Phone': '9876543210', 'Property': 'Example Property', 'Unit': '101', 'Rent': 25000, 'GST Rate (%)': 18, 'TDS Rate (%)': 10, 'GST Amount': 4500, 'TDS Amount': 2500, 'Net Amount': 27000, 'Paid Amount': 27000, 'Bal Amount': 0, 'Payment Date': new Date().toISOString().split('T')[0], 'Method': 'UPI', 'Reference': 'TXN12345', 'Notes': '', 'Payment Type': 'rent' }];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `payment_template_${monthNames[filterMonth - 1]}_${filterYear}.xlsx`);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Get ALL payments for an assignment in the current period
  const getPaymentsForAssignment = (assignId: string) => payments.filter(p => p.assignment_id === assignId);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const filteredAssignments = assignments.filter(a => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || (
      a.tenants?.full_name?.toLowerCase().includes(q) ||
      a.properties?.name?.toLowerCase().includes(q) ||
      a.unit_number?.toLowerCase().includes(q)
    );
    const matchesProperty = !filterPropertyId || a.properties?.id === filterPropertyId;
    return matchesSearch && matchesProperty;
  });

  const uniqueProperties = Array.from(new Map(assignments.map(a => [a.properties?.id, a.properties])).values()).filter(Boolean) as {id: string, name: string}[];

  // Calculate expected rent using the effective rent as of today, or the specific filter month. 
  // We'll use the 1st of the filter month to evaluate rent for that period.
  const filterPeriodDate = new Date(filterYear, filterMonth - 1, 1);
  const totalExpected = filteredAssignments.reduce((s, a) => {
    const rent = Number(getEffectiveRentAsOf(a, filterPeriodDate));
    const gR = Number(a.gst_rate ?? 18);
    const tR = Number(a.tds_rate ?? 10);
    return s + rent + Math.round(rent * gR / 100) - Math.round(rent * tR / 100);
  }, 0);
  
  const totalCollected = payments.filter(p => {
    // Only count rent-ledger payments (not deposits/adjustments/etc.) for assignments matching the filter
    if (p.payment_type && p.payment_type !== 'rent' && p.payment_type !== 'historical_settlement') return false;
    const assign = assignments.find(a => a.id === p.assignment_id);
    return !filterPropertyId || assign?.properties?.id === filterPropertyId;
  }).reduce((s, p) => s + Number(p.amount), 0);
  
  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  // Get status from edge function (server-computed overdue/balance)
  const getStatus = (assignId: string) => paymentStatusMap[assignId] || {
    paidAmount: 0, balance: Number(assignments.find(a => a.id === assignId)?.current_rent || 0),
    isOverdue: false, fullyPaid: false, status: 'pending'
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toasts */}
      <div style={{ position: 'fixed', top: '80px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px', borderRadius: '2px', minWidth: '260px',
            background: t.type === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
            color: 'white', fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', animation: 'slideIn 0.3s ease' }}>
            {t.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}{t.message}
          </div>
        ))}
      </div>
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); }}`}</style>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', width: '100%' }}>
        <div className="surface-card glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '1px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
          <span style={{ color: '#4b5563', fontSize: '0.95rem', fontWeight: 500 }}>Expected</span>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0f766e' }}>₹{totalExpected.toLocaleString('en-IN')}</h2>
        </div>
        
        <div className="surface-card glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '1px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
          <span style={{ color: '#4b5563', fontSize: '0.95rem', fontWeight: 500 }}>Collected</span>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0f766e' }}>₹{totalCollected.toLocaleString('en-IN')}</h2>
        </div>
        
        <div className="surface-card glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '1px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
          <span style={{ color: '#4b5563', fontSize: '0.95rem', fontWeight: 500 }}>Outstanding</span>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0f766e' }}>₹{Math.max(0, totalExpected - totalCollected).toLocaleString('en-IN')}</h2>
        </div>
        
        <div className="surface-card glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '1px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
          <span style={{ color: '#4b5563', fontSize: '0.95rem', fontWeight: 500 }}>Collection Rate</span>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0f766e' }}>{collectionRate}%</h2>
        </div>
      </div>

      {/* Toolbar (Search + Filters + Actions) */}
      <div className="search-filter-row">
        <div style={{ display: 'flex', gap: '16px', flex: 1, alignItems: 'center' }}>
          <div className="search-input-container" style={{ flex: 1 }}>
            <Search size={18} color="var(--text-secondary)" />
            <input 
              type="text" 
              placeholder="Search tenant or unit..." 
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
                ...uniqueProperties.map(p => ({ value: p.id, label: p.name }))
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
              options={monthNames.map((m, i) => ({ value: String(i + 1), label: m }))}
              width="120px"
              height="48px"
            />
            <input type="number" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} style={{ padding: '0 12px', height: '48px', borderRadius: '2px', background: '#ffffff', border: '1.5px solid #e2e8f0', color: '#111827', width: '80px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', fontWeight: 600 }} />
          </div>
          <button onClick={handleDownloadTemplate} className="btn-secondary" style={{ display: 'flex', gap: '8px', alignItems: 'center', borderRadius: '2px', padding: '0 16px', border: '1.5px solid #e2e8f0', background: '#ffffff', color: '#111827', height: '48px', fontWeight: 500, cursor: 'pointer' }}>
            <Download size={16} color="#0f766e" /> Template
          </button>
          <input type="file" ref={fileRef} onChange={handleFileSelect} accept=".xlsx,.xls,.csv" style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} className="btn-secondary" style={{ display: 'flex', gap: '8px', alignItems: 'center', borderRadius: '2px', padding: '0 16px', border: '1.5px solid #e2e8f0', background: '#ffffff', color: '#111827', height: '48px', fontWeight: 500, cursor: 'pointer' }}>
            <Upload size={16} color="#0f766e" /> Upload Excel
          </button>
          <button onClick={() => { 
            const defaultAssign = assignments[0];
            const defaultAmount = defaultAssign ? getEffectiveRentAsOf(defaultAssign).toString() : '';
            setPayForm({ ...payForm, assignment_id: defaultAssign?.id || '', amount: defaultAmount, payment_date: new Date().toISOString().split('T')[0], payment_method: 'UPI', reference_number: '', notes: '', payment_type: 'rent' }); 
            setPayModal(true); 
          }} className="btn btn-primary" style={{ display: 'flex', gap: '8px', alignItems: 'center', borderRadius: '2px', padding: '0 20px', height: '48px', fontWeight: 600, background: '#0f766e', color: '#ffffff', border: 'none', cursor: 'pointer' }}>
            <Plus size={16} /> Record Payment
          </button>
        </div>
      </div>

      {/* Payments Table */}
      <div className="surface-card glass-card static-card" style={{ padding: 0, overflow: 'auto', width: '100%' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{monthNames[filterMonth - 1]} {filterYear} — Payment Status</h3>
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
                // Expected rent for the filter period (e.g. this month's rent amount)
                const filterPeriodDate = new Date(filterYear, filterMonth - 1, 1);
                const expected = Number(getEffectiveRentAsOf(a, filterPeriodDate));
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
                    <td style={{ padding: '12px 16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          ₹{expected.toLocaleString('en-IN')}
                          {(() => {
                            const badge = rentBadge(a.rent_revisions, filterPeriodDate);
                            return (
                              <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '2px', fontWeight: 600, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>
                                {badge.label}
                              </span>
                            );
                          })()}
                        </div>
                        {(() => {
                          const gstRate = Number(a.gst_rate ?? 18);
                          const tdsRate = Number(a.tds_rate ?? 10);
                          if (gstRate === 0 && tdsRate === 0) return null;
                          const gstAmt = Math.round(expected * gstRate / 100);
                          const tdsAmt = Math.round(expected * tdsRate / 100);
                          const net = expected + gstAmt - tdsAmt;
                          return (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              <span style={{ color: '#f59e0b' }}>+GST ₹{gstAmt.toLocaleString('en-IN')}</span>
                              {' '}
                              <span style={{ color: '#ef4444' }}>−TDS ₹{tdsAmt.toLocaleString('en-IN')}</span>
                              {' = '}
                              <span style={{ fontWeight: 600, color: '#10b981' }}>Net ₹{net.toLocaleString('en-IN')}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </td>
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
                        <span style={{ display: 'inline-block', minWidth: '75px', textAlign: 'center', fontSize: '0.78rem', padding: '3px 9px', borderRadius: '1px', fontWeight: 600, background: 'rgba(239,68,68,0.12)', color: '#ef4444', whiteSpace: 'nowrap', animation: 'overdueBlink 2s ease-in-out infinite' }}>
                          Overdue
                        </span>
                      ) : badge ? (
                        <span style={{ display: 'inline-block', minWidth: '75px', textAlign: 'center', fontSize: '0.78rem', padding: '3px 9px', borderRadius: '1px', fontWeight: 500, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>
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
                        padding: '3px 10px', borderRadius: '1px', fontSize: '0.8rem', fontWeight: 500,
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
                          style={{ padding: '6px', borderRadius: '2px', background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <History size={14} />
                        </button>
                          <button
                            onClick={() => {
                              setPayForm({ ...payForm, assignment_id: a.id, amount: String(Math.max(0, balance)), payment_date: new Date().toISOString().split('T')[0], payment_method: 'UPI', reference_number: '', notes: '', payment_type: 'rent' });
                              setPayModal(true);
                            }}
                            style={{ padding: '6px 10px', fontSize: '0.78rem', borderRadius: '2px', background: overdue ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)', color: overdue ? '#ef4444' : '#3b82f6', border: 'none', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}
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
          currentRent={getEffectiveRentAsOf(historyTarget)}
          backendBalance={getStatus(historyTarget.id).balance}
          gstRate={Number(historyTarget.gst_rate ?? 18)}
          tdsRate={Number(historyTarget.tds_rate ?? 10)}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      {/* ══ Record Payment Modal ══════════════════════════════════════════ */}
      <Modal isOpen={payModal} onClose={() => !isSubmitting && setPayModal(false)} title="Record Payment">
        <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tenant (Active)</label>
              <div style={{ position: 'relative' }}>
                <CustomSelect
                  value={payForm.assignment_id}
                  onChange={(val) => {
                    const assignment = assignments.find(a => a.id === val);
                    let defaultAmount = payForm.amount;
                    if (assignment) {
                      if (payForm.payment_type === 'rent') {
                        defaultAmount = getEffectiveRentAsOf(assignment).toString();
                      } else if (payForm.payment_type === 'security_deposit') {
                        const totalDepositPaid = paymentStatusMap[assignment.id]?.totalDepositPaid || 0;
                        const depositLeft = Math.max(0, (assignment.security_deposit || 0) - totalDepositPaid);
                        defaultAmount = depositLeft.toString();
                      } else if (payForm.payment_type === 'historical_settlement') {
                        defaultAmount = Math.max(0, paymentStatusMap[assignment.id]?.balance || 0).toString();
                      }
                    }
                    setPayForm({ ...payForm, assignment_id: val, amount: defaultAmount });
                  }}
                  placeholder="Select tenant..."
                  searchable={true}
                  options={assignments.map(a => ({
                    value: a.id,
                    label: `${a.tenants?.full_name} — ${a.properties?.name} ${a.unit_number} (₹${Number(getEffectiveRentAsOf(a)).toLocaleString('en-IN')})`
                  }))}
                />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <ModalInput 
                type="number" 
                label="Amount (₹) *" 
                value={payForm.amount} 
                onChange={e => setPayForm({ ...payForm, amount: e.target.value })} 
                required 
                min="0"
                step="0.01"
              />
            </div>
            <div style={{ flex: 1 }}>
              <ModalInput 
                type="date"
                label="Payment Date *" 
                value={payForm.payment_date} 
                onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })} 
                required 
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Method</label>
              <div style={{ position: 'relative' }}>
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
            <div style={{ flex: 1 }}>
              <ModalInput 
                label="Reference No" 
                value={payForm.reference_number} 
                onChange={e => setPayForm({ ...payForm, reference_number: e.target.value })} 
                placeholder="TXN12345" 
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Type</label>
              <div style={{ position: 'relative' }}>
                <CustomSelect
                  value={payForm.payment_type}
                  onChange={(val) => {
                    const assignment = assignments.find(a => a.id === payForm.assignment_id);
                    let defaultAmount = payForm.amount;
                    if (assignment) {
                      if (val === 'rent') {
                        defaultAmount = getEffectiveRentAsOf(assignment).toString();
                      } else if (val === 'security_deposit') {
                        const totalDepositPaid = paymentStatusMap[assignment.id]?.totalDepositPaid || 0;
                        const depositLeft = Math.max(0, (assignment.security_deposit || 0) - totalDepositPaid);
                        defaultAmount = depositLeft.toString();
                      } else if (val === 'historical_settlement') {
                        defaultAmount = Math.max(0, paymentStatusMap[assignment.id]?.balance || 0).toString();
                      } else if (val === 'adjustment') {
                        defaultAmount = '';
                      }
                    }
                    setPayForm({ ...payForm, payment_type: val, amount: defaultAmount });
                  }}
                  options={[
                    { value: 'rent', label: 'Rent' },
                    { value: 'security_deposit', label: 'Security Deposit' },
                    { value: 'historical_settlement', label: 'Historical Offline Payment' },
                    { value: 'adjustment', label: 'Adjustment' }
                  ]}
                  menuPlacement="top"
                />
              </div>
              {payForm.payment_type === 'historical_settlement' && (
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Clears pre-app rent owed for this tenant in one bulk entry, bringing their outstanding balance to ₹0 so tracking starts clean from today.
                </p>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <ModalInput
                type="text"
                label="Notes (Optional)"
                value={payForm.notes} 
                onChange={e => setPayForm({ ...payForm, notes: e.target.value })} 
                placeholder="Enter notes..." 
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attachment (Optional)</label>
            <input 
              type="file" 
              accept="image/*,.pdf" 
              onChange={e => setReceiptFile(e.target.files?.[0] || null)}
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <ModalActionButtons 
            onCancel={() => setPayModal(false)} 
            submitText="Record Payment"
            isSubmitting={isSubmitting} 
          />
        </form>
      </Modal>

      {/* ══ Excel Preview Modal ═══════════════════════════════════════════ */}
      <Modal isOpen={excelModal} onClose={() => !uploading && setExcelModal(false)} title="Excel Upload Preview" maxWidth="720px">
        <div style={{ marginBottom: '12px', display: 'flex', gap: '16px', fontSize: '0.88rem' }}>
          <span>Total: <strong>{excelRows.length}</strong></span>
          <span style={{ color: '#10b981' }}>Valid: <strong>{excelRows.filter(r => !r.error).length}</strong></span>
          <span style={{ color: '#ef4444' }}>Errors: <strong>{excelRows.filter(r => r.error).length}</strong></span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
              <th style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>Tenant</th>
              <th style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>Amount</th>
              <th style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>Date</th>
              <th style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>Month/Year</th>
              <th style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {excelRows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: r.error ? 'rgba(239,68,68,0.05)' : 'rgba(16,185,129,0.03)' }}>
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
        <ModalActionButtons 
          onCancel={() => setExcelModal(false)} 
          submitText={`Upload ${excelRows.filter(r => !r.error).length} Payments`}
          isSubmitting={uploading} 
          customSubmitAction={excelRows.filter(r => !r.error).length === 0 ? undefined : handleBulkUpload}
        />
      </Modal>
    </>
  );
};
