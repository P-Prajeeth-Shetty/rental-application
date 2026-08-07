import React, { useState, useEffect } from 'react';
import './views.css';
import { Search, Plus, X, Pencil, Trash2, Home, ChevronDown, ChevronUp, TrendingUp, List, MoreVertical, Users, FileText, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CustomSelect } from '../components/ui/CustomSelect';
import { TenantHistoryDrawer } from '../components/ui/TenantHistoryDrawer';
import { LiquidGlassDatePicker } from '../components/ui/LiquidGlassDatePicker';
import { 
  LiquidGlassOverlay, 
  LiquidGlassWindow, 
  LiquidGlassContent, 
  LiquidGlassInput, 
  LiquidGlassTextarea 
} from '../components/ui/LiquidGlassModal';
interface Tenant {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  id_proof_type: string | null;
  id_proof_number: string | null;
  emergency_contact: string | null;
  notes: string | null;
  created_at: string;
}

interface Assignment {
  id: string;
  unit_number: string;
  current_rent: number;
  lease_start: string;
  lease_end: string | null;
  security_deposit: number;
  status: string;
  property_id: string;
  payment_mode?: string;
  due_day?: number;
  grace_days?: number;
  properties: { id: string; name: string } | null;
  payments?: { amount: number; is_reversed: boolean }[];
  rent_revisions?: { previous_rent: number; new_rent: number; effective_from: string }[];
}

