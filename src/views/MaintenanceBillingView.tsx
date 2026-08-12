import React, { useState, useEffect } from 'react';
import './views.css';
import { supabase } from '../lib/supabase';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Modal, ModalInput, ModalActionButtons } from '../components/ui/Modal';
import { CheckCircle, Clock, Plus, Search } from 'lucide-react';

interface Property {
  id: string;
  name: string;
  total_units: number;
}

interface TenantAssignment {
  id: string;
  unit_number: string;
  tenants: { id: string; full_name: string } | null;
  properties: { id: string; name: string } | null;
  property_id: string;
}

interface MaintenanceBill {
  id: string;
  property_id: string;
  total_amount: number;
  billing_month: number;
  billing_year: number;
  description: string;
  split_type: 'equal' | 'custom';
  created_at: string;
  properties?: { name: string };
}

interface PaymentDetails {
  id: string;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
}

interface MaintenanceCharge {
  id: string;
  bill_id: string;
  assignment_id: string;
  amount: number;
  status: 'unpaid' | 'paid';
  created_at: string;
  payment_id?: string;
  maintenance_bills?: MaintenanceBill;
  tenant_assignments?: TenantAssignment;
  payments?: PaymentDetails;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const MaintenanceBillingView: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [assignments, setAssignments] = useState<TenantAssignment[]>([]);
  const [charges, setCharges] = useState<MaintenanceCharge[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  // Dashboard Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterPropertyId, setFilterPropertyId] = useState('');

  // Generate Bill State (Modal)
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [billingMonth, setBillingMonth] = useState<number>(new Date().getMonth() + 1);
  const [billingYear, setBillingYear] = useState<number>(new Date().getFullYear());
  const [description, setDescription] = useState<string>('');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // Payment Modal State
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState<MaintenanceCharge | null>(null);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [propRes, assignRes, chargesRes] = await Promise.all([
        supabase.from('properties').select('id, name, total_units').order('name'),
        supabase.from('tenant_assignments')
          .select('id, unit_number, property_id, tenants(id, full_name), properties(id, name)')
          .eq('status', 'active'),
        supabase.from('maintenance_charges')
          .select('*, maintenance_bills(*, properties(name)), tenant_assignments(id, unit_number, property_id, tenants(id, full_name), properties(id, name)), payments(id, payment_date, payment_method, reference_number)')
          .order('created_at', { ascending: false })
      ]);

      if (propRes.data) setProperties(propRes.data);

      const mappedAssignments = (assignRes.data || []).map((a: any) => ({
        ...a,
        property_id: a.properties?.id
      }));
      setAssignments(mappedAssignments);

      if (chargesRes.data) setCharges(chargesRes.data as MaintenanceCharge[]);
    } catch (err) {
      console.error('Error fetching maintenance data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- KPI Calculations ---
  const periodCharges = charges.filter(c =>
    c.maintenance_bills?.billing_month === filterMonth &&
    c.maintenance_bills?.billing_year === filterYear &&
    (!filterPropertyId || c.tenant_assignments?.property_id === filterPropertyId)
  );

  const totalExpected = periodCharges.reduce((acc, c) => acc + Number(c.amount), 0);
  const totalCollected = periodCharges.filter(c => c.status === 'paid').reduce((acc, c) => acc + Number(c.amount), 0);
  const outstanding = Math.max(0, totalExpected - totalCollected);
  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  // --- Filter Ledger ---
  const filteredCharges = periodCharges.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.tenant_assignments?.tenants?.full_name?.toLowerCase().includes(q) ||
      c.tenant_assignments?.unit_number?.toLowerCase().includes(q) ||
      c.maintenance_bills?.properties?.name?.toLowerCase().includes(q)
    );
  });

  // --- Generate Bill Logic ---
  const activeAssignmentsForProperty = assignments.filter(a => a.property_id === selectedPropertyId);
  const equalAmount = activeAssignmentsForProperty.length > 0 && totalAmount
    ? (Number(totalAmount) / activeAssignmentsForProperty.length).toFixed(2)
    : '0.00';

  const sumCustomAmounts = Object.values(customAmounts).reduce((acc, val) => acc + (Number(val) || 0), 0);
  const isCustomValid = totalAmount && Math.abs(sumCustomAmounts - Number(totalAmount)) < 0.01;

  const handleCustomAmountChange = (assignmentId: string, value: string) => {
    setCustomAmounts(prev => ({ ...prev, [assignmentId]: value }));
  };

  const handleGenerateBill = async () => {
    if (!selectedPropertyId) return alert('Select a property');
    if (!totalAmount || Number(totalAmount) <= 0) return alert('Enter a valid total amount');
    if (activeAssignmentsForProperty.length === 0) return alert('No active tenants found in this property');

    if (splitType === 'custom' && !isCustomValid) {
      return alert(`Custom amounts sum (${sumCustomAmounts}) must equal Total Amount (${totalAmount})`);
    }

    setIsSubmitting(true);
    try {
      const { data: user } = await supabase.auth.getUser();

      const { data: bill, error: billErr } = await supabase.from('maintenance_bills').insert({
        property_id: selectedPropertyId,
        total_amount: Number(totalAmount),
        billing_month: billingMonth,
        billing_year: billingYear,
        description,
        split_type: splitType,
        created_by: user.user?.id
      }).select().single();

      if (billErr) throw billErr;

      const chargesData = activeAssignmentsForProperty.map(a => {
        const amount = splitType === 'equal'
          ? Number(equalAmount)
          : Number(customAmounts[a.id] || 0);

        return {
          bill_id: bill.id,
          assignment_id: a.id,
          amount,
          status: 'unpaid'
        };
      });

      const { error: chargesErr } = await supabase.from('maintenance_charges').insert(chargesData);
      if (chargesErr) throw chargesErr;

      // Reset and close
      setTotalAmount('');
      setDescription('');
      setCustomAmounts({});
      setGenerateModalOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to generate maintenance bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCharge) return;

    setIsSubmitting(true);
    try {
      // 1. Insert into payments table and return the new ID
      const { data: paymentRecord, error: paymentErr } = await supabase.from('payments').insert({
        assignment_id: selectedCharge.assignment_id,
        amount: selectedCharge.amount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        period_month: selectedCharge.maintenance_bills?.billing_month,
        period_year: selectedCharge.maintenance_bills?.billing_year,
        reference_number: referenceNumber || null,
        status: 'paid',
        payment_type: 'maintenance',
        notes: `Maintenance Payment for Bill #${selectedCharge.bill_id.substring(0, 8)}`
      }).select().single();

      if (paymentErr) throw paymentErr;

      // 2. Update charge status AND link the payment_id
      const { error: chargeErr } = await supabase.from('maintenance_charges')
        .update({
          status: 'paid',
          payment_id: paymentRecord.id
        })
        .eq('id', selectedCharge.id);

      if (chargeErr) throw chargeErr;

      setPayModalOpen(false);
      setSelectedCharge(null);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="view-container">
      {/* <div className="view-header">
        <div className="view-title-group">
          <h2>Maintenance Billing</h2>
          <p>Generate and track maintenance invoices for your properties</p>
        </div>
      </div> */}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', width: '100%', marginBottom: '24px' }}>
        <div className="surface-card glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500 }}>Expected</span>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0f766e' }}>
            ₹{totalExpected.toLocaleString('en-IN')}
          </h2>
        </div>

        <div className="surface-card glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '1px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
          <span style={{ color: '#4b5563', fontSize: '0.95rem', fontWeight: 500 }}>Collected</span>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0f766e' }}>
            ₹{totalCollected.toLocaleString('en-IN')}
          </h2>
        </div>

        <div className="surface-card glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500 }}>Outstanding</span>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0f766e' }}>
            ₹{outstanding.toLocaleString('en-IN')}
          </h2>
        </div>

        <div className="surface-card glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '1px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
          <span style={{ color: '#4b5563', fontSize: '0.95rem', fontWeight: 500 }}>Collection Rate</span>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0f766e' }}>
            {collectionRate}%
          </h2>
        </div>
      </div>

      {/* Toolbar */}
      <div className="search-filter-row">
        <div style={{ display: 'flex', gap: '16px', flex: 1, alignItems: 'center' }}>
          <div className="search-input-container" style={{ flex: 1 }}>
            <Search size={18} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Search tenant or property..."
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
              options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
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
            onClick={() => setGenerateModalOpen(true)}
            className="btn-primary"
            style={{ display: 'flex', gap: '8px', alignItems: 'center', borderRadius: '2px', padding: '0 16px', height: '48px', fontWeight: 600 }}
          >
            <Plus size={16} /> Generate Bills
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="surface-card glass-card" style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Tenant / Unit</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Property</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Amount</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Paid Details</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading invoices...</td></tr>
              ) : filteredCharges.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No maintenance invoices found for this period.
                  </td>
                </tr>
              ) : filteredCharges.map((charge) => (
                <tr key={charge.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 500 }}>{charge.tenant_assignments?.tenants?.full_name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Unit {charge.tenant_assignments?.unit_number}</div>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                    {charge.maintenance_bills?.properties?.name}
                  </td>
                  <td style={{ padding: '16px', fontWeight: 600 }}>
                    ₹{charge.amount.toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {charge.status === 'paid' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '1px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '0.8rem', fontWeight: 500 }}>
                        <CheckCircle size={14} /> Paid
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '1px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontSize: '0.8rem', fontWeight: 500 }}>
                        <Clock size={14} /> Unpaid
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {charge.status === 'paid' && charge.payments ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span>{new Date(charge.payments.payment_date).toLocaleDateString('en-GB')}</span>
                        <span style={{ opacity: 0.8 }}>{charge.payments.payment_method} {charge.payments.reference_number ? `(${charge.payments.reference_number})` : ''}</span>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    {charge.status === 'unpaid' && (
                      <button
                        onClick={() => { setSelectedCharge(charge); setPayModalOpen(true); }}
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                      >
                        Record Payment
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Bills Modal */}
      <Modal isOpen={generateModalOpen} onClose={() => !isSubmitting && setGenerateModalOpen(false)} title="Create Maintenance Bill">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px', position: 'relative', zIndex: 50 }}>
          <div style={{ position: 'relative', zIndex: 100 }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Property</label>
            <CustomSelect
              value={selectedPropertyId}
              onChange={setSelectedPropertyId}
              options={[
                { value: '', label: 'Select Property' },
                ...properties.map(p => ({ value: p.id, label: p.name }))
              ]}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Total Maintenance Amount (₹)</label>
            <input
              type="number"
              className="input-field"
              value={totalAmount}
              onChange={e => setTotalAmount(e.target.value)}
              placeholder="e.g. 4000"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '2px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)' }}
            />
          </div>

          <div style={{ position: 'relative', zIndex: 90 }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Billing Month</label>
            <CustomSelect
              value={String(billingMonth)}
              onChange={v => setBillingMonth(Number(v))}
              options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Billing Year</label>
            <input
              type="number"
              className="input-field"
              value={billingYear}
              onChange={e => setBillingYear(Number(e.target.value))}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '2px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '24px', position: 'relative', zIndex: 10 }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Description / Notes (Optional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Lift repair, common area cleaning, etc."
            style={{ width: '100%', padding: '10px 14px', borderRadius: '2px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', minHeight: '80px', resize: 'vertical' }}
          />
        </div>

        {selectedPropertyId && activeAssignmentsForProperty.length > 0 && (
          <div style={{ marginBottom: '32px', background: 'var(--bg-main)', padding: '20px', borderRadius: '1px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="splitType"
                  checked={splitType === 'equal'}
                  onChange={() => setSplitType('equal')}
                  style={{ accentColor: 'var(--accent-primary)' }}
                />
                <span>Divide Equally ({activeAssignmentsForProperty.length} Units)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="splitType"
                  checked={splitType === 'custom'}
                  onChange={() => setSplitType('custom')}
                  style={{ accentColor: 'var(--accent-primary)' }}
                />
                <span>Custom Assignment</span>
              </label>
            </div>

            {splitType === 'equal' ? (
              <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '2px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckCircle size={20} />
                <span>Each of the {activeAssignmentsForProperty.length} tenants will be charged <strong>₹{equalAmount}</strong></span>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  <span>Assign amounts to individual units</span>
                  <span style={{ color: isCustomValid ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                    Sum: ₹{sumCustomAmounts} / ₹{totalAmount || 0}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
                  {activeAssignmentsForProperty.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '200px' }}>
                        <div style={{ fontWeight: 500 }}>{a.tenants?.full_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Unit {a.unit_number}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <input
                          type="number"
                          value={customAmounts[a.id] || ''}
                          onChange={e => handleCustomAmountChange(a.id, e.target.value)}
                          placeholder="Amount (₹)"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '2px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {selectedPropertyId && activeAssignmentsForProperty.length === 0 && (
          <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '2px', color: '#ef4444' }}>
            No active tenants found for this property. You cannot generate a bill.
          </div>
        )}

        <ModalActionButtons
          onCancel={() => setGenerateModalOpen(false)}
          submitText={isSubmitting ? "Generating..." : `Generate ${activeAssignmentsForProperty.length > 0 ? activeAssignmentsForProperty.length : ''} Invoices`}
          isSubmitting={isSubmitting}
          customSubmitAction={handleGenerateBill}
        />
      </Modal>

      {/* Record Payment Modal */}
      <Modal isOpen={payModalOpen} onClose={() => !isSubmitting && setPayModalOpen(false)} title="Record Maintenance Payment">
        {selectedCharge && (
          <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '16px', background: 'var(--bg-main)', borderRadius: '2px', border: '1px solid var(--border-color)', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Tenant</span>
                <span style={{ fontWeight: 500 }}>{selectedCharge.tenant_assignments?.tenants?.full_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Property</span>
                <span style={{ fontWeight: 500 }}>{selectedCharge.maintenance_bills?.properties?.name} (Unit {selectedCharge.tenant_assignments?.unit_number})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Billing Period</span>
                <span style={{ fontWeight: 500 }}>{MONTHS[(selectedCharge.maintenance_bills?.billing_month || 1) - 1]} {selectedCharge.maintenance_bills?.billing_year}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--border-color)' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Amount Due</span>
                <span style={{ fontWeight: 700, color: '#0f766e', fontSize: '1.2rem' }}>₹{selectedCharge.amount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <ModalInput
              label="Payment Date *"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Payment Method *</label>
              <CustomSelect
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={[
                  { value: 'UPI', label: 'UPI' },
                  { value: 'Bank Transfer', label: 'Bank Transfer' },
                  { value: 'Cash', label: 'Cash' },
                  { value: 'Cheque', label: 'Cheque' }
                ]}
              />
            </div>

            <ModalInput
              label="Reference Number (Optional)"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. UTR or Cheque Number"
            />

            <ModalActionButtons
              onCancel={() => setPayModalOpen(false)}
              submitText={isSubmitting ? "Recording..." : "Record Payment"}
              isSubmitting={isSubmitting}
            />
          </form>
        )}
      </Modal>

    </div>
  );
};
