import React, { useState, useEffect } from 'react';
import './views.css';
import { Search, Plus, X, Pencil, Trash2, Home, ChevronDown, ChevronUp, TrendingUp, List, MoreVertical, ArrowRightLeft, Printer, CornerDownRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CustomSelect } from '../components/ui/CustomSelect';
import { TenantHistoryDrawer } from '../components/ui/TenantHistoryDrawer';
import { AgreementSlipModal } from '../components/agreement/AgreementSlipModal';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import { rentBadge } from '../lib/paymentUtils';

import { Modal, ModalInput, ModalTextarea, ModalActionButtons } from '../components/ui/Modal';
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
  gst_rate?: number;
  tds_rate?: number;
  previous_assignment_id?: string | null;
  transfer_reason?: string | null;
  properties: { id: string; name: string } | null;
  payments?: { amount: number; is_reversed: boolean }[];
  rent_revisions?: { previous_rent: number; new_rent: number; increase_pct: number | null; effective_from: string }[];
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
  const [paymentLedgerBalance, setPaymentLedgerBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPropertyId, setFilterPropertyId] = useState<string>('');


  // Tenant modals
  const [tenantModal, setTenantModal] = useState<'create' | 'edit' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenantForm, setTenantForm] = useState({ id: '', full_name: '', email: '', phone: '', id_proof_type: '', id_proof_number: '', emergency_contact: '', notes: '' });
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);

  // Assign modal
  const [assignModal, setAssignModal] = useState<Tenant | null>(null);
  const [assignForm, setAssignForm] = useState({ property_id: '', unit_number: '', current_rent: '', lease_start: '', lease_end: '', security_deposit: '', payment_mode: 'prepaid', due_day: '1', grace_days: '5', gst_rate: '18', tds_rate: '10' });
  const [editAssignmentId, setEditAssignmentId] = useState<string | null>(null);

  // Expanded rows
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);

  // Rent increase modal
  const [rentModal, setRentModal] = useState<Assignment | null>(null);
  const [rentForm, setRentForm] = useState({ increase_pct: '', new_rent: '', effective_from: '', reason: '' });

  // Rent revision history
  const [revisionTarget, setRevisionTarget] = useState<Assignment | null>(null);
  const [revisions, setRevisions] = useState<RentRevision[]>([]);
  const [editingRevisionId, setEditingRevisionId] = useState<string | null>(null);
  const [editRevisionForm, setEditRevisionForm] = useState({ increase_pct: '', new_rent: '', effective_from: '' });

  // Vacate property
  const [vacateTarget, setVacateTarget] = useState<Assignment | null>(null);
  const [vacateDate, setVacateDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Transfer to another property
  const [transferTarget, setTransferTarget] = useState<Assignment | null>(null);
  const [transferTenant, setTransferTenant] = useState<Tenant | null>(null);
  const [transferForm, setTransferForm] = useState({ property_id: '', unit_number: '', current_rent: '', security_deposit: '', lease_end: '', payment_mode: 'prepaid', due_day: '1', grace_days: '5', gst_rate: '18', tds_rate: '10', transfer_date: new Date().toISOString().split('T')[0], reason: '' });

  // Print agreement slip
  const [agreementSlipTarget, setAgreementSlipTarget] = useState<{ assignment: Assignment, tenant: Tenant } | null>(null);
  const currentProfile = useCurrentProfile();

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
        supabase.from('tenant_assignments').select('*, properties(id, name), payments(amount, is_reversed), rent_revisions(previous_rent, new_rent, increase_pct, effective_from)').order('created_at', { ascending: false }),
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
    setAssignForm({ property_id: properties[0]?.id || '', unit_number: '', current_rent: '', lease_start: '', lease_end: '', security_deposit: '', payment_mode: 'prepaid', due_day: '1', grace_days: '5', gst_rate: '18', tds_rate: '10' });
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
      grace_days: a.grace_days?.toString() || '5',
      gst_rate: a.gst_rate?.toString() ?? '18',
      tds_rate: a.tds_rate?.toString() ?? '10'
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
        grace_days: parseInt(assignForm.grace_days) || 5,
        gst_rate: parseFloat(assignForm.gst_rate) || 0,
        tds_rate: parseFloat(assignForm.tds_rate) || 0
      };

      if (editAssignmentId) {
        const { error } = await supabase.from('tenant_assignments').update(payload).eq('id', editAssignmentId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tenant_assignments').insert([{ ...payload, tenant_id: assignModal.id, status: 'active' }]);
        if (error) throw error;
      }
      
      // Trigger automated projections for the new assignment
      await supabase.functions.invoke('auto-rent-increase');
      
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
    setRentForm({ increase_pct: '', new_rent: '', effective_from: '', reason: '' });
  };

  const handleRentIncrease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rentModal) return;
    setIsSubmitting(true);
    try {
      const pct = parseFloat(rentForm.increase_pct);
      const newRent = parseFloat(rentForm.new_rent);
      
      const actualPct = isNaN(pct) ? null : pct;
      const actualNewRent = isNaN(newRent) ? rentModal.current_rent : newRent;

      // Insert revision
      const { error: revErr } = await supabase.from('rent_revisions').insert([{
        assignment_id: rentModal.id,
        previous_rent: rentModal.current_rent,
        new_rent: actualNewRent,
        increase_pct: actualPct,
        effective_from: rentForm.effective_from,
        reason: rentForm.reason || null,
        created_by: (await supabase.auth.getUser()).data.user?.id || null,
      }]);
      if (revErr) throw revErr;

      // Only update current rent immediately if effective date is today or in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const effectiveDate = new Date(rentForm.effective_from);
      effectiveDate.setHours(0, 0, 0, 0);
      
      if (effectiveDate <= today) {
        const { error: updErr } = await supabase.from('tenant_assignments').update({ current_rent: actualNewRent }).eq('id', rentModal.id);
        if (updErr) throw updErr;
      }
      
      // Delete subsequent automated revisions so they can be re-projected from the new baseline
      await supabase.from('rent_revisions')
        .delete()
        .eq('assignment_id', rentModal.id)
        .gt('effective_from', rentForm.effective_from)
        .is('reason', null);
        
      // Instantly trigger re-calculation
      await supabase.functions.invoke('auto-rent-increase');

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

  // ── Transfer to Another Property ──────────────────────────────────────────

  const openTransferModal = (a: Assignment, t: Tenant) => {
    setTransferTenant(t);
    setTransferTarget(a);
    setTransferForm({
      property_id: properties.find(p => p.id !== a.property_id)?.id || '',
      unit_number: '',
      current_rent: getEffectiveRentAsOf(a).toString(),
      security_deposit: a.security_deposit.toString(),
      lease_end: '',
      payment_mode: a.payment_mode || 'prepaid',
      due_day: a.due_day?.toString() || '1',
      grace_days: a.grace_days?.toString() || '5',
      gst_rate: a.gst_rate?.toString() ?? '18',
      tds_rate: a.tds_rate?.toString() ?? '10',
      transfer_date: new Date().toISOString().split('T')[0],
      reason: '',
    });
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTarget || !transferForm.property_id || !transferForm.transfer_date) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('transfer_tenant_assignment', {
        p_old_assignment_id: transferTarget.id,
        p_transfer_date: transferForm.transfer_date,
        p_new_property_id: transferForm.property_id,
        p_new_unit_number: transferForm.unit_number,
        p_new_rent: parseFloat(transferForm.current_rent) || 0,
        p_new_deposit: parseFloat(transferForm.security_deposit) || 0,
        p_new_lease_end: transferForm.lease_end || null,
        p_payment_mode: transferForm.payment_mode,
        p_due_day: parseInt(transferForm.due_day) || 1,
        p_grace_days: parseInt(transferForm.grace_days) || 5,
        p_gst_rate: parseFloat(transferForm.gst_rate) || 0,
        p_tds_rate: parseFloat(transferForm.tds_rate) || 0,
        p_reason: transferForm.reason || null,
      });
      if (error) throw error;
      
      // Trigger automated projections for the transferred assignment
      await supabase.functions.invoke('auto-rent-increase');
      
      setTransferTarget(null);
      setTransferTenant(null);
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
    setEditingRevisionId(null);
    const { data } = await supabase.from('rent_revisions').select('*').eq('assignment_id', a.id).order('effective_from', { ascending: false });
    setRevisions(data || []);
  };

  const handleSaveRevision = async (revId: string, previousRent: number) => {
    setIsSubmitting(true);
    try {
      const pct = parseFloat(editRevisionForm.increase_pct);
      const newRent = parseFloat(editRevisionForm.new_rent);
      const { error } = await supabase.from('rent_revisions').update({
        increase_pct: isNaN(pct) ? null : pct,
        new_rent: isNaN(newRent) ? previousRent : newRent,
        effective_from: editRevisionForm.effective_from
      }).eq('id', revId);
      if (error) throw error;
      
      // Delete subsequent automated revisions so they can be re-projected from the new baseline
      if (revisionTarget) {
        await supabase.from('rent_revisions')
          .delete()
          .eq('assignment_id', revisionTarget.id)
          .gt('effective_from', editRevisionForm.effective_from)
          .is('reason', null);
          
        // Instantly trigger re-calculation
        await supabase.functions.invoke('auto-rent-increase');
      }

      setEditingRevisionId(null);
      if (revisionTarget) openRevisionHistory(revisionTarget);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRevision = async (revId: string, effectiveFrom: string) => {
    if (!confirm('Are you sure you want to delete this rent revision?')) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('rent_revisions').delete().eq('id', revId);
      if (error) throw error;
      
      // Delete subsequent automated revisions so they can be re-projected from the new baseline
      if (revisionTarget) {
        await supabase.from('rent_revisions')
          .delete()
          .eq('assignment_id', revisionTarget.id)
          .gt('effective_from', effectiveFrom)
          .is('reason', null);
          
        // Instantly trigger re-calculation
        await supabase.functions.invoke('auto-rent-increase');
      }

      if (revisionTarget) openRevisionHistory(revisionTarget);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.email && t.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.phone && t.phone.includes(searchTerm));
      
    const matchesProperty = !filterPropertyId || (assignmentsMap[t.id] || []).some(a => a.property_id === filterPropertyId);
    
    return matchesSearch && matchesProperty;
  });

  const totalTenants = filteredTenants.length;
  let activeLeases = 0;
  let totalMonthlyRent = 0;
  
  filteredTenants.forEach(t => {
    const assigns = assignmentsMap[t.id] || [];
    const active = assigns.find(a => a.status === 'active' && (!filterPropertyId || a.property_id === filterPropertyId));
    if (active) {
      activeLeases++;
      totalMonthlyRent += getEffectiveRentAsOf(active);
    }
  });

  const vacatedOrNew = totalTenants - activeLeases;


  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {error && <div style={{ backgroundColor: 'rgba(255,0,0,0.1)', color: '#ff4d4d', padding: '10px 14px', borderRadius: '2px' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', width: '100%' }}>
        <div className="surface-card glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '1px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
          <span style={{ color: '#4b5563', fontSize: '0.95rem', fontWeight: 500 }}>Total Tenants</span>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0f766e' }}>{totalTenants}</h2>
        </div>
        
        <div className="surface-card glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '1px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
          <span style={{ color: '#4b5563', fontSize: '0.95rem', fontWeight: 500 }}>Active Leases</span>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0f766e' }}>{activeLeases}</h2>
        </div>
        
        <div className="surface-card glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '1px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
          <span style={{ color: '#4b5563', fontSize: '0.95rem', fontWeight: 500 }}>Monthly Rent Roll</span>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0f766e' }}>₹{totalMonthlyRent.toLocaleString('en-IN')}</h2>
        </div>
        
        <div className="surface-card glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '1px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
          <span style={{ color: '#4b5563', fontSize: '0.95rem', fontWeight: 500 }}>Unassigned / Vacated</span>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0f766e' }}>{vacatedOrNew}</h2>
        </div>
      </div>

      <div className="search-filter-row">
        <div style={{ display: 'flex', gap: '16px', flex: 1, alignItems: 'center' }}>
          <div className="search-input-container" style={{ flex: 1 }}>
            <Search size={18} color="var(--text-secondary)" />
            <input type="text" placeholder="Search tenants..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
        <button className="btn btn-primary" onClick={openCreateTenant} style={{ display: 'flex', gap: '8px', alignItems: 'center', borderRadius: '2px', padding: '0 20px', fontWeight: 600, height: '48px', flexShrink: 0, background: '#0f766e', color: '#ffffff', border: 'none' }}>
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
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', textAlign: 'left' }}>
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
                    <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid rgba(0,0,0,0.05)', backgroundColor: isExpanded ? 'rgba(15,118,110,0.03)' : 'transparent', cursor: assigns.length > 0 ? 'pointer' : undefined }} onClick={() => assigns.length > 0 && setExpandedTenant(isExpanded ? null : t.id)}>
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
                          <span style={{ padding: '3px 10px', borderRadius: '1px', fontSize: '0.8rem', fontWeight: 500, backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }}>Active</span>
                        ) : assigns.length > 0 ? (
                          <span style={{ padding: '3px 10px', borderRadius: '1px', fontSize: '0.8rem', fontWeight: 500, backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Inactive</span>
                        ) : (
                          <span style={{ padding: '3px 10px', borderRadius: '1px', fontSize: '0.8rem', fontWeight: 500, backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>New</span>
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
                          <button onClick={(e) => { e.stopPropagation(); openAssignModal(t); }} title="Assign to Property" style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '2px', padding: '6px 8px', cursor: 'pointer', color: '#0f766e', display: 'flex', alignItems: 'center' }}>
                            <Home size={14} style={{ pointerEvents: 'none' }} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openEditTenant(t); }} title="Edit" style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '2px', padding: '6px 8px', cursor: 'pointer', color: '#0f766e', display: 'flex', alignItems: 'center' }}>
                            <Pencil size={14} style={{ pointerEvents: 'none' }} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }} title="Delete" style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '2px', padding: '6px 8px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={14} style={{ pointerEvents: 'none' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded: all assignments + rent actions */}
                    {isExpanded && assigns.map((a, idx) => (
                      <tr key={a.id} style={{ backgroundColor: 'rgba(15,118,110,0.03)', borderBottom: idx === assigns.length - 1 ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(15,118,110,0.05)' }}>
                        <td style={{ padding: '10px 8px 10px 24px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <CornerDownRight size={14} color="var(--text-secondary)" style={{ opacity: 0.5 }} />
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {a.properties?.name} — Unit {a.unit_number}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {a.payment_mode ? <span style={{ textTransform: 'capitalize' }}>{a.payment_mode.replace(/_/g, ' ')}</span> : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: '0.85rem' }}>
                          {new Date(a.lease_start).toLocaleDateString()} — {a.lease_end ? new Date(a.lease_end).toLocaleDateString() : 'Ongoing'}
                          {a.previous_assignment_id && (() => {
                            const prev = assigns.find(x => x.id === a.previous_assignment_id);
                            return prev ? (
                              <div style={{ fontSize: '0.72rem', color: '#3b82f6', marginTop: '3px' }}>
                                ← Continued from {prev.properties?.name || 'previous property'}
                              </div>
                            ) : null;
                          })()}
                          {(() => {
                            const next = assigns.find(x => x.previous_assignment_id === a.id);
                            return next ? (
                              <div style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '3px' }}>
                                → Transferred to {next.properties?.name || 'new property'} on {new Date(next.lease_start).toLocaleDateString()}
                              </div>
                            ) : null;
                          })()}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: '0.85rem' }}>
                          Deposit: ₹{Number(a.security_deposit).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '10px 16px', fontWeight: 500, fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            ₹{Number(getEffectiveRentAsOf(a)).toLocaleString('en-IN')}
                            {(() => {
                              const badge = rentBadge(a.rent_revisions);
                              return (
                                <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '2px', fontWeight: 600, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>
                                  {badge.label}
                                </span>
                              );
                            })()}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '2px' }}>
                            Paid: ₹{a.payments ? a.payments.filter(p => !p.is_reversed).reduce((s, p) => s + Number(p.amount), 0).toLocaleString('en-IN') : 0}
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '1px', fontSize: '0.75rem', fontWeight: 500,
                            backgroundColor: a.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            color: a.status === 'active' ? '#10b981' : '#ef4444' }}>
                            {a.status === 'active' ? 'Occupied' : 'Vacated'}
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
                              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '2px', padding: '6px', cursor: 'pointer', color: 'var(--text-primary)' }}
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
                                borderRadius: '2px',
                                padding: '6px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                zIndex: 100,
                                minWidth: '160px',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                              }}>
                                <button onClick={(e) => { e.stopPropagation(); setActionMenuOpen(null); openEditAssignModal(a, t); }} style={{ background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', width: '100%', textAlign: 'left', borderRadius: '2px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <Pencil size={14} color="#3b82f6" /> Edit
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setActionMenuOpen(null); openRentModal(a); }} style={{ background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', width: '100%', textAlign: 'left', borderRadius: '2px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <TrendingUp size={14} color="#f59e0b" /> Increase Rent
                                </button>
                                <button onClick={async (e) => {
                                  e.stopPropagation();
                                  setActionMenuOpen(null);
                                  setPaymentLedgerBalance(0);
                                  setPaymentLedgerTarget({
                                    assignmentId: a.id,
                                    tenantName: t.full_name,
                                    propertyName: a.properties?.name || 'Unknown Property',
                                    unitNumber: a.unit_number,
                                    currentRent: getEffectiveRentAsOf(a),
                                    gstRate: Number(a.gst_rate ?? 18),
                                    tdsRate: Number(a.tds_rate ?? 10)
                                  });
                                  const now = new Date();
                                  const { data: statusData, error: statusErr } = await supabase.functions.invoke('payment-stats', {
                                    body: { action: 'payment-status', filterMonth: now.getMonth() + 1, filterYear: now.getFullYear() },
                                  });
                                  if (!statusErr && statusData?.statusMap?.[a.id]) {
                                    setPaymentLedgerBalance(statusData.statusMap[a.id].balance || 0);
                                  }
                                }} style={{ background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', width: '100%', textAlign: 'left', borderRadius: '2px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <List size={14} color="#10b981" /> Payment Ledger
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setActionMenuOpen(null); openRevisionHistory(a); }} style={{ background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', width: '100%', textAlign: 'left', borderRadius: '2px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <TrendingUp size={14} color="#3b82f6" /> Rent History
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setActionMenuOpen(null); setAgreementSlipTarget({ assignment: a, tenant: t }); }} style={{ background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', width: '100%', textAlign: 'left', borderRadius: '2px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <Printer size={14} color="#7c3aed" /> Print Agreement Slip
                                </button>
                                {a.status === 'active' && (
                                  <button onClick={(e) => { e.stopPropagation(); setActionMenuOpen(null); openTransferModal(a, t); }} style={{ background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', width: '100%', textAlign: 'left', borderRadius: '2px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <ArrowRightLeft size={14} color="#0f766e" /> Transfer to Property
                                  </button>
                                )}
                                {a.status === 'active' && (
                                  <button onClick={(e) => { e.stopPropagation(); setActionMenuOpen(null); setVacateTarget(a); setVacateDate(new Date().toISOString().split('T')[0]); }} style={{ background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', width: '100%', textAlign: 'left', borderRadius: '2px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
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
      {/* Tenant Create/Edit Modal */}
      <Modal isOpen={!!tenantModal} onClose={() => !isSubmitting && setTenantModal(null)} title={tenantModal === 'create' ? 'Add New Tenant' : 'Edit Tenant'}>
        <form onSubmit={handleTenantSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ModalInput 
            label="Full Name *" 
            value={tenantForm.full_name} 
            onChange={e => setTenantForm({ ...tenantForm, full_name: e.target.value })} 
            required 
            placeholder="e.g. Alice Freeman" 
          />
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <ModalInput 
                type="email" 
                label="Email" 
                value={tenantForm.email} 
                onChange={e => setTenantForm({ ...tenantForm, email: e.target.value })} 
                placeholder="alice@example.com" 
              />
            </div>
            <div style={{ flex: 1 }}>
              <ModalInput 
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ID Proof Type</label>
                <div style={{ position: 'relative' }}>
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
              <ModalInput 
                label="ID Proof Number" 
                value={tenantForm.id_proof_number} 
                onChange={e => setTenantForm({ ...tenantForm, id_proof_number: e.target.value })} 
                placeholder="XXXX-XXXX-XXXX" 
              />
            </div>
          </div>
          <ModalInput 
            label="Emergency Contact" 
            value={tenantForm.emergency_contact} 
            onChange={e => setTenantForm({ ...tenantForm, emergency_contact: e.target.value })} 
            placeholder="Name — Phone" 
          />
          <ModalTextarea 
            label="Notes" 
            rows={2} 
            value={tenantForm.notes} 
            onChange={e => setTenantForm({ ...tenantForm, notes: e.target.value })} 
            placeholder="Any additional notes..." 
          />
          <ModalActionButtons 
            onCancel={() => setTenantModal(null)} 
            submitText={tenantModal === 'create' ? 'Add Tenant' : 'Save Changes'}
            isSubmitting={isSubmitting} 
          />
        </form>
      </Modal>

      {/* Assign to Property Modal */}
      {/* Assign to Property Modal */}
      <Modal isOpen={!!assignModal} onClose={() => !isSubmitting && setAssignModal(null)} title={`${editAssignmentId ? 'Edit Assignment' : 'Assign Property'} - ${assignModal?.full_name}`}>
        <form onSubmit={handleAssign} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Property *</label>
            <div style={{ position: 'relative' }}>
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
              <ModalInput 
                label="Unit Number *" 
                value={assignForm.unit_number} 
                onChange={e => setAssignForm({ ...assignForm, unit_number: e.target.value })} 
                placeholder="e.g. 4B" 
                required 
              />
            </div>
            <div style={{ flex: 1 }}>
              <ModalInput 
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
              <ModalInput 
                type="number" 
                step="0.01"
                label="GST Rate (%)" 
                value={assignForm.gst_rate} 
                onChange={e => setAssignForm({ ...assignForm, gst_rate: e.target.value })} 
                placeholder="18" 
                min="0" 
                max="100"
              />
            </div>
            <div style={{ flex: 1 }}>
              <ModalInput 
                type="number" 
                step="0.01"
                label="TDS Rate (%)" 
                value={assignForm.tds_rate} 
                onChange={e => setAssignForm({ ...assignForm, tds_rate: e.target.value })} 
                placeholder="10" 
                min="0" 
                max="100"
              />
            </div>
          </div>
          {(() => {
            const rent = parseFloat(assignForm.current_rent) || 0;
            const gstRate = parseFloat(assignForm.gst_rate) || 0;
            const tdsRate = parseFloat(assignForm.tds_rate) || 0;
            const gstAmt = Math.round(rent * gstRate / 100);
            const tdsAmt = Math.round(rent * tdsRate / 100);
            const total = rent + gstAmt;
            const net = total - tdsAmt;
            if (rent <= 0) return null;
            return (
              <div style={{ padding: '14px', backgroundColor: 'var(--bg-main)', borderRadius: '2px', border: '1px solid var(--border-color)', marginTop: '-8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Rent</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>₹{rent.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>+ GST ({gstRate}%)</span>
                  <span style={{ fontWeight: 500, color: '#f59e0b' }}>₹{gstAmt.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>= Total</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>₹{total.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>− TDS ({tdsRate}%)</span>
                  <span style={{ fontWeight: 500, color: '#ef4444' }}>₹{tdsAmt.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Net Receivable</span>
                  <span style={{ fontWeight: 700, color: '#10b981', fontSize: '1rem' }}>₹{net.toLocaleString('en-IN')}</span>
                </div>
              </div>
            );
          })()}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <ModalInput 
                type="date"
                label="Lease Start *" 
                value={assignForm.lease_start} 
                onChange={e => setAssignForm({ ...assignForm, lease_start: e.target.value })} 
                required 
              />
            </div>
            <div style={{ flex: 1 }}>
              <ModalInput 
                type="date"
                label="Lease End" 
                value={assignForm.lease_end} 
                onChange={e => setAssignForm({ ...assignForm, lease_end: e.target.value })} 
              />
            </div>
          </div>
          <ModalInput 
            type="number" 
            label="Security Deposit (₹)" 
            value={assignForm.security_deposit} 
            onChange={e => setAssignForm({ ...assignForm, security_deposit: e.target.value })} 
            placeholder="e.g. 30000" 
            min="0" 
          />
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '-10px', fontWeight: 500 }}>Payment Terms</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Mode *
                <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '6px', textTransform: 'none' }}>
                  (determines when rent is due)
                </span>
              </label>
              <div style={{ position: 'relative' }}>
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
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <ModalInput 
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
                <ModalInput 
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
          <ModalActionButtons 
            onCancel={() => setAssignModal(null)} 
            submitText={editAssignmentId ? 'Save Changes' : 'Assign Tenant'}
            isSubmitting={isSubmitting} 
          />
        </form>
      </Modal>

      {/* Rent Increase Modal */}
      <Modal isOpen={!!rentModal} onClose={() => !isSubmitting && setRentModal(null)} title="Increase Rent" maxWidth="440px">
        <form onSubmit={handleRentIncrease} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {(() => {
            const currentRent = Number(rentModal?.current_rent || 0);
            const gstRate = Number(rentModal?.gst_rate ?? 18);
            const tdsRate = Number(rentModal?.tds_rate ?? 10);
            const currentGst = Math.round(currentRent * gstRate / 100);
            const currentTds = Math.round(currentRent * tdsRate / 100);
            const currentNet = currentRent + currentGst - currentTds;
            return (
              <div style={{ padding: '14px', backgroundColor: 'var(--bg-main)', borderRadius: '2px', border: '1px solid var(--border-color)', marginBottom: '-10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Current Rent</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{currentRent.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Current Net (+ GST {gstRate}% − TDS {tdsRate}%)</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>₹{currentNet.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px' }}></div>
              </div>
            );
          })()}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <ModalInput 
                type="number" 
                step="0.01" 
                label="New Rent *" 
                value={rentForm.new_rent} 
                onChange={e => {
                  const nr = parseFloat(e.target.value);
                  const currentRent = rentModal?.current_rent || 1;
                  const pct = (!isNaN(nr) && currentRent > 0) ? ((nr - currentRent) / currentRent * 100).toFixed(2) : rentForm.increase_pct;
                  setRentForm({ ...rentForm, new_rent: e.target.value, increase_pct: pct.toString() });
                }} 
                placeholder="e.g. 15000" 
                required 
                min="0" 
              />
            </div>
            <div style={{ flex: 1 }}>
              <ModalInput 
                type="number" 
                step="0.01" 
                label="Increase (%) *" 
                value={rentForm.increase_pct} 
                onChange={e => {
                  const pct = parseFloat(e.target.value);
                  const currentRent = rentModal?.current_rent || 0;
                  const nr = !isNaN(pct) ? (currentRent * (1 + pct / 100)).toFixed(2) : rentForm.new_rent;
                  setRentForm({ ...rentForm, increase_pct: e.target.value, new_rent: nr.toString() });
                }} 
                placeholder="e.g. 10" 
                required 
                min="0" 
              />
            </div>
          </div>
          <ModalInput 
            type="date"
            label="Effective From *" 
            value={rentForm.effective_from} 
            onChange={e => setRentForm({ ...rentForm, effective_from: e.target.value })} 
            required 
          />
          <ModalInput 
            label="Reason" 
            value={rentForm.reason} 
            onChange={e => setRentForm({ ...rentForm, reason: e.target.value })} 
            placeholder="e.g. Annual revision" 
          />
          <ModalActionButtons 
            onCancel={() => setRentModal(null)} 
            submitText="Apply Increase"
            isSubmitting={isSubmitting} 
          />
        </form>
      </Modal>

      {/* Rent Revision History Modal */}
      <Modal isOpen={!!revisionTarget} onClose={() => setRevisionTarget(null)} title={`Rent History — Unit ${revisionTarget?.unit_number}`} maxWidth="650px">
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {revisions.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '24px' }}>No revision history yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Effective</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Previous</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>New</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>%</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {revisions.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {editingRevisionId === r.id ? (
                      <>
                        <td style={{ padding: '6px 12px' }}>
                          <input type="date" value={editRevisionForm.effective_from} onChange={e => setEditRevisionForm({...editRevisionForm, effective_from: e.target.value})} style={{ width: '100%', padding: '4px', border: '1px solid var(--border-color)' }} />
                        </td>
                        <td style={{ padding: '6px 12px', fontSize: '0.88rem', color: 'var(--text-primary)' }}>₹{Number(r.previous_rent).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '6px 12px' }}>
                          <input 
                            type="number" 
                            step="0.01" 
                            value={editRevisionForm.new_rent} 
                            onChange={e => {
                              const nr = parseFloat(e.target.value);
                              const pct = (!isNaN(nr) && r.previous_rent > 0) ? ((nr - r.previous_rent) / r.previous_rent * 100).toFixed(2) : editRevisionForm.increase_pct;
                              setEditRevisionForm({...editRevisionForm, new_rent: e.target.value, increase_pct: pct.toString()});
                            }} 
                            style={{ width: '100px', padding: '4px', border: '1px solid var(--border-color)' }} 
                          />
                        </td>
                        <td style={{ padding: '6px 12px' }}>
                          <input 
                            type="number" 
                            step="0.01" 
                            value={editRevisionForm.increase_pct} 
                            onChange={e => {
                              const pct = parseFloat(e.target.value);
                              const nr = !isNaN(pct) ? (r.previous_rent * (1 + pct / 100)).toFixed(2) : editRevisionForm.new_rent;
                              setEditRevisionForm({...editRevisionForm, increase_pct: e.target.value, new_rent: nr.toString()});
                            }} 
                            style={{ width: '60px', padding: '4px', border: '1px solid var(--border-color)' }} 
                          />
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                          <button onClick={() => handleSaveRevision(r.id, r.previous_rent)} style={{ color: '#10b981', background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px', fontSize: '0.8rem', fontWeight: 600 }} disabled={isSubmitting}>Save</button>
                          <button onClick={() => setEditingRevisionId(null)} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }} disabled={isSubmitting}>Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '10px 12px', fontSize: '0.88rem', color: 'var(--text-primary)' }}>{new Date(r.effective_from).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 12px', fontSize: '0.88rem', color: 'var(--text-primary)' }}>₹{Number(r.previous_rent).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 12px', fontSize: '0.88rem', fontWeight: 500, color: '#10b981' }}>₹{Number(r.new_rent).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 12px', fontSize: '0.88rem', color: 'var(--text-primary)' }}>+{Number(r.increase_pct)}%</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button onClick={() => {
                            setEditingRevisionId(r.id);
                            setEditRevisionForm({
                              increase_pct: r.increase_pct?.toString() || '',
                              new_rent: r.new_rent.toString(),
                              effective_from: r.effective_from
                            });
                          }} style={{ color: '#0f766e', background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px' }} title="Edit"><Pencil size={14} /></button>
                          <button onClick={() => handleDeleteRevision(r.id, r.effective_from)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }} title="Delete"><Trash2 size={14} /></button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>

      {/* Vacate Tenant Confirmation */}
      <Modal isOpen={!!vacateTarget} onClose={() => !isSubmitting && setVacateTarget(null)} title="Vacate Property" maxWidth="400px">
        <form onSubmit={handleVacate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
            This will end the lease for unit <strong style={{ color: 'var(--text-primary)' }}>{vacateTarget?.unit_number}</strong> at <strong style={{ color: 'var(--text-primary)' }}>{vacateTarget?.properties?.name}</strong>. Their payment history will be preserved.
          </p>
          <ModalInput 
            type="date"
            label="Vacate / Lease End Date *" 
            value={vacateDate} 
            onChange={e => setVacateDate(e.target.value)} 
            required 
          />
          <ModalActionButtons 
            onCancel={() => setVacateTarget(null)} 
            submitText="Confirm Vacate"
            isSubmitting={isSubmitting} 
            isDanger={true}
          />
        </form>
      </Modal>

      {/* Transfer Tenant Modal */}
      <Modal isOpen={!!transferTarget} onClose={() => !isSubmitting && setTransferTarget(null)} title={`Transfer ${transferTenant?.full_name} to Another Property`}>
        <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0, padding: '12px 14px', background: 'var(--bg-main)', borderRadius: '2px', border: '1px solid var(--border-color)' }}>
            This ends the lease at <strong style={{ color: 'var(--text-primary)' }}>{transferTarget?.properties?.name}</strong> (Unit {transferTarget?.unit_number}) on the transfer date and starts a new one at the property below. Rent/deposit already paid at {transferTarget?.properties?.name} stays recorded there in the ledger — it does not move.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>New Property *</label>
            <div style={{ position: 'relative' }}>
              <CustomSelect
                value={transferForm.property_id}
                onChange={(val) => setTransferForm({ ...transferForm, property_id: val })}
                placeholder="Select property..."
                searchable={true}
                options={properties.filter(p => p.id !== transferTarget?.property_id).map(p => ({
                  value: p.id,
                  label: `${p.name} (${p.total_units} units)`
                }))}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <ModalInput
                label="New Unit Number *"
                value={transferForm.unit_number}
                onChange={e => setTransferForm({ ...transferForm, unit_number: e.target.value })}
                placeholder="e.g. 4B"
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <ModalInput
                type="date"
                label="Transfer Date *"
                value={transferForm.transfer_date}
                onChange={e => setTransferForm({ ...transferForm, transfer_date: e.target.value })}
                required
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <ModalInput
                type="number"
                label="Monthly Rent (₹) *"
                value={transferForm.current_rent}
                onChange={e => setTransferForm({ ...transferForm, current_rent: e.target.value })}
                required
                min="0"
              />
            </div>
            <div style={{ flex: 1 }}>
              <ModalInput
                type="number"
                label="Security Deposit (₹)"
                value={transferForm.security_deposit}
                onChange={e => setTransferForm({ ...transferForm, security_deposit: e.target.value })}
                min="0"
              />
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: '-12px 0 0' }}>
            Deposit already paid at the old property stays recorded there — enter the deposit that applies at the new property (leave as-is if it simply carries over).
          </p>
          <ModalInput
            type="date"
            label="New Lease End"
            value={transferForm.lease_end}
            onChange={e => setTransferForm({ ...transferForm, lease_end: e.target.value })}
          />
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <ModalInput
                type="number"
                step="0.01"
                label="GST Rate (%)"
                value={transferForm.gst_rate}
                onChange={e => setTransferForm({ ...transferForm, gst_rate: e.target.value })}
                min="0"
                max="100"
              />
            </div>
            <div style={{ flex: 1 }}>
              <ModalInput
                type="number"
                step="0.01"
                label="TDS Rate (%)"
                value={transferForm.tds_rate}
                onChange={e => setTransferForm({ ...transferForm, tds_rate: e.target.value })}
                min="0"
                max="100"
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Mode</label>
            <div style={{ position: 'relative' }}>
              <CustomSelect
                value={transferForm.payment_mode}
                onChange={(val) => setTransferForm({ ...transferForm, payment_mode: val })}
                options={[
                  { value: 'prepaid', label: 'Prepaid — Pay at start of month' },
                  { value: 'postpaid', label: 'Postpaid — Pay at end of month' },
                ]}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <ModalInput
                type="number"
                label="Due Day of Month"
                value={transferForm.due_day}
                min="1"
                max="28"
                onChange={e => setTransferForm({ ...transferForm, due_day: e.target.value })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <ModalInput
                type="number"
                label="Grace Period (days)"
                value={transferForm.grace_days}
                min="0"
                max="30"
                onChange={e => setTransferForm({ ...transferForm, grace_days: e.target.value })}
              />
            </div>
          </div>
          <ModalTextarea
            label="Reason for Transfer"
            rows={2}
            value={transferForm.reason}
            onChange={e => setTransferForm({ ...transferForm, reason: e.target.value })}
            placeholder="e.g. Tenant requested a larger unit"
          />
          <ModalActionButtons
            onCancel={() => setTransferTarget(null)}
            submitText="Confirm Transfer"
            isSubmitting={isSubmitting}
          />
        </form>
      </Modal>

      {/* Delete Tenant Confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => !isSubmitting && setDeleteTarget(null)} title="Delete Tenant" maxWidth="440px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget?.full_name}</strong>? All their property assignments and payment history will be permanently removed.
          </p>
          <ModalActionButtons 
            onCancel={() => setDeleteTarget(null)} 
            submitText="Delete"
            isSubmitting={isSubmitting} 
            isDanger={true}
            customSubmitAction={handleDeleteTenant}
          />
        </div>
      </Modal>

      {/* Payment Ledger Drawer */}
      {paymentLedgerTarget && (
        <TenantHistoryDrawer
          assignmentId={paymentLedgerTarget.assignmentId}
          tenantName={paymentLedgerTarget.tenantName}
          propertyName={paymentLedgerTarget.propertyName}
          unitNumber={paymentLedgerTarget.unitNumber}
          currentRent={paymentLedgerTarget.currentRent}
          backendBalance={paymentLedgerBalance}
          gstRate={paymentLedgerTarget.gstRate}
          tdsRate={paymentLedgerTarget.tdsRate}
          onClose={() => setPaymentLedgerTarget(null)}
        />
      )}

      {/* Print Agreement Slip */}
      {agreementSlipTarget && (
        <AgreementSlipModal
          isOpen={true}
          onClose={() => setAgreementSlipTarget(null)}
          lessorName={currentProfile?.full_name || 'RentBook Admin'}
          lessorPhone={currentProfile?.phone_number}
          lesseeName={agreementSlipTarget.tenant.full_name}
          lesseePhone={agreementSlipTarget.tenant.phone}
          propertyLabel={`${agreementSlipTarget.assignment.properties?.name || 'Property'}, Unit ${agreementSlipTarget.assignment.unit_number}`}
          effectiveDate={agreementSlipTarget.assignment.lease_start}
          leaseEndDate={agreementSlipTarget.assignment.lease_end}
          monthlyRent={getEffectiveRentAsOf(agreementSlipTarget.assignment)}
          securityDeposit={agreementSlipTarget.assignment.security_deposit}
        />
      )}
    </>
  );
};