function getEffectiveRentAsOf(assignment: Assignment, date: Date = new Date()) {
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

interface Property {
  id: string;
  name: string;
  total_units: number;
}

interface RentRevision {
  id: string;
  previous_rent: number;
  new_rent: number;
  increase_pct: number;
  effective_from: string;
  reason: string | null;
  created_at: string;
}



export const TenantsView: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [assignmentsMap, setAssignmentsMap] = useState<Record<string, Assignment[]>>({});
  const [properties, setProperties] = useState<Property[]>([]);
  const [paymentLedgerTarget, setPaymentLedgerTarget] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');


  // Tenant modals
  const [tenantModal, setTenantModal] = useState<'create' | 'edit' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenantForm, setTenantForm] = useState({ id: '', full_name: '', email: '', phone: '', id_proof_type: '', id_proof_number: '', emergency_contact: '', notes: '' });
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);

  // Assign modal
  const [assignModal, setAssignModal] = useState<Tenant | null>(null);
  const [assignForm, setAssignForm] = useState({ property_id: '', unit_number: '', current_rent: '', lease_start: '', lease_end: '', security_deposit: '', payment_mode: 'prepaid', due_day: '1', grace_days: '5' });
  const [editAssignmentId, setEditAssignmentId] = useState<string | null>(null);

  // Expanded rows
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);

  // Rent increase modal
  const [rentModal, setRentModal] = useState<Assignment | null>(null);
  const [rentForm, setRentForm] = useState({ increase_pct: '', effective_from: '', reason: '' });

  // Rent revision history
  const [revisionTarget, setRevisionTarget] = useState<Assignment | null>(null);
  const [revisions, setRevisions] = useState<RentRevision[]>([]);

  // Vacate property
  const [vacateTarget, setVacateTarget] = useState<Assignment | null>(null);
  const [vacateDate, setVacateDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Action Menu
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    const handleClick = () => setActionMenuOpen(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [{ data: tData, error: tErr }, { data: aData, error: aErr }, { data: pData, error: pErr }] = await Promise.all([
        supabase.from('tenants').select('*').order('created_at', { ascending: false }),
        supabase.from('tenant_assignments').select('*, properties(id, name), payments(amount, is_reversed), rent_revisions(previous_rent, new_rent, effective_from)').order('created_at', { ascending: false }),
        supabase.from('properties').select('id, name, total_units'),
      ]);
      if (tErr) throw tErr;
      if (aErr) throw aErr;
      if (pErr) throw pErr;

      setTenants(tData || []);
      setProperties(pData || []);

      const map: Record<string, Assignment[]> = {};
      (aData || []).forEach((a: any) => {
        if (!map[a.tenant_id]) map[a.tenant_id] = [];
        map[a.tenant_id].push(a);
      });
      setAssignmentsMap(map);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Tenant CRUD ───────────────────────────────────────────────────────────

  const openCreateTenant = () => {
    setTenantForm({ id: '', full_name: '', email: '', phone: '', id_proof_type: '', id_proof_number: '', emergency_contact: '', notes: '' });
    setTenantModal('create');
  };

  const openEditTenant = (t: Tenant) => {
    setTenantForm({
      id: t.id, full_name: t.full_name, email: t.email || '', phone: t.phone || '',
      id_proof_type: t.id_proof_type || '', id_proof_number: t.id_proof_number || '',
      emergency_contact: t.emergency_contact || '', notes: t.notes || ''
    });
    setTenantModal('edit');
  };

  const handleTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        full_name: tenantForm.full_name,
        email: tenantForm.email || null, phone: tenantForm.phone || null,
        id_proof_type: tenantForm.id_proof_type || null, id_proof_number: tenantForm.id_proof_number || null,
        emergency_contact: tenantForm.emergency_contact || null, notes: tenantForm.notes || null,
      };
      if (tenantModal === 'create') {
        const { error } = await supabase.from('tenants').insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tenants').update(payload).eq('id', tenantForm.id);
        if (error) throw error;
      }
      setTenantModal(null);
      fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (!deleteTarget) return;
    
    const hasAssignments = assignmentsMap[deleteTarget.id]?.length > 0;
    if (hasAssignments) {
      setError("Cannot delete a tenant who has assignment history. Please use the 'Vacate' feature on their property assignment instead to preserve payment data.");
      setDeleteTarget(null);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('tenants').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Assign to Property ────────────────────────────────────────────────────

  const openAssignModal = (t: Tenant) => {
    setAssignModal(t);
    setEditAssignmentId(null);
    setAssignForm({ property_id: properties[0]?.id || '', unit_number: '', current_rent: '', lease_start: '', lease_end: '', security_deposit: '', payment_mode: 'prepaid', due_day: '1', grace_days: '5' });
  };

  const openEditAssignModal = (a: Assignment, t: Tenant) => {
    setAssignModal(t);
    setEditAssignmentId(a.id);
    setAssignForm({ 
      property_id: a.properties?.id || properties[0]?.id || '', 
      unit_number: a.unit_number || '', 
      current_rent: a.current_rent.toString(), 
      lease_start: new Date(a.lease_start).toISOString().split('T')[0], 
      lease_end: a.lease_end ? new Date(a.lease_end).toISOString().split('T')[0] : '', 
      security_deposit: a.security_deposit.toString(), 
      payment_mode: a.payment_mode || 'prepaid', 
      due_day: a.due_day?.toString() || '1', 
      grace_days: a.grace_days?.toString() || '5' 
    });
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModal) return;
    
    if (!assignForm.lease_start) {
      setError("Please select a Lease Start date.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const payload = {
        property_id: assignForm.property_id,
        unit_number: assignForm.unit_number,
        current_rent: parseFloat(assignForm.current_rent) || 0,
        lease_start: assignForm.lease_start,
        lease_end: assignForm.lease_end || null,
        security_deposit: parseFloat(assignForm.security_deposit) || 0,
        payment_mode: assignForm.payment_mode,
        due_day: parseInt(assignForm.due_day) || 1,
        grace_days: parseInt(assignForm.grace_days) || 5
      };

      if (editAssignmentId) {
        const { error } = await supabase.from('tenant_assignments').update(payload).eq('id', editAssignmentId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tenant_assignments').insert([{ ...payload, tenant_id: assignModal.id, status: 'active' }]);
        if (error) throw error;
      }
      
      setAssignModal(null);
      fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Rent Increase ─────────────────────────────────────────────────────────

  const openRentModal = (a: Assignment) => {
    setRentModal(a);
    setRentForm({ increase_pct: '', effective_from: '', reason: '' });
  };

  const handleRentIncrease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rentModal) return;
    setIsSubmitting(true);
    try {
      const pct = parseFloat(rentForm.increase_pct);
      const newRent = Math.round(rentModal.current_rent * (1 + pct / 100) * 100) / 100;

      // Insert revision
      const { error: revErr } = await supabase.from('rent_revisions').insert([{
        assignment_id: rentModal.id,
        previous_rent: rentModal.current_rent,
        new_rent: newRent,
        increase_pct: pct,
        effective_from: rentForm.effective_from,
        reason: rentForm.reason || null,
        created_by: (await supabase.auth.getUser()).data.user?.id || null,
      }]);
      if (revErr) throw revErr;

      // Update current rent on the assignment
      const { error: updErr } = await supabase.from('tenant_assignments').update({ current_rent: newRent }).eq('id', rentModal.id);
      if (updErr) throw updErr;

      setRentModal(null);
      fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Vacate Assignment ─────────────────────────────────────────────────────

  const handleVacate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacateTarget || !vacateDate) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('tenant_assignments').update({
        status: 'vacated',
        lease_end: vacateDate
      }).eq('id', vacateTarget.id);
      if (error) throw error;
      setVacateTarget(null);
      fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Rent Revision History ─────────────────────────────────────────────────

  const openRevisionHistory = async (a: Assignment) => {
    setRevisionTarget(a);
    const { data } = await supabase.from('rent_revisions').select('*').eq('assignment_id', a.id).order('effective_from', { ascending: false });
    setRevisions(data || []);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const filteredTenants = tenants.filter(t =>
    t.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.email && t.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (t.phone && t.phone.includes(searchTerm))
  );

  const totalTenants = tenants.length;
  let activeLeases = 0;
  let totalMonthlyRent = 0;
  
  tenants.forEach(t => {
    const assigns = assignmentsMap[t.id] || [];
    const active = assigns.find(a => a.status === 'active');
    if (active) {
      activeLeases++;
      totalMonthlyRent += getEffectiveRentAsOf(active);
    }
  });

  const vacatedOrNew = totalTenants - activeLeases;

  const computedNewRent = rentModal ? Math.round(rentModal.current_rent * (1 + (parseFloat(rentForm.increase_pct) || 0) / 100) * 100) / 100 : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {error && <div style={{ backgroundColor: 'rgba(255,0,0,0.1)', color: '#ff4d4d', padding: '10px 14px', borderRadius: '8px' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', width: '100%' }}>
        <div className="surface-card glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
              <Users size={20} />
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Total Tenants</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.8rem' }}>{totalTenants}</h2>
        </div>
        
        <div className="surface-card glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
              <FileText size={20} />
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Active Leases</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.8rem' }}>{activeLeases}</h2>
        </div>
        
        <div className="surface-card glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(236,72,153,0.1)', color: '#ec4899' }}>
              <Wallet size={20} />
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Monthly Rent Roll</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.8rem' }}>₹{totalMonthlyRent.toLocaleString('en-IN')}</h2>
        </div>
        
        <div className="surface-card glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
              <Home size={20} />
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Unassigned / Vacated</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.8rem' }}>{vacatedOrNew}</h2>
        </div>
      </div>

      <div className="search-filter-row">
        <div className="search-input-container">
          <Search size={18} color="var(--text-secondary)" />
          <input type="text" placeholder="Search tenants..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={openCreateTenant} style={{ display: 'flex', gap: '8px', alignItems: 'center', borderRadius: '8px', padding: '0 20px', fontWeight: 600, height: '48px', flexShrink: 0 }}>
          <Plus size={18} /> Add Tenant
        </button>
      </div>

      {/* ── Table ── */}
      <div className="surface-card glass-card static-card" style={{ padding: 0, overflow: 'auto', width: '100%' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading tenants...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500, width: '4%' }}></th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500, width: '22%' }}>Tenant</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500, width: '16%' }}>Phone</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500, width: '20%' }}>Property</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500, width: '10%' }}>Unit</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500, width: '12%' }}>Rent</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500, width: '8%' }}>Status</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500, width: '8%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.map(t => {
                const assigns = assignmentsMap[t.id] || [];
                const activeAssign = assigns.find(a => a.status === 'active');
                const isExpanded = expandedTenant === t.id;
                return (
                  <React.Fragment key={t.id}>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: assigns.length > 0 ? 'pointer' : undefined }} onClick={() => assigns.length > 0 && setExpandedTenant(isExpanded ? null : t.id)}>
                      <td style={{ padding: '14px 8px 14px 16px' }}>
                        {assigns.length > 0 && (isExpanded ? <ChevronUp size={14} color="var(--text-secondary)" /> : <ChevronDown size={14} color="var(--text-secondary)" />)}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 500 }}>{t.full_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.email || ''}</div>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t.phone || '—'}</td>
                      <td style={{ padding: '14px 16px' }}>{activeAssign?.properties?.name || <span style={{ color: 'var(--text-secondary)' }}>Unassigned</span>}</td>
                      <td style={{ padding: '14px 16px' }}>{activeAssign?.unit_number || '—'}</td>
                      <td style={{ padding: '14px 16px', fontWeight: 500 }}>{activeAssign ? `₹${Number(getEffectiveRentAsOf(activeAssign)).toLocaleString('en-IN')}` : '—'}</td>
                      <td style={{ padding: '14px 16px' }}>
                        {activeAssign ? (
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500, backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }}>Active</span>
                        ) : assigns.length > 0 ? (
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500, backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Vacated</span>
                        ) : (
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500, backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>New</span>
                        )}
                      </td>
                      <td 
                        style={{ padding: '14px 16px', textAlign: 'right' }} 
                        onClick={e => e.stopPropagation()}
                        onPointerDown={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        onTouchStart={e => e.stopPropagation()}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                          }
                        }}
                      >
                        <div 
                          style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}
                          onClick={e => e.stopPropagation()}
                          onPointerDown={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}
                          onTouchStart={e => e.stopPropagation()}
                        >
                          <button onClick={(e) => { e.stopPropagation(); openAssignModal(t); }} title="Assign to Property" style={{ background: 'rgba(16,185,129,0.15)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#10b981', display: 'flex', alignItems: 'center' }}>
                            <Home size={14} style={{ pointerEvents: 'none' }} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openEditTenant(t); }} title="Edit" style={{ background: 'rgba(59,130,246,0.15)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center' }}>
                            <Pencil size={14} style={{ pointerEvents: 'none' }} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }} title="Delete" style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={14} style={{ pointerEvents: 'none' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded: all assignments + rent actions */}
                    {isExpanded && assigns.map(a => (
                      <tr key={a.id} style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td></td>
                        <td style={{ padding: '10px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {a.properties?.name} — Unit {a.unit_number}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {a.payment_mode ? <span style={{ textTransform: 'capitalize' }}>{a.payment_mode.replace(/_/g, ' ')}</span> : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: '0.85rem' }}>
                          {new Date(a.lease_start).toLocaleDateString()} — {a.lease_end ? new Date(a.lease_end).toLocaleDateString() : 'Ongoing'}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: '0.85rem' }}>
                          Deposit: ₹{Number(a.security_deposit).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '10px 16px', fontWeight: 500, fontSize: '0.85rem' }}>
                          <div>₹{Number(getEffectiveRentAsOf(a)).toLocaleString('en-IN')}</div>
                          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '2px' }}>
                            Paid: ₹{a.payments ? a.payments.filter(p => !p.is_reversed).reduce((s, p) => s + Number(p.amount), 0).toLocaleString('en-IN') : 0}
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 500,
                            backgroundColor: a.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            color: a.status === 'active' ? '#10b981' : '#ef4444' }}>
                            {a.status}
                          </span>
                        </td>
                        <td 
                          style={{ padding: '10px 16px', textAlign: 'right' }}
                          onClick={e => e.stopPropagation()}
                          onPointerDown={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}
                          onTouchStart={e => e.stopPropagation()}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                            }
                          }}
                        >
                          <div 
                            style={{ position: 'relative' }}
                            onClick={e => e.stopPropagation()}
                            onPointerDown={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            onTouchStart={e => e.stopPropagation()}
                          >
                            <button 
                              onClick={(e) => { e.stopPropagation(); setActionMenuOpen(actionMenuOpen === a.id ? null : a.id); }} 
                              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: 'var(--text-primary)' }}
                            >
                              <MoreVertical size={16} />
                            </button>
                            {actionMenuOpen === a.id && (
                              <div style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                marginTop: '4px',
                                background: 'rgba(255, 255, 255, 0.4)',
                                backdropFilter: 'blur(32px)',
                                WebkitBackdropFilter: 'blur(32px)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '10px',
                                padding: '6px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                zIndex: 100,
                                minWidth: '160px',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                              }}>
                                <button onClick={(e) => { e.stopPropagation(); setActionMenuOpen(null); openEditAssignModal(a, t); }} style={{ background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', width: '100%', textAlign: 'left', borderRadius: '6px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <Pencil size={14} color="#3b82f6" /> Edit
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setActionMenuOpen(null); openRentModal(a); }} style={{ background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', width: '100%', textAlign: 'left', borderRadius: '6px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <TrendingUp size={14} color="#f59e0b" /> Increase Rent
                                </button>
                                <button onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setActionMenuOpen(null);
                                  setPaymentLedgerTarget({
                                    assignmentId: a.id,
                                    tenantName: t.full_name,
                                    propertyName: a.properties?.name || 'Unknown Property',
                                    unitNumber: a.unit_number,
                                    currentRent: getEffectiveRentAsOf(a)
                                  });
                                }} style={{ background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', width: '100%', textAlign: 'left', borderRadius: '6px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <List size={14} color="#10b981" /> Payment Ledger
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setActionMenuOpen(null); openRevisionHistory(a); }} style={{ background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', width: '100%', textAlign: 'left', borderRadius: '6px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <TrendingUp size={14} color="#3b82f6" /> Rent History
                                </button>
                                {a.status === 'active' && (
                                  <button onClick={(e) => { e.stopPropagation(); setActionMenuOpen(null); setVacateTarget(a); setVacateDate(new Date().toISOString().split('T')[0]); }} style={{ background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', width: '100%', textAlign: 'left', borderRadius: '6px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <X size={14} /> Vacate
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              {filteredTenants.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>{searchTerm ? 'No tenants match your search.' : 'No tenants yet. Click "Add Tenant" to get started.'}</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ══ Modals ══════════════════════════════════════════════════════════ */}

      {/* Tenant Create/Edit Modal */}
      {tenantModal && (
        <LiquidGlassOverlay onClose={() => !isSubmitting && setTenantModal(null)}>
          <LiquidGlassWindow className="tenant-modal" style={{ maxHeight: '90vh' }}>
            <div className="lg-modal-header">
              <h2 className="modal-title">{tenantModal === 'create' ? 'Add New Tenant' : 'Edit Tenant'}</h2>
              <button className="lg-close-btn" onClick={() => setTenantModal(null)} disabled={isSubmitting}><X size={20} /></button>
            </div>
            <LiquidGlassContent>
              <form onSubmit={handleTenantSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <LiquidGlassInput 
                  label="Full Name *" 
                  value={tenantForm.full_name} 
                  onChange={e => setTenantForm({ ...tenantForm, full_name: e.target.value })} 
                  required 
                  placeholder="e.g. Alice Freeman" 
                />
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <LiquidGlassInput 
                      type="email" 
                      label="Email" 
                      value={tenantForm.email} 
                      onChange={e => setTenantForm({ ...tenantForm, email: e.target.value })} 
                      placeholder="alice@example.com" 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <LiquidGlassInput 
                      type="tel" 
                      label="Phone" 
                      value={tenantForm.phone} 
                      onChange={e => setTenantForm({ ...tenantForm, phone: e.target.value })} 
                      placeholder="+91 98765 43210" 
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div className="lg-input-group">
                      <label className="lg-input-label">ID Proof Type</label>
                      <div className="lg-input-wrapper">
                        <CustomSelect
                          value={tenantForm.id_proof_type}
                          onChange={(val) => setTenantForm({ ...tenantForm, id_proof_type: val })}
                          placeholder="Select..."
                          options={[
                            { value: 'Aadhaar', label: 'Aadhaar' },
                            { value: 'PAN', label: 'PAN' },
                            { value: 'Passport', label: 'Passport' },
                            { value: 'Driving License', label: 'Driving License' },
                            { value: 'Voter ID', label: 'Voter ID' }
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <LiquidGlassInput 
                      label="ID Proof Number" 
                      value={tenantForm.id_proof_number} 
                      onChange={e => setTenantForm({ ...tenantForm, id_proof_number: e.target.value })} 
                      placeholder="XXXX-XXXX-XXXX" 
                    />
                  </div>
                </div>
                <LiquidGlassInput 
                  label="Emergency Contact" 
                  value={tenantForm.emergency_contact} 
                  onChange={e => setTenantForm({ ...tenantForm, emergency_contact: e.target.value })} 
                  placeholder="Name — Phone" 
                />
                <LiquidGlassTextarea 
                  label="Notes" 
                  rows={2} 
                  value={tenantForm.notes} 
                  onChange={e => setTenantForm({ ...tenantForm, notes: e.target.value })} 
                  placeholder="Any additional notes..." 
                />
                <div className="lg-actions">
                  <button type="button" className="lg-btn lg-btn-secondary" onClick={() => setTenantModal(null)}>Cancel</button>
                  <button type="submit" className="lg-btn lg-btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : tenantModal === 'create' ? 'Add Tenant' : 'Save Changes'}</button>
                </div>
              </form>
            </LiquidGlassContent>
          </LiquidGlassWindow>
        </LiquidGlassOverlay>
      )}

      {/* Assign to Property Modal */}
      {assignModal && (
        <LiquidGlassOverlay onClose={() => !isSubmitting && setAssignModal(null)}>
          <LiquidGlassWindow>
            <div className="lg-modal-header">
              <h2 className="modal-title">{editAssignmentId ? 'Edit Assignment' : 'Assign Property'} - {assignModal.full_name}</h2>
              <button className="lg-close-btn" onClick={() => setAssignModal(null)}><X size={20} /></button>
            </div>
            <LiquidGlassContent>
              <form onSubmit={handleAssign} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div className="lg-input-group">
                  <label className="lg-input-label">Property *</label>
                  <div className="lg-input-wrapper">
                    <CustomSelect
                      value={assignForm.property_id}
                      onChange={(val) => setAssignForm({ ...assignForm, property_id: val })}
                      placeholder="Select property..."
                      searchable={true}
                      options={properties.map(p => ({
                        value: p.id,
                        label: `${p.name} (${p.total_units} units)`
                      }))}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <LiquidGlassInput 
                      label="Unit Number *" 
                      value={assignForm.unit_number} 
                      onChange={e => setAssignForm({ ...assignForm, unit_number: e.target.value })} 
                      placeholder="e.g. 4B" 
                      required 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <LiquidGlassInput 
                      type="number" 
                      label="Monthly Rent (₹) *" 
                      value={assignForm.current_rent} 
                      onChange={e => setAssignForm({ ...assignForm, current_rent: e.target.value })} 
                      placeholder="e.g. 15000" 
                      required 
                      min="0" 
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <LiquidGlassDatePicker 
                      label="Lease Start *" 
                      value={assignForm.lease_start} 
                      onChange={val => setAssignForm({ ...assignForm, lease_start: val })} 
                      required 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <LiquidGlassDatePicker 
                      label="Lease End" 
                      value={assignForm.lease_end} 
                      onChange={val => setAssignForm({ ...assignForm, lease_end: val })} 
                    />
                  </div>
                </div>
                <LiquidGlassInput 
                  type="number" 
                  label="Security Deposit (₹)" 
                  value={assignForm.security_deposit} 
                  onChange={e => setAssignForm({ ...assignForm, security_deposit: e.target.value })} 
                  placeholder="e.g. 30000" 
                  min="0" 
                />
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', marginTop: '8px' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '10px', fontWeight: 500 }}>💳 Payment Terms</p>
                  <div className="lg-input-group">
                    <label className="lg-input-label">Payment Mode *
                      <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '6px' }}>
                        (determines when rent is due)
                      </span>
                    </label>
                    <div className="lg-input-wrapper">
                      <CustomSelect
                        value={assignForm.payment_mode}
                        onChange={(val) => setAssignForm({ ...assignForm, payment_mode: val })}
                        options={[
                          { value: 'prepaid', label: 'Prepaid — Pay at start of month (before occupying)' },
                          { value: 'postpaid', label: 'Postpaid — Pay at end of month (after occupying)' },
                        ]}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                    <div style={{ flex: 1 }}>
                      <LiquidGlassInput 
                        type="number" 
                        label="Due Day of Month" 
                        value={assignForm.due_day} 
                        min="1" 
                        max="28"
                        onChange={e => setAssignForm({ ...assignForm, due_day: e.target.value })} 
                        placeholder="1" 
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <LiquidGlassInput 
                        type="number" 
                        label="Grace Period (days)" 
                        value={assignForm.grace_days} 
                        min="0" 
                        max="30"
                        onChange={e => setAssignForm({ ...assignForm, grace_days: e.target.value })} 
                        placeholder="5" 
                      />
                    </div>
                  </div>
                </div>
                <div className="lg-actions" style={{ marginTop: '16px' }}>
                  <button type="button" className="lg-btn lg-btn-secondary" onClick={() => setAssignModal(null)}>Cancel</button>
                  <button type="submit" className="lg-btn lg-btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : (editAssignmentId ? 'Save Changes' : 'Assign Tenant')}</button>
                </div>
              </form>
            </LiquidGlassContent>
          </LiquidGlassWindow>
        </LiquidGlassOverlay>
      )}

      {/* Rent Increase Modal */}
      {rentModal && (
        <LiquidGlassOverlay onClose={() => !isSubmitting && setRentModal(null)}>
          <LiquidGlassWindow style={{ maxWidth: '440px' }}>
            <div className="lg-modal-header">
              <h2 className="modal-title">Increase Rent</h2>
              <button className="lg-close-btn" onClick={() => setRentModal(null)}><X size={20} /></button>
            </div>
            <LiquidGlassContent>
              <form onSubmit={handleRentIncrease} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ padding: '14px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Current Rent</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(rentModal.current_rent).toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>New Rent</span>
                    <span style={{ fontWeight: 600, color: '#10b981' }}>₹{computedNewRent.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <LiquidGlassInput 
                  type="number" 
                  step="0.01" 
                  label="Increase Percentage (%) *" 
                  value={rentForm.increase_pct} 
                  onChange={e => setRentForm({ ...rentForm, increase_pct: e.target.value })} 
                  placeholder="e.g. 10" 
                  required 
                  min="0" 
                />
                <LiquidGlassDatePicker 
                  label="Effective From *" 
                  value={rentForm.effective_from} 
                  onChange={val => setRentForm({ ...rentForm, effective_from: val })} 
                  required 
                />
                <LiquidGlassInput 
                  label="Reason" 
                  value={rentForm.reason} 
                  onChange={e => setRentForm({ ...rentForm, reason: e.target.value })} 
                  placeholder="e.g. Annual revision" 
                />
                <div className="lg-actions" style={{ marginTop: '16px' }}>
                  <button type="button" className="lg-btn lg-btn-secondary" onClick={() => setRentModal(null)}>Cancel</button>
                  <button type="submit" className="lg-btn lg-btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Apply Increase'}</button>
                </div>
              </form>
            </LiquidGlassContent>
          </LiquidGlassWindow>
        </LiquidGlassOverlay>
      )}

      {/* Rent Revision History Modal */}
      {revisionTarget && (
        <LiquidGlassOverlay onClose={() => setRevisionTarget(null)}>
          <LiquidGlassWindow style={{ maxWidth: '540px' }}>
            <div className="lg-modal-header">
              <h2 className="modal-title">Rent History — Unit {revisionTarget.unit_number}</h2>
              <button className="lg-close-btn" onClick={() => setRevisionTarget(null)}><X size={20} /></button>
            </div>
            <LiquidGlassContent>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {revisions.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '24px' }}>No revision history yet.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Effective</th>
                        <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Previous</th>
                        <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>New</th>
                        <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>%</th>
                        <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revisions.map(r => (
                        <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '10px 12px', fontSize: '0.88rem' }}>{new Date(r.effective_from).toLocaleDateString()}</td>
                          <td style={{ padding: '10px 12px', fontSize: '0.88rem' }}>₹{Number(r.previous_rent).toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 12px', fontSize: '0.88rem', fontWeight: 500, color: '#10b981' }}>₹{Number(r.new_rent).toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 12px', fontSize: '0.88rem' }}>+{Number(r.increase_pct)}%</td>
                          <td style={{ padding: '10px 12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </LiquidGlassContent>
          </LiquidGlassWindow>
        </LiquidGlassOverlay>
      )}

      {/* Vacate Tenant Confirmation */}
      {vacateTarget && (
        <LiquidGlassOverlay onClose={() => !isSubmitting && setVacateTarget(null)}>
          <LiquidGlassWindow style={{ maxWidth: '400px' }}>
            <div className="lg-modal-header">
              <h2 className="modal-title">Vacate Property</h2>
              <button className="lg-close-btn" onClick={() => !isSubmitting && setVacateTarget(null)}><X size={20} /></button>
            </div>
            <LiquidGlassContent>
              <form onSubmit={handleVacate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                  This will end the lease for unit <strong>{vacateTarget.unit_number}</strong> at <strong>{vacateTarget.properties?.name}</strong>. Their payment history will be preserved.
                </p>
                <LiquidGlassDatePicker 
                  label="Vacate / Lease End Date *" 
                  value={vacateDate} 
                  onChange={val => setVacateDate(val)} 
                  required 
                />
                <div className="lg-actions" style={{ marginTop: '8px' }}>
                  <button type="button" className="lg-btn lg-btn-secondary" onClick={() => setVacateTarget(null)}>Cancel</button>
                  <button type="submit" className="lg-btn" style={{ background: 'var(--danger)', color: '#fff' }} disabled={isSubmitting}>
                    {isSubmitting ? 'Processing...' : 'Confirm Vacate'}
                  </button>
                </div>
              </form>
            </LiquidGlassContent>
          </LiquidGlassWindow>
        </LiquidGlassOverlay>
      )}

      {/* Delete Tenant Confirmation */}
      {deleteTarget && (
        <LiquidGlassOverlay onClose={() => !isSubmitting && setDeleteTarget(null)}>
          <LiquidGlassWindow style={{ maxWidth: '440px' }}>
            <div className="lg-modal-header">
              <h2 className="modal-title" style={{ color: '#ef4444' }}>Delete Tenant</h2>
              <button className="lg-close-btn" onClick={() => setDeleteTarget(null)}><X size={20} /></button>
            </div>
            <LiquidGlassContent>
              <div style={{ padding: '8px 4px 10px' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                  Are you sure you want to delete <strong style={{ color: 'white' }}>{deleteTarget.full_name}</strong>? All their property assignments and payment history will be permanently removed.
                </p>
                <div className="lg-actions" style={{ marginTop: '24px' }}>
                  <button className="lg-btn lg-btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
                  <button className="lg-btn lg-btn-primary" onClick={handleDeleteTenant} disabled={isSubmitting} style={{ background: '#ef4444', color: 'white' }}>
                    {isSubmitting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </LiquidGlassContent>
          </LiquidGlassWindow>
        </LiquidGlassOverlay>
      )}

      {/* Payment Ledger Drawer */}
      {paymentLedgerTarget && (
        <TenantHistoryDrawer
          assignmentId={paymentLedgerTarget.assignmentId}
          tenantName={paymentLedgerTarget.tenantName}
          propertyName={paymentLedgerTarget.propertyName}
          unitNumber={paymentLedgerTarget.unitNumber}
          currentRent={paymentLedgerTarget.currentRent}
          backendBalance={0}
          onClose={() => setPaymentLedgerTarget(null)}
        />
      )}
    </>
  );
};
