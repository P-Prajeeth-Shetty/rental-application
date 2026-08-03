import React, { useState, useEffect } from 'react';
import './views.css';
import { Search, Plus, X, Pencil, Trash2, Home, IndianRupee, UserPlus, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CustomSelect } from '../components/ui/CustomSelect';

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
  properties: { id: string; name: string } | null;
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

type Tab = 'tenants' | 'rent';

export const TenantsView: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [assignmentsMap, setAssignmentsMap] = useState<Record<string, Assignment[]>>({});
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('tenants');

  // Tenant modals
  const [tenantModal, setTenantModal] = useState<'create' | 'edit' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenantForm, setTenantForm] = useState({ id: '', full_name: '', email: '', phone: '', id_proof_type: '', id_proof_number: '', emergency_contact: '', notes: '' });
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);

  // Assign modal
  const [assignModal, setAssignModal] = useState<Tenant | null>(null);
  const [assignForm, setAssignForm] = useState({ property_id: '', unit_number: '', current_rent: '', lease_start: '', lease_end: '', security_deposit: '', payment_mode: 'prepaid', due_day: '1', grace_days: '5' });

  // Expanded rows
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);

  // Rent increase modal
  const [rentModal, setRentModal] = useState<Assignment | null>(null);
  const [rentForm, setRentForm] = useState({ increase_pct: '', effective_from: '', reason: '' });

  // Rent revision history
  const [revisionTarget, setRevisionTarget] = useState<Assignment | null>(null);
  const [revisions, setRevisions] = useState<RentRevision[]>([]);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [{ data: tData, error: tErr }, { data: aData, error: aErr }, { data: pData, error: pErr }] = await Promise.all([
        supabase.from('tenants').select('*').order('created_at', { ascending: false }),
        supabase.from('tenant_assignments').select('*, properties(id, name)').order('created_at', { ascending: false }),
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
    setAssignForm({ property_id: properties[0]?.id || '', unit_number: '', current_rent: '', lease_start: '', lease_end: '', security_deposit: '', payment_mode: 'prepaid', due_day: '1', grace_days: '5' });
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModal) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('tenant_assignments').insert([{
        tenant_id: assignModal.id,
        property_id: assignForm.property_id,
        unit_number: assignForm.unit_number,
        current_rent: parseFloat(assignForm.current_rent) || 0,
        lease_start: assignForm.lease_start,
        lease_end: assignForm.lease_end || null,
        security_deposit: parseFloat(assignForm.security_deposit) || 0,
        payment_mode: assignForm.payment_mode,
        due_day: parseInt(assignForm.due_day) || 1,
        grace_days: parseInt(assignForm.grace_days) || 5,
        status: 'active'
      }]);
      if (error) throw error;
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

  const computedNewRent = rentModal ? Math.round(rentModal.current_rent * (1 + (parseFloat(rentForm.increase_pct) || 0) / 100) * 100) / 100 : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 className="view-title" style={{ margin: 0 }}>Tenants & Rent</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Search size={16} color="var(--text-secondary)" />
            <input type="text" placeholder="Search tenants..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'white', width: '160px' }} />
          </div>
          <button className="btn btn-primary" onClick={openCreateTenant} style={{ display: 'flex', gap: '6px', alignItems: 'center', borderRadius: '20px' }}>
            <Plus size={16} /> Add Tenant
          </button>
        </div>
      </div>

      {error && <div style={{ backgroundColor: 'rgba(255,0,0,0.1)', color: '#ff4d4d', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}

      {/* ── Table ── */}
      <div className="surface-card glass-card" style={{ padding: 0, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading tenants...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500, width: '30px' }}></th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Tenant</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Phone</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Property</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Unit</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Rent</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'right' }}>Actions</th>
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
                      <td style={{ padding: '14px 16px', fontWeight: 500 }}>{activeAssign ? `₹${Number(activeAssign.current_rent).toLocaleString('en-IN')}` : '—'}</td>
                      <td style={{ padding: '14px 16px' }}>
                        {activeAssign ? (
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500, backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }}>Active</span>
                        ) : assigns.length > 0 ? (
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500, backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Vacated</span>
                        ) : (
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500, backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>New</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button onClick={() => openAssignModal(t)} title="Assign to Property" style={{ background: 'rgba(16,185,129,0.15)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#10b981', display: 'flex', alignItems: 'center' }}>
                            <Home size={14} />
                          </button>
                          <button onClick={() => openEditTenant(t)} title="Edit" style={{ background: 'rgba(59,130,246,0.15)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center' }}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeleteTarget(t)} title="Delete" style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded: all assignments + rent actions */}
                    {isExpanded && assigns.map(a => (
                      <tr key={a.id} style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td></td>
                        <td colSpan={2} style={{ padding: '10px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {a.properties?.name} — Unit {a.unit_number}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: '0.85rem' }}>
                          {new Date(a.lease_start).toLocaleDateString()} — {a.lease_end ? new Date(a.lease_end).toLocaleDateString() : 'Ongoing'}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: '0.85rem' }}>
                          Deposit: ₹{Number(a.security_deposit).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '10px 16px', fontWeight: 500, fontSize: '0.85rem' }}>
                          ₹{Number(a.current_rent).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 500,
                            backgroundColor: a.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            color: a.status === 'active' ? '#10b981' : '#ef4444' }}>
                            {a.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button onClick={() => openRentModal(a)} title="Increase Rent" style={{ background: 'rgba(245,158,11,0.15)', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
                              <TrendingUp size={13} /> Increase
                            </button>
                            <button onClick={() => openRevisionHistory(a)} title="Rent History" style={{ background: 'rgba(59,130,246,0.1)', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#3b82f6', fontSize: '0.78rem' }}>
                              History
                            </button>
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
        <div className="modal-overlay" onClick={() => !isSubmitting && setTenantModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">{tenantModal === 'create' ? 'Add New Tenant' : 'Edit Tenant'}</h2>
              <button className="close-btn" onClick={() => setTenantModal(null)} disabled={isSubmitting}><X size={20} /></button>
            </div>
            <form onSubmit={handleTenantSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input type="text" className="form-input" value={tenantForm.full_name} onChange={e => setTenantForm({ ...tenantForm, full_name: e.target.value })} required placeholder="e.g. Alice Freeman" />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={tenantForm.email} onChange={e => setTenantForm({ ...tenantForm, email: e.target.value })} placeholder="alice@example.com" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Phone</label>
                  <input type="tel" className="form-input" value={tenantForm.phone} onChange={e => setTenantForm({ ...tenantForm, phone: e.target.value })} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">ID Proof Type</label>
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
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">ID Proof Number</label>
                  <input type="text" className="form-input" value={tenantForm.id_proof_number} onChange={e => setTenantForm({ ...tenantForm, id_proof_number: e.target.value })} placeholder="XXXX-XXXX-XXXX" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Emergency Contact</label>
                <input type="text" className="form-input" value={tenantForm.emergency_contact} onChange={e => setTenantForm({ ...tenantForm, emergency_contact: e.target.value })} placeholder="Name — Phone" />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea rows={2} className="form-input" value={tenantForm.notes} onChange={e => setTenantForm({ ...tenantForm, notes: e.target.value })} placeholder="Any additional notes..." />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setTenantModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : tenantModal === 'create' ? 'Add Tenant' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign to Property Modal */}
      {assignModal && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setAssignModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Assign {assignModal.full_name} to Property</h2>
              <button className="close-btn" onClick={() => setAssignModal(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAssign} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Property *</label>
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
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Unit Number *</label>
                  <input type="text" className="form-input" value={assignForm.unit_number} onChange={e => setAssignForm({ ...assignForm, unit_number: e.target.value })} placeholder="e.g. 4B" required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Monthly Rent (₹) *</label>
                  <input type="number" className="form-input" value={assignForm.current_rent} onChange={e => setAssignForm({ ...assignForm, current_rent: e.target.value })} placeholder="e.g. 15000" required min="0" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Lease Start *</label>
                  <input type="date" className="form-input" value={assignForm.lease_start} onChange={e => setAssignForm({ ...assignForm, lease_start: e.target.value })} required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Lease End</label>
                  <input type="date" className="form-input" value={assignForm.lease_end} onChange={e => setAssignForm({ ...assignForm, lease_end: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Security Deposit (₹)</label>
                <input type="number" className="form-input" value={assignForm.security_deposit} onChange={e => setAssignForm({ ...assignForm, security_deposit: e.target.value })} placeholder="e.g. 30000" min="0" />
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '10px', fontWeight: 500 }}>💳 Payment Terms</p>
                <div className="form-group">
                  <label className="form-label">Payment Mode *
                    <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '6px' }}>
                      (determines when rent is due)
                    </span>
                  </label>
                  <CustomSelect
                    value={assignForm.payment_mode}
                    onChange={(val) => setAssignForm({ ...assignForm, payment_mode: val })}
                    options={[
                      { value: 'prepaid', label: 'Prepaid — Pay at start of month (before occupying)' },
                      { value: 'postpaid', label: 'Postpaid — Pay at end of month (after occupying)' },
                      { value: 'advance_on_entry', label: 'Advance on Entry — First month on entry day, then prepaid' },
                    ]}
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Due Day of Month</label>
                    <input type="number" className="form-input" value={assignForm.due_day} min="1" max="28"
                      onChange={e => setAssignForm({ ...assignForm, due_day: e.target.value })} placeholder="1" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Grace Period (days)</label>
                    <input type="number" className="form-input" value={assignForm.grace_days} min="0" max="30"
                      onChange={e => setAssignForm({ ...assignForm, grace_days: e.target.value })} placeholder="5" />
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setAssignModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Assigning...' : 'Assign Tenant'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rent Increase Modal */}
      {rentModal && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setRentModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Increase Rent</h2>
              <button className="close-btn" onClick={() => setRentModal(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleRentIncrease} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '14px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Current Rent</span>
                  <span style={{ fontWeight: 600 }}>₹{Number(rentModal.current_rent).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>New Rent</span>
                  <span style={{ fontWeight: 600, color: '#10b981' }}>₹{computedNewRent.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Increase Percentage (%) *</label>
                <input type="number" step="0.01" className="form-input" value={rentForm.increase_pct} onChange={e => setRentForm({ ...rentForm, increase_pct: e.target.value })} placeholder="e.g. 10" required min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Effective From *</label>
                <input type="date" className="form-input" value={rentForm.effective_from} onChange={e => setRentForm({ ...rentForm, effective_from: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <input type="text" className="form-input" value={rentForm.reason} onChange={e => setRentForm({ ...rentForm, reason: e.target.value })} placeholder="e.g. Annual revision" />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setRentModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Apply Increase'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rent Revision History Modal */}
      {revisionTarget && (
        <div className="modal-overlay" onClick={() => setRevisionTarget(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Rent History — Unit {revisionTarget.unit_number}</h2>
              <button className="close-btn" onClick={() => setRevisionTarget(null)}><X size={20} /></button>
            </div>
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
          </div>
        </div>
      )}

      {/* Delete Tenant Confirmation */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setDeleteTarget(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: '#ef4444' }}>Delete Tenant</h2>
              <button className="close-btn" onClick={() => setDeleteTarget(null)}><X size={20} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', padding: '8px 4px 16px' }}>
              Are you sure you want to delete <strong style={{ color: 'white' }}>{deleteTarget.full_name}</strong>? All their property assignments and payment history will be permanently removed.
            </p>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleDeleteTenant} disabled={isSubmitting} style={{ background: '#ef4444', borderColor: '#ef4444' }}>
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
