import React, { useState, useMemo, useRef } from 'react';
import { X, Plus, Trash2, Edit2, CheckCircle, Circle, ChevronLeft, Calendar as CalendarIcon, FileText, MoreVertical } from 'lucide-react';
import './dashboard.css';
import '../../views/views.css';

import { CustomSelect } from '../ui/CustomSelect';
import { CustomDatePicker } from '../ui/CustomDatePicker';
import { WidgetPortalOverlay } from '../ui/WidgetPortalOverlay';
import { useNotifications } from '../../contexts/NotificationContext';
import type { Reminder, Notebook } from '../../contexts/NotificationContext';

export const CalendarWidget: React.FC = () => {
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  
  // Data from Context
  const { 
    reminders, addReminder, updateReminder, deleteReminder: ctxDeleteReminder,
    notebooks, addNotebook, updateNotebook, deleteNotebook: ctxDeleteNotebook
  } = useNotifications();

  // Modals state
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isNotebookModalOpen, setIsNotebookModalOpen] = useState(false);

  // Reminder Inner State
  const [reminderView, setReminderView] = useState<'list' | 'form' | 'details'>('list');
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [reminderSearch, setReminderSearch] = useState('');
  const [reminderSort, setReminderSort] = useState<'newest' | 'oldest' | 'dueDate'>('dueDate');

  // Notebook Inner State
  const [notebookView, setNotebookView] = useState<'list' | 'form' | 'details'>('list');
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);
  const [notebookSearch, setNotebookSearch] = useState('');
  const [notebookSort, setNotebookSort] = useState<'newest' | 'oldest'>('newest');

  const widgetRef = useRef<HTMLDivElement>(null);
  const isAnyModalOpen = isReminderModalOpen || isNotebookModalOpen;

  // --- Date Logic for Calendar ---
  const today = new Date();
  const currentMonthName = today.toLocaleString('default', { month: 'long' });
  const currentDate = today.getDate();
  const currentDay = today.getDay();
  
  const weekDates = [];
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - currentDay);
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    weekDates.push(d.getDate());
  }
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const monthlyDates = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    monthlyDates.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    monthlyDates.push(i);
  }

  // --- Styles ---

  // --- Reminder Actions ---
  const handleSaveReminder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newReminder: Reminder = {
      id: editingReminder?.id || Date.now().toString(),
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      date: formData.get('date') as string,
      status: editingReminder?.status || 'pending',
      createdAt: editingReminder?.createdAt || Date.now(),
    };

    if (editingReminder) {
      updateReminder(newReminder.id, newReminder);
    } else {
      addReminder(newReminder);
    }
    setReminderView('list');
    setEditingReminder(null);
  };

  const handleDeleteReminder = (id: string) => {
    ctxDeleteReminder(id);
    if (reminderView === 'details' && editingReminder?.id === id) {
      setReminderView('list');
    }
  };

  const toggleReminderStatus = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const r = reminders.find(r => r.id === id);
    if (r) {
      updateReminder(id, { status: r.status === 'pending' ? 'completed' : 'pending' });
    }
  };

  const sortedAndFilteredReminders = useMemo(() => {
    let result = reminders.filter(r => 
      r.title.toLowerCase().includes(reminderSearch.toLowerCase()) || 
      (r.description || '').toLowerCase().includes(reminderSearch.toLowerCase())
    );
    result.sort((a, b) => {
      if (reminderSort === 'newest') return b.createdAt - a.createdAt;
      if (reminderSort === 'oldest') return a.createdAt - b.createdAt;
      if (reminderSort === 'dueDate') return new Date(a.date).getTime() - new Date(b.date).getTime();
      return 0;
    });
    return result;
  }, [reminders, reminderSearch, reminderSort]);

  // --- Notebook Actions ---
  const handleSaveNotebook = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newNotebook: Notebook = {
      id: editingNotebook?.id || Date.now().toString(),
      title: formData.get('title') as string,
      notes: formData.get('notes') as string,
      createdAt: editingNotebook?.createdAt || new Date().toISOString(),
    };

    if (editingNotebook) {
      updateNotebook(newNotebook.id, newNotebook);
    } else {
      addNotebook(newNotebook);
    }
    setNotebookView('list');
    setEditingNotebook(null);
  };

  const handleDeleteNotebook = (id: string) => {
    ctxDeleteNotebook(id);
    if (notebookView === 'details' && editingNotebook?.id === id) {
      setNotebookView('list');
    }
  };

  const sortedAndFilteredNotebooks = useMemo(() => {
    let result = notebooks.filter(n => 
      n.title.toLowerCase().includes(notebookSearch.toLowerCase()) || 
      n.notes.toLowerCase().includes(notebookSearch.toLowerCase())
    );
    result.sort((a, b) => {
      if (notebookSort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (notebookSort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return 0;
    });
    return result;
  }, [notebooks, notebookSearch, notebookSort]);

  return (
    <div ref={widgetRef} className="surface-card glass-card" style={{ 
      display: 'flex', flexDirection: 'column', minHeight: '400px',
      padding: 'var(--spacing-lg)', position: 'relative', overflow: 'hidden',
      opacity: isAnyModalOpen ? 0.65 : 1,
      filter: isAnyModalOpen ? 'saturate(0.85) brightness(0.9)' : 'none',
      pointerEvents: isAnyModalOpen ? 'none' : 'auto',
      transition: 'all 0.3s ease'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: '1px', padding: '4px' }}>
          <button 
            onClick={() => setViewMode('weekly')}
            style={{ background: viewMode === 'weekly' ? 'var(--bg-surface)' : 'transparent', color: viewMode === 'weekly' ? 'var(--text-primary)' : 'var(--text-secondary)', borderRadius: '2px', padding: '6px 16px', fontSize: '0.85rem', fontWeight: viewMode === 'weekly' ? 600 : 500, border: 'none', cursor: 'pointer', boxShadow: viewMode === 'weekly' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}>
            Weekly
          </button>
          <button 
            onClick={() => setViewMode('monthly')}
            style={{ background: viewMode === 'monthly' ? 'var(--bg-surface)' : 'transparent', color: viewMode === 'monthly' ? 'var(--text-primary)' : 'var(--text-secondary)', borderRadius: '2px', padding: '6px 16px', fontSize: '0.85rem', fontWeight: viewMode === 'monthly' ? 600 : 500, border: 'none', cursor: 'pointer', boxShadow: viewMode === 'monthly' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}>
            Monthly
          </button>
        </div>
      </div>

      {/* Date display */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: viewMode === 'monthly' ? '12px' : '32px', transition: 'margin 0.3s' }}>
        <h2 style={{ fontSize: '3.2rem', fontWeight: 600, margin: 0, letterSpacing: '-1px', color: 'var(--text-primary)' }}>{currentMonthName}</h2>
        <h2 style={{ fontSize: '2.8rem', fontWeight: 400, margin: 0, color: 'var(--text-secondary)' }}>{currentDate}</h2>
      </div>

      {/* Week days */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <span key={i} style={{ color: 'var(--text-muted)', fontSize: '0.85rem', width: '32px', textAlign: 'center', fontWeight: 600 }}>{day}</span>
        ))}
      </div>
      {viewMode === 'weekly' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'auto' }}>
          {weekDates.map((date, i) => {
            const isToday = date === currentDate && i === currentDay;
            return (
              <div key={i} style={{ 
                width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                borderRadius: '2px', fontSize: '1rem',
                background: isToday ? '#0f766e' : 'transparent',
                color: isToday ? 'white' : 'var(--text-primary)',
                fontWeight: isToday ? 600 : 500
              }}>
                {date}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px 4px', marginBottom: 'auto', justifyItems: 'center' }}>
          {monthlyDates.map((date, i) => {
            const isToday = date === currentDate;
            return (
              <div key={i} style={{ 
                width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                borderRadius: '2px', fontSize: '0.85rem',
                background: isToday ? '#0f766e' : 'transparent',
                color: isToday ? 'white' : (date ? 'var(--text-primary)' : 'transparent'),
                fontWeight: isToday ? 600 : 500,
                cursor: date ? 'pointer' : 'default'
              }}>
                {date || ''}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px', gap: '16px', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => { setIsReminderModalOpen(true); setReminderView('list'); setReminderSearch(''); }}>
          Reminder
        </button>
        <button className="btn btn-secondary" onClick={() => { setIsNotebookModalOpen(true); setNotebookView('list'); setNotebookSearch(''); }}>
          Notebook
        </button>
      </div>

      {/* --- Reminder Modal --- */}
      <WidgetPortalOverlay 
        isOpen={isReminderModalOpen} 
        onClose={() => setIsReminderModalOpen(false)}
        targetRef={widgetRef as any}
      >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {reminderView !== 'list' && (
                  <button onClick={() => setReminderView('list')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', padding: 0 }}>
                    <ChevronLeft size={20} />
                  </button>
                )}
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {reminderView === 'list' ? 'Reminders' : reminderView === 'form' ? (editingReminder ? 'Edit Reminder' : 'New Reminder') : 'Reminder Details'}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {reminderView === 'list' && (
                  <button 
                    onClick={() => { setEditingReminder(null); setReminderView('form'); }} 
                    style={{ background: '#0f766e', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(15, 118, 110, 0.4)' }}
                  >
                    <Plus size={18} />
                  </button>
                )}
                <button onClick={() => setIsReminderModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}><X size={20} /></button>
              </div>
            </div>

            {/* List View */}
            {reminderView === 'list' && (
              <>
                <div className="search-filter-bar">
                  <div className="search-input-wrapper">
                    <input 
                      type="text" placeholder="Search..." value={reminderSearch} onChange={e => setReminderSearch(e.target.value)}
                      style={{ display: 'block', width: '100%', padding: '8px 12px', borderRadius: '2px', border: 'none', fontSize: '0.9rem', boxSizing: 'border-box' }} 
                    />
                  </div>
                  <CustomSelect 
                    width="160px"
                    value={reminderSort} 
                    onChange={val => setReminderSort(val as any)}
                    options={[
                      { label: 'Due Date', value: 'dueDate' },
                      { label: 'Newest', value: 'newest' },
                      { label: 'Oldest', value: 'oldest' }
                    ]}
                  />
                </div>

                {sortedAndFilteredReminders.length === 0 ? (
                  <div className="empty-state-container">
                    <div className="empty-state-icon">
                      <CalendarIcon size={32} />
                    </div>
                    <h4 className="empty-state-text">No reminders yet.</h4>
                    <button 
                      onClick={() => { setEditingReminder(null); setReminderView('form'); }} 
                      className="btn btn-primary"
                    >
                      <Plus size={16} style={{ marginRight: '6px' }} /> Create Reminder
                    </button>
                  </div>
                ) : (
                  <div className="list-grid-layout" style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', paddingBottom: '16px' }}>
                    {sortedAndFilteredReminders.map(r => (
                      <div 
                        key={r.id} 
                        className="premium-card"
                        onClick={() => { setEditingReminder(r); setReminderView('details'); }}
                      >
                        <div className="premium-card-header">
                          <h4 className="premium-card-title" style={{ textDecoration: r.status === 'completed' ? 'line-through' : 'none', opacity: r.status === 'completed' ? 0.7 : 1 }}>
                            {r.title}
                          </h4>
                          <button 
                            onClick={(e) => toggleReminderStatus(r.id, e)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: r.status === 'completed' ? 'var(--success)' : 'var(--text-muted)' }}
                          >
                            {r.status === 'completed' ? <CheckCircle size={20} /> : <Circle size={20} />}
                          </button>
                        </div>
                        <p className="premium-card-desc">{r.description || 'No description provided.'}</p>
                        
                        <div className="premium-card-footer">
                          <div className="premium-card-meta">
                            <span className="premium-card-date">{new Date(r.date).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                            <span className={`badge ${r.status === 'completed' ? 'success' : 'warning'}`}>{r.status === 'completed' ? 'Completed' : 'Pending'}</span>
                          </div>
                          <div className="premium-card-actions">
                            <button onClick={(e) => { e.stopPropagation(); setEditingReminder(r); setReminderView('details'); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                              <MoreVertical size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Form View */}
            {reminderView === 'form' && (
              <form onSubmit={handleSaveReminder} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>Title</label>
                  <input name="title" type="text" className="form-input" style={{ padding: '8px 12px', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} defaultValue={editingReminder?.title} placeholder="e.g. Call plumber" required />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>Description (Optional)</label>
                  <textarea name="description" className="form-input" style={{ padding: '8px 12px', fontSize: '0.85rem', minHeight: '80px', resize: 'vertical', width: '100%', boxSizing: 'border-box' }} defaultValue={editingReminder?.description} placeholder="Add some details..." />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>Due Date</label>
                  <CustomDatePicker name="date" defaultValue={editingReminder?.date} required />
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px' }}>
                  <button type="button" onClick={() => setReminderView('list')} style={{ padding: '8px 16px', borderRadius: '2px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                  <button type="submit" style={{ padding: '8px 20px', borderRadius: '2px', border: 'none', background: '#0f766e', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Save Reminder</button>
                </div>
              </form>
            )}

            {/* Details View */}
            {reminderView === 'details' && editingReminder && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ margin: '0 0 8px', fontSize: '1.4rem', color: 'var(--text-primary)' }}>{editingReminder.title}</h2>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span>Due: {editingReminder.date}</span>
                      <span style={{ color: editingReminder.status === 'completed' ? '#4CAF50' : '#FF9800', fontWeight: 500 }}>{editingReminder.status === 'completed' ? 'Completed' : 'Pending'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setReminderView('form')} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', padding: '6px', borderRadius: '2px', cursor: 'pointer', color: 'var(--text-secondary)' }} title="Edit"><Edit2 size={16} /></button>
                    <button className="icon-btn danger" onClick={() => handleDeleteReminder(editingReminder.id)} style={{ background: '#fff0f0', border: '1px solid rgba(255,0,0,0.1)', padding: '6px', borderRadius: '2px', cursor: 'pointer', color: '#e53935' }} title="Delete"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '16px', borderRadius: '1px', minHeight: '120px', fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                  {editingReminder.description || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No description provided.</span>}
                </div>
                <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                  <button 
                    onClick={() => toggleReminderStatus(editingReminder.id)}
                    style={{ width: '100%', padding: '12px', borderRadius: '2px', border: 'none', background: editingReminder.status === 'completed' ? 'rgba(0,0,0,0.05)' : '#4CAF50', color: editingReminder.status === 'completed' ? 'var(--text-primary)' : 'white', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
                  >
                    {editingReminder.status === 'completed' ? 'Mark as Pending' : <><CheckCircle size={18} /> Mark as Completed</>}
                  </button>
                </div>
              </div>
            )}

      </WidgetPortalOverlay>

      {/* --- Notebook Modal --- */}
      <WidgetPortalOverlay 
        isOpen={isNotebookModalOpen} 
        onClose={() => setIsNotebookModalOpen(false)}
        targetRef={widgetRef as any}
      >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {notebookView !== 'list' && (
                  <button onClick={() => setNotebookView('list')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', padding: 0 }}>
                    <ChevronLeft size={20} />
                  </button>
                )}
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {notebookView === 'list' ? 'Notebook' : notebookView === 'form' ? (editingNotebook ? 'Edit Note' : 'New Note') : 'Note Details'}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {notebookView === 'list' && (
                  <button 
                    onClick={() => { setEditingNotebook(null); setNotebookView('form'); }} 
                    style={{ background: '#0f766e', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(15, 118, 110, 0.4)' }}
                  >
                    <Plus size={18} />
                  </button>
                )}
                <button onClick={() => setIsNotebookModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}><X size={20} /></button>
              </div>
            </div>

            {/* List View */}
            {notebookView === 'list' && (
              <>
                <div className="search-filter-bar">
                  <div className="search-input-wrapper">
                    <input 
                      type="text" placeholder="Search notes..." value={notebookSearch} onChange={e => setNotebookSearch(e.target.value)}
                      style={{ display: 'block', width: '100%', padding: '8px 12px', borderRadius: '2px', border: 'none', fontSize: '0.9rem', boxSizing: 'border-box' }} 
                    />
                  </div>
                  <CustomSelect 
                    width="140px"
                    value={notebookSort} 
                    onChange={val => setNotebookSort(val as any)}
                    options={[
                      { label: 'Newest', value: 'newest' },
                      { label: 'Oldest', value: 'oldest' }
                    ]}
                  />
                </div>

                {sortedAndFilteredNotebooks.length === 0 ? (
                  <div className="empty-state-container">
                    <div className="empty-state-icon">
                      <FileText size={32} />
                    </div>
                    <h4 className="empty-state-text">No notes yet.</h4>
                    <button 
                      onClick={() => { setEditingNotebook(null); setNotebookView('form'); }} 
                      className="btn btn-primary"
                    >
                      <Plus size={16} style={{ marginRight: '6px' }} /> Create Note
                    </button>
                  </div>
                ) : (
                  <div className="list-grid-layout" style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', paddingBottom: '16px' }}>
                    {sortedAndFilteredNotebooks.map(n => (
                      <div 
                        key={n.id} 
                        className="premium-card"
                        onClick={() => { setEditingNotebook(n); setNotebookView('details'); }}
                      >
                        <div className="premium-card-header">
                          <h4 className="premium-card-title">{n.title}</h4>
                        </div>
                        <p className="premium-card-desc">{n.notes}</p>
                        
                        <div className="premium-card-footer">
                          <div className="premium-card-meta">
                            <span className="premium-card-date">Updated {new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          </div>
                          <div className="premium-card-actions">
                            <button onClick={(e) => { e.stopPropagation(); setEditingNotebook(n); setNotebookView('details'); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                              <MoreVertical size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Form View */}
            {notebookView === 'form' && (
              <form onSubmit={handleSaveNotebook} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>Title</label>
                  <input name="title" type="text" className="form-input" style={{ padding: '8px 12px', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} defaultValue={editingNotebook?.title} placeholder="e.g. Staff meeting notes" required />
                </div>
                <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>Notes</label>
                  <textarea name="notes" className="form-input" style={{ padding: '8px 12px', fontSize: '0.85rem', flex: 1, minHeight: '150px', resize: 'none', width: '100%', boxSizing: 'border-box' }} defaultValue={editingNotebook?.notes} placeholder="Write your notes here..." required />
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px' }}>
                  <button type="button" onClick={() => setNotebookView('list')} style={{ padding: '8px 16px', borderRadius: '2px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                  <button type="submit" style={{ padding: '8px 20px', borderRadius: '2px', border: 'none', background: '#0f766e', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Save Note</button>
                </div>
              </form>
            )}

            {/* Details View */}
            {notebookView === 'details' && editingNotebook && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div>
                    <h2 style={{ margin: '0 0 8px', fontSize: '1.4rem', color: 'var(--text-primary)' }}>{editingNotebook.title}</h2>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Created: {new Date(editingNotebook.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setNotebookView('form')} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', padding: '6px', borderRadius: '2px', cursor: 'pointer', color: 'var(--text-secondary)' }} title="Edit"><Edit2 size={16} /></button>
                    <button className="icon-btn danger" onClick={() => handleDeleteNotebook(editingNotebook.id)} style={{ background: '#fff0f0', border: '1px solid rgba(255,0,0,0.1)', padding: '6px', borderRadius: '2px', cursor: 'pointer', color: '#e53935' }} title="Delete"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '1px', border: '1px solid var(--border-color)', flex: 1, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', overflowY: 'auto', lineHeight: '1.6' }}>
                  {editingNotebook.notes}
                </div>
              </div>
            )}
      </WidgetPortalOverlay>
    </div>
  );
};

