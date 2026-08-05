import React, { useState, useEffect } from 'react';
import './views.css';
import { Home, Users, Plus, X, Pencil, Trash2, ChevronLeft, Building2, MapPin, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CustomSelect } from '../components/ui/CustomSelect';
import { 
  LiquidGlassOverlay, 
  LiquidGlassWindow, 
  LiquidGlassContent, 
  LiquidGlassInput, 
  LiquidGlassTextarea 
} from '../components/ui/LiquidGlassModal';
interface Property {
  id: string;
  name: string;
  address: string;
  total_units: number;
  property_type: string;
  description: string | null;
  image: string;
  created_at: string;
}

interface TenantAssignment {
  id: string;
  unit_number: string;
  current_rent: number;
  lease_start: string;
  lease_end: string | null;
  status: string;
  tenants: { id: string; full_name: string; phone: string | null; email: string | null } | null;
}

interface PropertyPayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  period_month: number;
  period_year: number;
  status: string;
  payment_timing: string;
  days_late: number;
  payment_type: string;
  assignment_id: string;
}

type ModalMode = 'create' | 'edit' | null;

export const PropertiesView: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [occupancyMap, setOccupancyMap] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    id: '', name: '', address: '', total_units: '', property_type: 'Residential', description: '', image: ''
  });

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);

  // Detail view
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [assignments, setAssignments] = useState<TenantAssignment[]>([]);
  const [propertyPayments, setPropertyPayments] = useState<PropertyPayment[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchProperties = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('properties').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setProperties(data || []);

      // Compute occupancy from active assignments
      const { data: assignData } = await supabase
        .from('tenant_assignments')
        .select('property_id')
        .eq('status', 'active');

      const map: Record<string, number> = {};
      (assignData || []).forEach(a => {
        map[a.property_id] = (map[a.property_id] || 0) + 1;
      });
      setOccupancyMap(map);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchProperties(); }, []);

  // ── Detail view ───────────────────────────────────────────────────────────

  const openDetail = async (prop: Property) => {
    setSelectedProperty(prop);
    setAssignments([]);
    setPropertyPayments([]);
    setLoadingDetail(true);
    try {
      // Step 1: fetch assignments for this property
      const { data: aData, error: aErr } = await supabase
        .from('tenant_assignments')
        .select('id, unit_number, current_rent, lease_start, lease_end, status, tenants(id, full_name, phone, email)')
        .eq('property_id', prop.id)
        .order('unit_number', { ascending: true });

      if (aErr) throw aErr;
      const fetchedAssignments = (aData as any) || [];
      setAssignments(fetchedAssignments);

      // Step 2: fetch payments for those assignments
      const assignmentIds = fetchedAssignments.map((a: any) => a.id);
      if (assignmentIds.length > 0) {
        const { data: pData, error: pErr } = await supabase
          .from('payments')
          .select('id, amount, payment_date, payment_method, period_month, period_year, status, payment_timing, days_late, payment_type, assignment_id')
          .in('assignment_id', assignmentIds)
          .order('payment_date', { ascending: false });

        if (pErr) throw pErr;
        setPropertyPayments((pData as PropertyPayment[]) || []);
      } else {
        setPropertyPayments([]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const openCreateModal = () => {
    setFormData({ id: '', name: '', address: '', total_units: '', property_type: 'Residential', description: '', image: '' });
    setModalMode('create');
  };

  const openEditModal = (p: Property) => {
    setFormData({
      id: p.id, name: p.name, address: p.address,
      total_units: String(p.total_units), property_type: p.property_type || 'Residential',
      description: p.description || '', image: p.image || ''
    });
    setModalMode('edit');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: formData.name,
        address: formData.address,
        total_units: parseInt(formData.total_units) || 0,
        property_type: formData.property_type,
        description: formData.description || null,
        image: formData.image || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=400',
      };

      if (modalMode === 'create') {
        const { error } = await supabase.from('properties').insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('properties').update(payload).eq('id', formData.id);
        if (error) throw error;
      }
      setModalMode(null);
      fetchProperties();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('properties').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setDeleteTarget(null);
      if (selectedProperty?.id === deleteTarget.id) setSelectedProperty(null);
      fetchProperties();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render: Detail View ───────────────────────────────────────────────────

  if (selectedProperty) {
    const occupied = occupancyMap[selectedProperty.id] || 0;
    const pct = selectedProperty.total_units > 0 ? Math.round((occupied / selectedProperty.total_units) * 100) : 0;

    // Earnings stats
    const activeAssignments = assignments.filter(a => a.status === 'active');
    const expectedMonthly = activeAssignments.reduce((s, a) => s + Number(a.current_rent), 0);
    const totalCollected = propertyPayments.reduce((s, p) => s + Number(p.amount), 0);
    const totalPayments = propertyPayments.length;
    const onTimePayments = propertyPayments.filter(p => p.payment_timing === 'on_time' || p.payment_timing === 'early').length;
    const latePayments = propertyPayments.filter(p => p.payment_timing === 'late').length;
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // Map assignment_id → tenant name + unit for the payment table
    const assignmentLookup: Record<string, { name: string; unit: string }> = {};
    assignments.forEach(a => {
      assignmentLookup[a.id] = { name: a.tenants?.full_name || '—', unit: a.unit_number };
    });

    return (
      <div className="view-container">
        <button onClick={() => setSelectedProperty(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '16px', fontSize: '0.95rem' }}>
          <ChevronLeft size={18} /> Back to Properties
        </button>

        <div className="surface-card glass-card" style={{ padding: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <img src={selectedProperty.image} alt={selectedProperty.name} style={{ width: '200px', height: '160px', objectFit: 'cover', borderRadius: '12px', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: '250px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: '0 0 4px' }}>{selectedProperty.name}</h2>
                <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={14} /> {selectedProperty.address}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => openEditModal(selectedProperty)} style={{ background: 'rgba(59,130,246,0.15)', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                  <Pencil size={14} /> Edit
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '24px', marginTop: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={16} color="var(--text-secondary)" />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{selectedProperty.property_type}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Home size={16} color="var(--text-secondary)" />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{selectedProperty.total_units} Units</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} color="var(--text-secondary)" />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{occupied} Occupied ({pct}%)</span>
              </div>
            </div>
            {selectedProperty.description && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '12px' }}>{selectedProperty.description}</p>
            )}
          </div>
        </div>

        {/* ── Earnings Summary ─────────────────────────────────────────── */}
        <h3 style={{ marginTop: '24px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <TrendingUp size={18} /> Property Earnings
        </h3>
        <div style={{ display: 'flex', gap: '14px', marginBottom: '20px', flexWrap: 'wrap', flexShrink: 0 }}>
          {[
            { label: 'Total Collected', value: `₹${totalCollected.toLocaleString('en-IN')}`, color: '#10b981' },
            { label: 'Expected / Month', value: `₹${expectedMonthly.toLocaleString('en-IN')}`, color: 'var(--text-primary)' },
            { label: 'Total Payments', value: String(totalPayments), color: '#3b82f6' },
            { label: 'On Time / Early', value: String(onTimePayments), color: '#10b981' },
            { label: 'Late Payments', value: String(latePayments), color: latePayments > 0 ? '#ef4444' : 'var(--text-secondary)' },
          ].map(s => (
            <div key={s.label} className="surface-card glass-card" style={{ flex: 1, minWidth: '140px', padding: '16px 18px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '4px' }}>{s.label}</p>
              <p style={{ fontSize: '1.2rem', fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tenant Assignments Table */}
        <h3 style={{ marginTop: '24px', marginBottom: '12px', flexShrink: 0 }}>Tenants in this Property</h3>
        <div className="surface-card glass-card" style={{ padding: 0, overflow: 'auto', flexShrink: 0 }}>
          {loadingDetail ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading tenants...</div>
          ) : (
            <>
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Tenant</th>
                  <th>Phone</th>
                  <th>Rent</th>
                  <th>Lease Period</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(a => (
                  <tr key={a.id}>
                    <td>{a.unit_number}</td>
                    <td>{a.tenants?.full_name || '—'}</td>
                    <td>{a.tenants?.phone || '—'}</td>
                    <td>₹{Number(a.current_rent).toLocaleString('en-IN')}</td>
                    <td>
                      {new Date(a.lease_start).toLocaleDateString()} — {a.lease_end ? new Date(a.lease_end).toLocaleDateString() : 'Ongoing'}
                    </td>
                    <td>
                      <span className="status-badge" style={{
                        backgroundColor: a.status === 'active' ? 'rgba(16,185,129,0.15)' : a.status === 'vacated' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                        color: a.status === 'active' ? '#10b981' : a.status === 'vacated' ? '#ef4444' : '#f59e0b'
                      }}>
                        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
                {assignments.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No tenants assigned to this property yet.</td></tr>
                ) : null}
              </tbody>
            </table>
            </>
          )}
        </div>

        {/* ── Payment History Table ─────────────────────────────────────── */}
        <h3 style={{ marginBottom: '12px', flexShrink: 0 }}>Payment Records</h3>
        <div className="surface-card glass-card" style={{ padding: 0, overflow: 'auto', flexShrink: 0 }}>
          {propertyPayments.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No payments recorded for this property yet.</div>
          ) : (
            <>
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Unit</th>
                  <th>Period</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Timing</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {propertyPayments.map(p => {
                  const lookup = assignmentLookup[p.assignment_id] || { name: '—', unit: '—' };
                  const timingStyles: Record<string, { bg: string; color: string; label: string }> = {
                    early: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: 'Early' },
                    on_time: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: 'On Time' },
                    late: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: `Late +${p.days_late}d` },
                    unknown: { bg: 'transparent', color: 'var(--text-secondary)', label: '—' },
                  };
                  const ts = timingStyles[p.payment_timing] || timingStyles.unknown;
                  
                  const commonBadgeStyle = {
                    display: 'inline-block',
                    width: '80px',
                    textAlign: 'center' as const,
                    fontSize: '0.75rem',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap' as const
                  };

                  return (
                    <tr key={p.id}>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>{lookup.name}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{lookup.unit}</td>
                      <td style={{ padding: '12px 16px' }}>{monthNames[p.period_month - 1]} {p.period_year}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#10b981' }}>₹{Number(p.amount).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 16px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding: '12px 16px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{p.payment_method || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ ...commonBadgeStyle, background: ts.bg, color: ts.color }}>
                          {ts.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          ...commonBadgeStyle, 
                          background: p.payment_type !== 'rent' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.1)', 
                          color: p.payment_type !== 'rent' ? '#f59e0b' : 'var(--text-secondary)',
                          textTransform: 'capitalize' 
                        }}>
                          {p.payment_type.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </>
          )}
        </div>

        {/* Modals still accessible from detail view */}
        {renderFormModal()}
      </div>
    );
  }

  // ── Render: Form Modal (shared for create/edit) ───────────────────────────

  function renderFormModal() {
    if (!modalMode) return null;
    return (
      <LiquidGlassOverlay onClose={() => !isSubmitting && setModalMode(null)}>
        <LiquidGlassWindow>
          <div className="lg-modal-header">
            <h2 className="modal-title">{modalMode === 'create' ? 'Add New Property' : 'Edit Property'}</h2>
            <button className="lg-close-btn" onClick={() => setModalMode(null)} disabled={isSubmitting}><X size={20} /></button>
          </div>
          <LiquidGlassContent>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <LiquidGlassInput 
                label="Property Name *" 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                placeholder="e.g. Sunset Apartments" 
                required 
              />
              <LiquidGlassInput 
                label="Address *" 
                value={formData.address} 
                onChange={e => setFormData({ ...formData, address: e.target.value })} 
                placeholder="e.g. 123 Main St, City" 
                required 
              />
              <div style={{ display: 'flex', gap: '14px' }}>
                <div style={{ flex: 1 }}>
                  <LiquidGlassInput 
                    type="number" 
                    label="Total Units *" 
                    value={formData.total_units} 
                    onChange={e => setFormData({ ...formData, total_units: e.target.value })} 
                    placeholder="e.g. 20" 
                    required 
                    min="1" 
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="lg-input-group">
                    <label className="lg-input-label">Property Type</label>
                    <div className="lg-input-wrapper">
                      <CustomSelect
                        value={formData.property_type}
                        onChange={(val) => setFormData({ ...formData, property_type: val })}
                        options={[
                          { value: 'Residential', label: 'Residential' },
                          { value: 'Commercial', label: 'Commercial' },
                          { value: 'Mixed', label: 'Mixed' }
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <LiquidGlassTextarea 
                label="Description" 
                rows={2} 
                value={formData.description} 
                onChange={e => setFormData({ ...formData, description: e.target.value })} 
                placeholder="Brief description of the property..." 
              />
              <LiquidGlassInput 
                label="Image URL" 
                value={formData.image} 
                onChange={e => setFormData({ ...formData, image: e.target.value })} 
                placeholder="https://example.com/image.jpg" 
              />
              <div className="lg-actions">
                <button type="button" className="lg-btn lg-btn-secondary" onClick={() => setModalMode(null)} disabled={isSubmitting}>Cancel</button>
                <button type="submit" className="lg-btn lg-btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : modalMode === 'create' ? 'Add Property' : 'Save Changes'}</button>
              </div>
            </form>
          </LiquidGlassContent>
        </LiquidGlassWindow>
      </LiquidGlassOverlay>
    );
  }

  // ── Render: Grid View ─────────────────────────────────────────────────────

  return (
    <div className="view-container">
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="view-title" style={{ margin: 0 }}>Properties</h1>
        {error && <div style={{ color: '#ff4d4d', fontSize: '0.9rem' }}>{error}</div>}
      </div>

      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading properties...</div>
      ) : (
        <div className="properties-grid">
          {properties.map(prop => {
            const occupied = occupancyMap[prop.id] || 0;
            const pct = prop.total_units > 0 ? Math.round((occupied / prop.total_units) * 100) : 0;
            return (
              <div key={prop.id} className="surface-card glass-card property-card" style={{ cursor: 'pointer', position: 'relative' }} onClick={() => openDetail(prop)}>
                <img src={prop.image || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=400'} alt={prop.name} className="property-image" />
                <div className="property-info">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 className="property-title">{prop.name}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>{prop.address}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEditModal(prop)} title="Edit" style={{ background: 'rgba(59,130,246,0.15)', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#3b82f6' }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(prop)} title="Delete" style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#ef4444' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '14px', marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Home size={14} /> {prop.total_units} Units</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={14} /> {occupied} Tenants</span>
                    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.15)' }}>{prop.property_type}</span>
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span>Occupancy</span>
                      <span style={{ fontWeight: 600 }}>{pct}%</span>
                    </div>
                    <div className="progress-bar-container" style={{ height: '5px' }}>
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add Property Card */}
          <div className="surface-card glass-card" onClick={openCreateModal}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: '280px', border: '2px dashed rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', gap: '16px', transition: 'all 0.3s ease' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={32} />
            </div>
            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Add Property</span>
          </div>
        </div>
      )}

      {renderFormModal()}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <LiquidGlassOverlay onClose={() => !isSubmitting && setDeleteTarget(null)}>
          <LiquidGlassWindow className="delete-modal-window">
            <div className="lg-modal-header">
              <h2 className="modal-title" style={{ color: '#ef4444' }}>Delete Property</h2>
              <button className="lg-close-btn" onClick={() => setDeleteTarget(null)}><X size={20} /></button>
            </div>
            <LiquidGlassContent>
              <div style={{ padding: '8px 4px 10px' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                  Are you sure you want to delete <strong style={{ color: 'white' }}>{deleteTarget.name}</strong>? All tenant assignments linked to this property will also be removed.
                </p>
                <div className="lg-actions" style={{ marginTop: '24px' }}>
                  <button className="lg-btn lg-btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
                  <button className="lg-btn lg-btn-primary" onClick={handleDelete} disabled={isSubmitting} style={{ background: '#ef4444', color: 'white' }}>
                    {isSubmitting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </LiquidGlassContent>
          </LiquidGlassWindow>
        </LiquidGlassOverlay>
      )}
    </div>
  );
};
