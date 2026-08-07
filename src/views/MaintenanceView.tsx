import React, { useState, useEffect } from 'react';
import './views.css';
import { Wrench, Plus, AlertTriangle, MessageSquare, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
  LiquidGlassOverlay, 
  LiquidGlassWindow, 
  LiquidGlassContent, 
  LiquidGlassInput 
} from '../components/ui/LiquidGlassModal';
import { CustomSelect } from '../components/ui/CustomSelect';

export const MaintenanceView: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [costModal, setCostModal] = useState<{isOpen: boolean, ticketId: string | null}>({isOpen: false, ticketId: null});
  const [repairCost, setRepairCost] = useState('');

  const [newRequest, setNewRequest] = useState({
    title: '',
    property_id: '',
    unit_number: '',
    priority: 'Medium'
  });

  const [commentsPanel, setCommentsPanel] = useState<{isOpen: boolean, ticketId: string | null}>({isOpen: false, ticketId: null});
  const [ticketComments, setTicketComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    const [{ data: maintenanceData }, { data: propertiesData }] = await Promise.all([
      supabase.from('maintenance_requests').select('*, properties(name), maintenance_comments(count)').order('created_at', { ascending: false }),
      supabase.from('properties').select('id, name')
    ]);
    
    if (maintenanceData) setTickets(maintenanceData);
    if (propertiesData) setProperties(propertiesData);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequest.title || !newRequest.property_id) return;

    const { data, error } = await supabase.from('maintenance_requests').insert([{
      title: newRequest.title,
      property_id: newRequest.property_id,
      unit_number: newRequest.unit_number || null,
      priority: newRequest.priority,
      status: 'Reported'
    }]).select('*, properties(name)').single();

    if (!error && data) {
      setTickets([data, ...tickets]);
      setIsModalOpen(false);
      setNewRequest({ title: '', property_id: '', unit_number: '', priority: 'Medium' });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch(priority.toLowerCase()) {
      case 'high': return '#ef4444';
      case 'medium': return 'var(--warning)';
      case 'low': return 'var(--success)';
      default: return '#64748b';
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('ticketId', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('ticketId');
    if (!ticketId) return;

    if (newStatus === 'Resolved') {
      setCostModal({ isOpen: true, ticketId });
    } else {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
      await supabase.from('maintenance_requests').update({ status: newStatus }).eq('id', ticketId);
    }
  };

  const handleResolveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!costModal.ticketId) return;
    const ticketId = costModal.ticketId;
    
    const ticket = tickets.find(t => t.id === ticketId);
    
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'Resolved' } : t));
    setCostModal({ isOpen: false, ticketId: null });
    
    const cost = Number(repairCost) || 0;
    
    await supabase.from('maintenance_requests').update({ status: 'Resolved' }).eq('id', ticketId);
    
    if (cost > 0 && ticket) {
      await supabase.from('expenses').insert([{
        property_id: ticket.property_id,
        category: 'maintenance',
        amount: cost,
        expense_date: new Date().toISOString().split('T')[0],
        notes: `Maintenance Repair: ${ticket.title}`
      }]);
    }
    
    setRepairCost('');
  };

  const openComments = async (ticketId: string) => {
    setCommentsPanel({ isOpen: true, ticketId });
    setLoadingComments(true);
    const { data } = await supabase
      .from('maintenance_comments')
      .select('*')
      .eq('request_id', ticketId)
      .order('created_at', { ascending: true });
    setTicketComments(data || []);
    setLoadingComments(false);
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !commentsPanel.ticketId) return;

    const { data, error } = await supabase.from('maintenance_comments').insert([{
      request_id: commentsPanel.ticketId,
      content: newCommentText
    }]).select().single();

    if (!error && data) {
      setTicketComments([...ticketComments, data]);
      setNewCommentText('');
      
      // Optimistically update the count on the ticket
      setTickets(prev => prev.map(t => {
        if (t.id === commentsPanel.ticketId) {
          const currentCount = t.maintenance_comments?.[0]?.count || 0;
          return { ...t, maintenance_comments: [{ count: currentCount + 1 }] };
        }
        return t;
      }));
    }
  };

  const renderTicketCard = (ticket: any) => {
    const dateStr = new Date(ticket.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const propertyDisplay = ticket.properties?.name 
      ? `${ticket.properties.name}${ticket.unit_number ? ` - Unit ${ticket.unit_number}` : ''}`
      : 'Unknown Location';

    return (
      <div 
        key={ticket.id} 
        className="surface-card glass-card ticket-card"
        draggable
        onDragStart={(e) => handleDragStart(e, ticket.id)}
        style={{ cursor: 'grab' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{ticket.title}</h4>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: getPriorityColor(ticket.priority), background: 'rgba(255,255,255,0.5)', padding: '2px 8px', borderRadius: '12px' }}>
            {ticket.priority}
          </span>
        </div>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{propertyDisplay}</span>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{dateStr} • {ticket.id.split('-')[0]}</span>
          <button 
            onClick={(e) => { e.stopPropagation(); openComments(ticket.id); }}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <MessageSquare size={16} />
            {(ticket.maintenance_comments?.[0]?.count > 0) && (
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{ticket.maintenance_comments[0].count}</span>
            )}
          </button>
        </div>
      </div>
    );
  };

  const reported = tickets.filter(t => t.status === 'Reported');
  const inProgress = tickets.filter(t => t.status === 'In Progress');
  const resolved = tickets.filter(t => t.status === 'Resolved');

  return (
    <div className="view-container">

      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading requests...</div>
      ) : (
        <div className="kanban-board" style={{ marginTop: '16px' }}>
          
          {/* Reported Column */}
          <div 
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'Reported')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', boxSizing: 'border-box', background: 'var(--bg-surface)' }}>
              <AlertTriangle size={18} color="var(--warning)" />
              <h3 className="kanban-title" style={{ margin: 0 }}>Reported ({reported.length})</h3>
            </div>
            
            <div 
              onClick={() => setIsModalOpen(true)}
              className="surface-card glass-card ticket-card" 
              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px dashed var(--primary)', background: 'rgba(59, 130, 246, 0.05)', minHeight: '110px', color: 'var(--primary)', fontWeight: 600, transition: 'all 0.2s', marginBottom: '16px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={20} /> New Request
              </div>
            </div>

            {reported.map(renderTicketCard)}
          </div>

          {/* In Progress Column */}
          <div 
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'In Progress')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', boxSizing: 'border-box', background: 'var(--bg-surface)' }}>
              <Wrench size={18} color="var(--primary-accent)" />
              <h3 className="kanban-title" style={{ margin: 0 }}>In Progress ({inProgress.length})</h3>
            </div>
            {inProgress.map(renderTicketCard)}
          </div>

          {/* Resolved Column */}
          <div 
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'Resolved')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', boxSizing: 'border-box', background: 'var(--bg-surface)' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--success)' }}></div>
              <h3 className="kanban-title" style={{ margin: 0 }}>Resolved ({resolved.length})</h3>
            </div>
            {resolved.map(renderTicketCard)}
          </div>

        </div>
      )}

      {isModalOpen && (
        <LiquidGlassOverlay onClose={() => setIsModalOpen(false)}>
          <LiquidGlassWindow>
            <div className="lg-modal-header">
              <h2 className="modal-title">New Maintenance Request</h2>
              <button className="lg-close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <LiquidGlassContent>
              <form onSubmit={handleAddRequest} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <LiquidGlassInput 
                  label="Issue Title" 
                  value={newRequest.title}
                  onChange={e => setNewRequest({...newRequest, title: e.target.value})}
                  placeholder="e.g. Leaking Faucet"
                  required
                />
                
                <div className="lg-input-group">
                  <label className="lg-input-label">Property *</label>
                  <div className="lg-input-wrapper">
                    <CustomSelect 
                      value={newRequest.property_id}
                      onChange={val => setNewRequest({...newRequest, property_id: val})}
                      options={properties.map(p => ({ value: p.id, label: p.name }))}
                    />
                  </div>
                </div>

                <LiquidGlassInput 
                  label="Unit Number (Optional)" 
                  value={newRequest.unit_number}
                  onChange={e => setNewRequest({...newRequest, unit_number: e.target.value})}
                  placeholder="e.g. 4B"
                />
                
                <div className="lg-input-group">
                  <label className="lg-input-label">Priority</label>
                  <div className="lg-input-wrapper">
                    <CustomSelect 
                      value={newRequest.priority}
                      onChange={val => setNewRequest({...newRequest, priority: val})}
                      options={[
                        { value: 'Low', label: 'Low' },
                        { value: 'Medium', label: 'Medium' },
                        { value: 'High', label: 'High' }
                      ]}
                    />
                  </div>
                </div>

                <div className="lg-actions" style={{ marginTop: '16px' }}>
                  <button type="button" className="lg-btn lg-btn-secondary" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="lg-btn lg-btn-primary" disabled={!newRequest.property_id}>
                    Submit Request
                  </button>
                </div>
              </form>
            </LiquidGlassContent>
          </LiquidGlassWindow>
        </LiquidGlassOverlay>
      )}

      {costModal.isOpen && (
        <LiquidGlassOverlay onClose={() => setCostModal({ isOpen: false, ticketId: null })}>
          <LiquidGlassWindow>
            <div className="lg-modal-header">
              <h2 className="modal-title">Log Repair Cost</h2>
              <button className="lg-close-btn" onClick={() => setCostModal({ isOpen: false, ticketId: null })}>
                <X size={20} />
              </button>
            </div>
            
            <LiquidGlassContent>
              <form onSubmit={handleResolveTicket} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  This ticket is now resolved. If there was a cost associated with this repair, enter it below to log it as a maintenance expense.
                </p>
                <LiquidGlassInput 
                  label="Repair Cost (₹)" 
                  value={repairCost}
                  onChange={e => setRepairCost(e.target.value)}
                  placeholder="e.g. 5000"
                  type="number"
                />
                <div className="lg-actions" style={{ marginTop: '16px' }}>
                  <button type="button" className="lg-btn lg-btn-secondary" onClick={() => setCostModal({ isOpen: false, ticketId: null })}>
                    Cancel
                  </button>
                  <button type="submit" className="lg-btn lg-btn-primary">
                    Mark as Resolved
                  </button>
                </div>
              </form>
            </LiquidGlassContent>
          </LiquidGlassWindow>
        </LiquidGlassOverlay>
      )}

      {commentsPanel.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0, width: '400px',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '-20px 0 40px rgba(0,0,0,0.1)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards'
        }}>
          <div style={{ padding: '24px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Ticket Comments</h2>
            <button onClick={() => setCommentsPanel({ isOpen: false, ticketId: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <X size={20} />
            </button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {loadingComments ? (
              <p style={{ textAlign: 'center', color: '#94a3b8' }}>Loading comments...</p>
            ) : ticketComments.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8' }}>No comments yet.</p>
            ) : (
              ticketComments.map(c => (
                <div key={c.id} style={{ background: 'rgba(255,255,255,0.6)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.5)' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{c.content}</p>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    {new Date(c.created_at).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
          
          <div style={{ padding: '24px', borderTop: '1px solid rgba(0,0,0,0.05)', background: 'rgba(255,255,255,0.4)' }}>
            <form onSubmit={handleSubmitComment} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                value={newCommentText}
                onChange={e => setNewCommentText(e.target.value)}
                placeholder="Type a comment..."
                style={{ flex: 1, padding: '12px 16px', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.9)', outline: 'none' }}
              />
              <button 
                type="submit"
                disabled={!newCommentText.trim()}
                style={{ padding: '10px 20px', borderRadius: '20px', border: 'none', background: 'var(--primary-accent)', color: 'white', fontWeight: 600, cursor: 'pointer', opacity: newCommentText.trim() ? 1 : 0.5 }}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
