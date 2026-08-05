import React, { useState } from 'react';
import './views.css';
import { Wrench, Plus, AlertTriangle, MessageSquare, X } from 'lucide-react';
import { 
  LiquidGlassOverlay, 
  LiquidGlassWindow, 
  LiquidGlassContent, 
  LiquidGlassInput 
} from '../components/ui/LiquidGlassModal';
import { CustomSelect } from '../components/ui/CustomSelect';

export const MaintenanceView: React.FC = () => {
  const [tickets, setTickets] = useState({
    reported: [
      { id: 'M-102', title: 'Leaking Faucet', property: 'Sunset Apartments 4B', priority: 'Medium', date: 'Today' },
      { id: 'M-103', title: 'Broken Window', property: 'Oceanview Towers 12', priority: 'High', date: 'Yesterday' }
    ],
    inProgress: [
      { id: 'M-099', title: 'HVAC Repair', property: 'Downtown Complex 101A', priority: 'High', date: '2 days ago' }
    ],
    resolved: [
      { id: 'M-095', title: 'Clogged Sink', property: 'Pine Tree Lofts 3C', priority: 'Low', date: '4 days ago' },
      { id: 'M-092', title: 'Light Fixture Replacement', property: 'Sunset Apartments 2A', priority: 'Low', date: '1 week ago' }
    ]
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    title: '',
    property: '',
    priority: 'Medium'
  });

  const handleAddRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const requestToAdd = {
      id: `M-${Math.floor(Math.random() * 900) + 100}`,
      title: newRequest.title || 'New Request',
      property: newRequest.property || 'Unknown Location',
      priority: newRequest.priority || 'Medium',
      date: 'Today'
    };
    
    setTickets({
      ...tickets,
      reported: [requestToAdd, ...tickets.reported]
    });
    
    setIsModalOpen(false);
    setNewRequest({ title: '', property: '', priority: 'Medium' });
  };

  const getPriorityColor = (priority: string) => {
    switch(priority.toLowerCase()) {
      case 'high': return '#ef4444';
      case 'medium': return 'var(--warning)';
      case 'low': return 'var(--success)';
      default: return '#64748b';
    }
  };

  const renderTicketCard = (ticket: any) => (
    <div key={ticket.id} className="surface-card glass-card ticket-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{ticket.title}</h4>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: getPriorityColor(ticket.priority), background: 'rgba(255,255,255,0.5)', padding: '2px 8px', borderRadius: '12px' }}>
          {ticket.priority}
        </span>
      </div>
      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{ticket.property}</span>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{ticket.date} • {ticket.id}</span>
        <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <MessageSquare size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="view-title" style={{ width: '150px', lineHeight: 1.2 }}>Maintenance Requests</h1>
        <button 
          className="btn-white" 
          onClick={() => setIsModalOpen(true)} 
          style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'flex-start', padding: '12px 20px', borderRadius: '30px', background: 'rgba(255,255,255,0.9)', border: 'none', fontWeight: 600, color: '#333', cursor: 'pointer', backdropFilter: 'blur(10px)', marginLeft: 'var(--spacing-lg)' }}
        >
          <Plus size={18} /> New Request
        </button>
      </div>

      <div className="kanban-board" style={{ marginTop: '16px' }}>
        
        {/* Reported Column */}
        <div className="kanban-column">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <AlertTriangle size={18} color="var(--warning)" />
            <h3 className="kanban-title">Reported ({tickets.reported.length})</h3>
          </div>
          {tickets.reported.map(renderTicketCard)}
        </div>

        {/* In Progress Column */}
        <div className="kanban-column">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Wrench size={18} color="var(--primary-accent)" />
            <h3 className="kanban-title">In Progress ({tickets.inProgress.length})</h3>
          </div>
          {tickets.inProgress.map(renderTicketCard)}
        </div>

        {/* Resolved Column */}
        <div className="kanban-column">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--success)' }}></div>
            <h3 className="kanban-title">Resolved ({tickets.resolved.length})</h3>
          </div>
          {tickets.resolved.map(renderTicketCard)}
        </div>

      </div>

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
                
                <LiquidGlassInput 
                  label="Property & Unit" 
                  value={newRequest.property}
                  onChange={e => setNewRequest({...newRequest, property: e.target.value})}
                  placeholder="e.g. Sunset Apartments 4B"
                  required
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
                  <button type="submit" className="lg-btn lg-btn-primary">
                    Submit Request
                  </button>
                </div>
              </form>
            </LiquidGlassContent>
          </LiquidGlassWindow>
        </LiquidGlassOverlay>
      )}
    </div>
  );
};
