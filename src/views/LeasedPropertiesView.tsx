import React, { useState, useEffect } from 'react';
import './views.css';
import { Plus, Pencil, Trash2, Building2, User, FileText, IndianRupee, ChevronLeft, MapPin, Home, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Modal, ModalInput, ModalTextarea, ModalActionButtons } from '../components/ui/Modal';
import { AgreementSlipModal } from '../components/agreement/AgreementSlipModal';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import type { Landlord, LeasedProperty, LeaseAgreement, OutgoingPayment } from '../types/leased';

type Tab = 'properties' | 'landlords' | 'agreements' | 'payments';
type ModalMode = 'create' | 'edit' | null;

export const LeasedPropertiesView: React.FC<{ searchQuery: string, filterType?: string }> = ({ searchQuery, filterType = 'All' }) => {
  const [selectedProperty, setSelectedProperty] = useState<LeasedProperty | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('properties');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [properties, setProperties] = useState<LeasedProperty[]>([]);
  const [agreements, setAgreements] = useState<LeaseAgreement[]>([]);
  const [payments, setPayments] = useState<OutgoingPayment[]>([]);
  const searchTerm = searchQuery;

  // Modals
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [modalType, setModalType] = useState<Tab | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: Tab, id: string, name: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Generic form data state
  const [formData, setFormData] = useState<any>({});

  // Print agreement slip
  const [agreementSlipTarget, setAgreementSlipTarget] = useState<LeaseAgreement | null>(null);
  const currentProfile = useCurrentProfile();

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [landlordsRes, propsRes, agreementsRes, paymentsRes] = await Promise.all([
        supabase.from('landlords').select('*').order('created_at', { ascending: false }),
        supabase.from('leased_properties').select('*').order('created_at', { ascending: false }),
        supabase.from('lease_agreements').select('*').order('created_at', { ascending: false }),
        supabase.from('outgoing_payments').select('*').order('payment_date', { ascending: false })
      ]);

      if (landlordsRes.error) throw landlordsRes.error;
      if (propsRes.error) throw propsRes.error;
      if (agreementsRes.error) throw agreementsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      setLandlords(landlordsRes.data || []);
      setProperties(propsRes.data || []);
      setAgreements(agreementsRes.data || []);
      setPayments(paymentsRes.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (type: Tab, mode: ModalMode, data?: any) => {
    setModalType(type);
    setModalMode(mode);
    if (mode === 'edit' && data) {
      setFormData(data);
    } else {
      // Default empty values based on type
      if (type === 'landlords') {
        setFormData({ full_name: '', email: '', phone: '', pan_number: '', gst_number: '', bank_account_name: '', bank_account_number: '', bank_ifsc: '', bank_name: '', notes: '' });
      } else if (type === 'properties') {
        setFormData({ name: '', address: '', landlord_id: '', property_type: 'Commercial', total_units: 1, description: '' });
      } else if (type === 'agreements') {
        setFormData({ property_id: '', start_date: '', end_date: '', rent_amount: '', security_deposit: '', status: 'active' });
      } else if (type === 'payments') {
        setFormData({ agreement_id: '', amount: '', payment_type: 'rent', payment_date: new Date().toISOString().split('T')[0], payment_method: 'Bank Transfer', reference_number: '', notes: '' });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalType || !modalMode) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      let table = '';
      if (modalType === 'landlords') table = 'landlords';
      else if (modalType === 'properties') table = 'leased_properties';
      else if (modalType === 'agreements') table = 'lease_agreements';
      else if (modalType === 'payments') table = 'outgoing_payments';

      if (modalMode === 'create') {
        const { error } = await supabase.from(table).insert([formData]);
        if (error) throw error;
      } else {
        const { id, created_at, ...updateData } = formData;
        const { error } = await supabase.from(table).update(updateData).eq('id', id);
        if (error) throw error;
      }
      
      setModalMode(null);
      setModalType(null);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsLoading(true);
    try {
      let table = '';
      if (deleteTarget.type === 'landlords') table = 'landlords';
      else if (deleteTarget.type === 'properties') table = 'leased_properties';
      else if (deleteTarget.type === 'agreements') table = 'lease_agreements';
      else if (deleteTarget.type === 'payments') table = 'outgoing_payments';

      const { error } = await supabase.from(table).delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  // Helper to find landlord name
  const getLandlordName = (id: string) => landlords.find(l => l.id === id)?.full_name || 'Unknown';
  // Helper to find property name
  const getPropertyName = (id: string) => properties.find(p => p.id === id)?.name || 'Unknown';
  // Helper to find the landlord who owns the property behind an agreement
  const getLandlordForAgreement = (agreement: LeaseAgreement) => {
    const property = properties.find(p => p.id === agreement.property_id);
    return property ? landlords.find(l => l.id === property.landlord_id) : undefined;
  };

  const filteredProperties = properties.filter(p => {
    const typeMatch = filterType === 'All' || p.property_type === filterType;
    const searchMatch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.address.toLowerCase().includes(searchTerm.toLowerCase());
    return typeMatch && searchMatch;
  });
  
  const filteredLandlords = landlords.filter(l => 
    l.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (l.email && l.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (l.phone && l.phone.includes(searchTerm))
  );

  const filteredAgreements = agreements.filter(a => {
    const propName = getPropertyName(a.property_id).toLowerCase();
    return propName.includes(searchTerm.toLowerCase()) || a.status.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredPayments = payments.filter(p => {
    const agreement = agreements.find(a => a.id === p.agreement_id);
    const propName = agreement ? getPropertyName(agreement.property_id).toLowerCase() : 'unknown';
    return propName.includes(searchTerm.toLowerCase()) || 
           (p.reference_number && p.reference_number.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div style={{ padding: '0' }}>
      {error && <div style={{ color: '#ef4444', marginBottom: '16px', background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '8px' }}>{error}</div>}

      <div className="tabs" style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto' }}>
        <button className={`tab-btn ${activeTab === 'properties' ? 'active' : ''}`} onClick={() => setActiveTab('properties')}
          style={{ background: activeTab === 'properties' ? 'rgba(15,118,110,0.1)' : 'transparent', border: '1px solid', borderColor: activeTab === 'properties' ? 'rgba(15,118,110,0.3)' : 'var(--border-color)', borderRadius: '6px', padding: '6px 12px', color: activeTab === 'properties' ? '#0f766e' : 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', fontSize: '0.85rem' }}>
          <Building2 size={16}/> Properties
        </button>
        <button className={`tab-btn ${activeTab === 'landlords' ? 'active' : ''}`} onClick={() => setActiveTab('landlords')}
          style={{ background: activeTab === 'landlords' ? 'rgba(15,118,110,0.1)' : 'transparent', border: '1px solid', borderColor: activeTab === 'landlords' ? 'rgba(15,118,110,0.3)' : 'var(--border-color)', borderRadius: '6px', padding: '6px 12px', color: activeTab === 'landlords' ? '#0f766e' : 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', fontSize: '0.85rem' }}>
          <User size={16}/> Landlords
        </button>
        <button className={`tab-btn ${activeTab === 'agreements' ? 'active' : ''}`} onClick={() => setActiveTab('agreements')}
          style={{ background: activeTab === 'agreements' ? 'rgba(15,118,110,0.1)' : 'transparent', border: '1px solid', borderColor: activeTab === 'agreements' ? 'rgba(15,118,110,0.3)' : 'var(--border-color)', borderRadius: '6px', padding: '6px 12px', color: activeTab === 'agreements' ? '#0f766e' : 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', fontSize: '0.85rem' }}>
          <FileText size={16}/> Agreements
        </button>
        <button className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}
          style={{ background: activeTab === 'payments' ? 'rgba(15,118,110,0.1)' : 'transparent', border: '1px solid', borderColor: activeTab === 'payments' ? 'rgba(15,118,110,0.3)' : 'var(--border-color)', borderRadius: '6px', padding: '6px 12px', color: activeTab === 'payments' ? '#0f766e' : 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', fontSize: '0.85rem' }}>
          <IndianRupee size={16}/> Payments Out
        </button>
      </div>

      <div className="tab-content">
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading data...</div>
        ) : selectedProperty ? (
          <div style={{ padding: 0 }}>
            <button onClick={() => setSelectedProperty(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '16px', fontSize: '0.95rem' }}>
              <ChevronLeft size={18} /> Back to Properties
            </button>
            <div className="surface-card glass-card" style={{ padding: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '24px' }}>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: '0 0 4px' }}>{selectedProperty.name}</h2>
                    <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={14} /> {selectedProperty.address}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleOpenModal('properties', 'edit', selectedProperty)} style={{ background: 'rgba(59,130,246,0.15)', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
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
                    <User size={16} color="var(--text-secondary)" />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Landlord: {getLandlordName(selectedProperty.landlord_id)}</span>
                  </div>
                </div>
              </div>
            </div>

            <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', color: 'var(--text-primary)' }}>Lease Agreements</h3>
            <div className="surface-card static-card glass-card" style={{ padding: 0, overflow: 'auto', marginBottom: '24px' }}>
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Rent/Lease Amount</th>
                    <th>Deposit</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agreements.filter(a => a.property_id === selectedProperty.id).map(a => (
                    <tr key={a.id}>
                      <td>{a.start_date}</td>
                      <td>{a.end_date || 'Ongoing'}</td>
                      <td style={{ color: '#10b981', fontWeight: 600 }}>₹{Number(a.rent_amount).toLocaleString('en-IN')}</td>
                      <td>₹{Number(a.security_deposit).toLocaleString('en-IN')}</td>
                      <td>
                        <span className="status-badge" style={{ backgroundColor: a.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: a.status === 'active' ? '#10b981' : '#ef4444' }}>
                          {a.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => setAgreementSlipTarget(a)} title="Print Agreement Slip" style={{ background: 'rgba(124,58,237,0.15)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#7c3aed' }}><Printer size={14}/></button>
                      </td>
                    </tr>
                  ))}
                  {agreements.filter(a => a.property_id === selectedProperty.id).length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>No agreements found.</td></tr>}
                </tbody>
              </table>
            </div>

            <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', color: 'var(--text-primary)' }}>Payments Out</h3>
            <div className="surface-card static-card glass-card" style={{ padding: 0, overflow: 'auto' }}>
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Method / Ref</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.filter(p => agreements.some(a => a.id === p.agreement_id && a.property_id === selectedProperty.id)).map(p => (
                    <tr key={p.id}>
                      <td style={{ color: '#ef4444', fontWeight: 600 }}>-₹{Number(p.amount).toLocaleString('en-IN')}</td>
                      <td style={{ textTransform: 'capitalize' }}>{p.payment_type}</td>
                      <td>{p.payment_date}</td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>{p.payment_method || '—'}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{p.reference_number || '—'}</div>
                      </td>
                      <td>
                        <span className="status-badge" style={{ backgroundColor: p.status === 'paid' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: p.status === 'paid' ? '#10b981' : '#f59e0b' }}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {payments.filter(p => agreements.some(a => a.id === p.agreement_id && a.property_id === selectedProperty.id)).length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>No payments found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>
            {/* PROPERTIES TAB */}
            {activeTab === 'properties' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px', gap: '10px' }}>

                    <button className="btn btn-primary" onClick={() => handleOpenModal('properties', 'create')} style={{ display: 'flex', gap: '6px', alignItems: 'center', borderRadius: '20px' }}>
                      <Plus size={16}/> Add Property
                    </button>
                  </div>
                <div className="properties-grid">
                  {filteredProperties.map(p => (
                    <div key={p.id} className="surface-card glass-card property-card" onClick={() => setSelectedProperty(p)} style={{ cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column', padding: '20px', minHeight: '180px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3 className="property-title">{p.name}</h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '8px' }}>{p.address}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleOpenModal('properties', 'edit', p)} style={{ background: 'rgba(59,130,246,0.15)', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#3b82f6' }}><Pencil size={14}/></button>
                          <button onClick={() => setDeleteTarget({ type: 'properties', id: p.id, name: p.name })} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14}/></button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Building2 size={14} /> {p.total_units} Units</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={14} /> {getLandlordName(p.landlord_id)}</span>
                      </div>
                      <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                         <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>{p.property_type}</span>
                      </div>
                    </div>
                  ))}
                  {filteredProperties.length === 0 && <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>{searchTerm ? 'No properties found matching your search.' : 'No leased properties found.'}</div>}
                </div>
              </div>
            )}

            {/* LANDLORDS TAB */}
            {activeTab === 'landlords' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px', gap: '10px' }}>

                    <button className="btn btn-primary" onClick={() => handleOpenModal('landlords', 'create')} style={{ display: 'flex', gap: '6px', alignItems: 'center', borderRadius: '20px' }}>
                      <Plus size={16}/> Add Landlord
                    </button>
                  </div>
                <div className="surface-card static-card glass-card" style={{ padding: 0, overflow: 'auto' }}>
                  <table className="glass-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Contact</th>
                        <th>PAN/GST</th>
                        <th>Bank Details</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLandlords.map(l => (
                        <tr key={l.id}>
                          <td><strong>{l.full_name}</strong></td>
                          <td>
                            <div style={{ fontSize: '0.85rem' }}>{l.phone || '—'}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{l.email || '—'}</div>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.85rem' }}>PAN: {l.pan_number || '—'}</div>
                            <div style={{ fontSize: '0.85rem' }}>GST: {l.gst_number || '—'}</div>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.85rem' }}>{l.bank_name || '—'}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>A/c: {l.bank_account_number || '—'}</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => handleOpenModal('landlords', 'edit', l)} style={{ background: 'rgba(59,130,246,0.15)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#3b82f6' }}><Pencil size={14}/></button>
                              <button onClick={() => setDeleteTarget({ type: 'landlords', id: l.id, name: l.full_name })} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#ef4444' }}><Trash2 size={14}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredLandlords.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>{searchTerm ? 'No landlords found matching your search.' : 'No landlords found.'}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* AGREEMENTS TAB */}
            {activeTab === 'agreements' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px', gap: '10px' }}>

                    <button className="btn btn-primary" onClick={() => handleOpenModal('agreements', 'create')} style={{ display: 'flex', gap: '6px', alignItems: 'center', borderRadius: '20px' }}>
                      <Plus size={16}/> New Agreement
                    </button>
                  </div>
                <div className="surface-card static-card glass-card" style={{ padding: 0, overflow: 'auto' }}>
                  <table className="glass-table">
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Rent/Lease Amount</th>
                        <th>Deposit</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAgreements.map(a => (
                        <tr key={a.id}>
                          <td><strong>{getPropertyName(a.property_id)}</strong></td>
                          <td>{a.start_date}</td>
                          <td>{a.end_date || 'Ongoing'}</td>
                          <td style={{ color: '#10b981', fontWeight: 600 }}>₹{Number(a.rent_amount).toLocaleString('en-IN')}</td>
                          <td>₹{Number(a.security_deposit).toLocaleString('en-IN')}</td>
                          <td>
                            <span className="status-badge" style={{ backgroundColor: a.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: a.status === 'active' ? '#10b981' : '#ef4444' }}>
                              {a.status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => setAgreementSlipTarget(a)} title="Print Agreement Slip" style={{ background: 'rgba(124,58,237,0.15)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#7c3aed' }}><Printer size={14}/></button>
                              <button onClick={() => handleOpenModal('agreements', 'edit', a)} style={{ background: 'rgba(59,130,246,0.15)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#3b82f6' }}><Pencil size={14}/></button>
                              <button onClick={() => setDeleteTarget({ type: 'agreements', id: a.id, name: 'this agreement' })} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#ef4444' }}><Trash2 size={14}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredAgreements.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>{searchTerm ? 'No agreements found matching your search.' : 'No agreements found.'}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PAYMENTS TAB */}
            {activeTab === 'payments' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px', gap: '10px' }}>

                    <button className="btn btn-primary" onClick={() => handleOpenModal('payments', 'create')} style={{ display: 'flex', gap: '6px', alignItems: 'center', borderRadius: '20px' }}>
                      <Plus size={16}/> Record Payment
                    </button>
                  </div>
                <div className="surface-card static-card glass-card" style={{ padding: 0, overflow: 'auto' }}>
                  <table className="glass-table">
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th>Amount</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Method / Ref</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.map(p => {
                        const agreement = agreements.find(a => a.id === p.agreement_id);
                        const propName = agreement ? getPropertyName(agreement.property_id) : 'Unknown';
                        return (
                          <tr key={p.id}>
                            <td><strong>{propName}</strong></td>
                            <td style={{ color: '#ef4444', fontWeight: 600 }}>-₹{Number(p.amount).toLocaleString('en-IN')}</td>
                            <td style={{ textTransform: 'capitalize' }}>{p.payment_type}</td>
                            <td>{p.payment_date}</td>
                            <td>
                              <div style={{ fontSize: '0.85rem' }}>{p.payment_method || '—'}</div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{p.reference_number || '—'}</div>
                            </td>
                            <td>
                              <span className="status-badge" style={{ backgroundColor: p.status === 'paid' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: p.status === 'paid' ? '#10b981' : '#f59e0b' }}>
                                {p.status.toUpperCase()}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleOpenModal('payments', 'edit', p)} style={{ background: 'rgba(59,130,246,0.15)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#3b82f6' }}><Pencil size={14}/></button>
                                <button onClick={() => setDeleteTarget({ type: 'payments', id: p.id, name: 'this payment' })} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#ef4444' }}><Trash2 size={14}/></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredPayments.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>No payments found.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dynamic Form Modal */}
      <Modal isOpen={!!(modalMode && modalType)} onClose={() => !isSubmitting && setModalMode(null)} title={`${modalMode === 'create' ? 'Add ' : 'Edit '}${modalType === 'landlords' ? 'Landlord' : modalType === 'properties' ? 'Leased Property' : modalType === 'agreements' ? 'Agreement' : 'Outgoing Payment'}`}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Landlord Fields */}
          {modalType === 'landlords' && (
            <>
              <ModalInput label="Full Name *" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} required />
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}><ModalInput label="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                <div style={{ flex: 1 }}><ModalInput type="email" label="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}><ModalInput label="PAN Number" value={formData.pan_number} onChange={e => setFormData({...formData, pan_number: e.target.value})} /></div>
                <div style={{ flex: 1 }}><ModalInput label="GST Number" value={formData.gst_number} onChange={e => setFormData({...formData, gst_number: e.target.value})} /></div>
              </div>
              <h4 style={{ margin: '12px 0 4px', color: 'var(--text-primary)' }}>Bank Details</h4>
              <ModalInput label="Account Name" value={formData.bank_account_name} onChange={e => setFormData({...formData, bank_account_name: e.target.value})} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}><ModalInput label="Account Number" value={formData.bank_account_number} onChange={e => setFormData({...formData, bank_account_number: e.target.value})} /></div>
                <div style={{ flex: 1 }}><ModalInput label="Bank IFSC" value={formData.bank_ifsc} onChange={e => setFormData({...formData, bank_ifsc: e.target.value})} /></div>
              </div>
              <ModalInput label="Bank Name" value={formData.bank_name} onChange={e => setFormData({...formData, bank_name: e.target.value})} />
              <ModalTextarea label="Notes" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={2} />
            </>
          )}

          {/* Properties Fields */}
          {modalType === 'properties' && (
            <>
              <ModalInput label="Property Name *" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              <ModalInput label="Address *" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} required />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Landlord *</label>
                <div style={{ position: 'relative' }}>
                  <select value={formData.landlord_id} onChange={e => setFormData({...formData, landlord_id: e.target.value})} required style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none' }}>
                    <option value="" style={{ color: 'var(--text-primary)' }}>Select Landlord...</option>
                    {filteredLandlords.map(l => (
                      <option key={l.id} value={l.id} style={{ color: 'var(--text-primary)' }}>{l.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Property Type</label>
                    <div style={{ position: 'relative' }}>
                      <CustomSelect value={formData.property_type} onChange={val => setFormData({...formData, property_type: val})} options={[{value: 'Commercial', label: 'Commercial'}, {value: 'Residential', label: 'Residential'}]} />
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1 }}><ModalInput type="number" label="Total Units" value={formData.total_units} onChange={e => setFormData({...formData, total_units: parseInt(e.target.value)})} min="1" /></div>
              </div>
              <ModalTextarea label="Description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={2} />
            </>
          )}

          {/* Agreements Fields */}
          {modalType === 'agreements' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Leased Property *</label>
                <div style={{ position: 'relative' }}>
                  <select value={formData.property_id} onChange={e => setFormData({...formData, property_id: e.target.value})} required style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none' }}>
                    <option value="" style={{ color: 'var(--text-primary)' }}>Select Property...</option>
                    {filteredProperties.map(p => (
                      <option key={p.id} value={p.id} style={{ color: 'var(--text-primary)' }}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}><ModalInput type="date" label="Start Date *" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} required /></div>
                <div style={{ flex: 1 }}><ModalInput type="date" label="End Date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}><ModalInput type="number" label="Rent/Lease Amount *" value={formData.rent_amount} onChange={e => setFormData({...formData, rent_amount: parseFloat(e.target.value)})} required /></div>
                <div style={{ flex: 1 }}><ModalInput type="number" label="Security Deposit" value={formData.security_deposit} onChange={e => setFormData({...formData, security_deposit: parseFloat(e.target.value)})} /></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</label>
                <div style={{ position: 'relative' }}>
                  <CustomSelect value={formData.status} onChange={val => setFormData({...formData, status: val})} options={[{value: 'active', label: 'Active'}, {value: 'expired', label: 'Expired'}, {value: 'terminated', label: 'Terminated'}]} />
                </div>
              </div>
            </>
          )}

          {/* Payments Fields */}
          {modalType === 'payments' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agreement (Property) *</label>
                <div style={{ position: 'relative' }}>
                  <select value={formData.agreement_id} onChange={e => setFormData({...formData, agreement_id: e.target.value})} required style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none' }}>
                    <option value="" style={{ color: 'var(--text-primary)' }}>Select Agreement...</option>
                    {filteredAgreements.map(a => (
                      <option key={a.id} value={a.id} style={{ color: 'var(--text-primary)' }}>{getPropertyName(a.property_id)} (₹{a.rent_amount})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}><ModalInput type="number" label="Amount *" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} required /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Type</label>
                    <div style={{ position: 'relative' }}>
                      <CustomSelect value={formData.payment_type} onChange={val => setFormData({...formData, payment_type: val})} options={[{value: 'rent', label: 'Rent/Lease'}, {value: 'deposit', label: 'Deposit'}, {value: 'other', label: 'Other'}]} />
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}><ModalInput type="date" label="Payment Date *" value={formData.payment_date} onChange={e => setFormData({...formData, payment_date: e.target.value})} required /></div>
                <div style={{ flex: 1 }}><ModalInput label="Payment Method" value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})} placeholder="e.g. UPI, NEFT" /></div>
              </div>
              <ModalInput label="Reference Number" value={formData.reference_number} onChange={e => setFormData({...formData, reference_number: e.target.value})} />
              <ModalTextarea label="Notes" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={2} />
            </>
          )}

          <ModalActionButtons 
            onCancel={() => setModalMode(null)} 
            submitText="Save Record"
            isSubmitting={isSubmitting} 
          />
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => !isLoading && setDeleteTarget(null)} title="Delete Record" maxWidth="440px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget?.name}</strong>? This action cannot be undone.
          </p>
          <ModalActionButtons
            onCancel={() => setDeleteTarget(null)}
            submitText="Delete"
            isSubmitting={isLoading}
            isDanger={true}
            customSubmitAction={handleDelete}
          />
        </div>
      </Modal>

      {/* Print Agreement Slip */}
      {agreementSlipTarget && (
        <AgreementSlipModal
          isOpen={true}
          onClose={() => setAgreementSlipTarget(null)}
          lessorName={getLandlordForAgreement(agreementSlipTarget)?.full_name || 'Unknown Landlord'}
          lessorPhone={getLandlordForAgreement(agreementSlipTarget)?.phone}
          lesseeName={currentProfile?.full_name || 'RentBook Admin'}
          lesseePhone={currentProfile?.phone_number}
          propertyLabel={getPropertyName(agreementSlipTarget.property_id)}
          effectiveDate={agreementSlipTarget.start_date}
          leaseEndDate={agreementSlipTarget.end_date}
          monthlyRent={agreementSlipTarget.rent_amount}
          securityDeposit={agreementSlipTarget.security_deposit}
        />
      )}
    </div>
  );
};

