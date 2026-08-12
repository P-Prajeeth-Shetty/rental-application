import React, { useState, useEffect, useRef } from 'react';
import './views.css';
import {
  UserPlus, Mail, Image as ImageIcon,
  Pencil, Trash2, KeyRound, Check, AlertTriangle,
  Search
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal, ModalInput, ModalTextarea, ModalSelect, ModalActionButtons } from '../components/ui/Modal';
import { CustomSelect } from '../components/ui/CustomSelect';

interface UserRecord {
  user_id: string;
  role: string;
  created_at: string;
  email?: string;
  profiles: {
    full_name: string | null;
    phone_number: string | null;
    bio: string | null;
    avatar_url: string | null;
    email?: string | null;
  } | null;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [emailMap, setEmailMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('rentbook_user_emails');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Create User modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user', full_name: '', phone_number: '' });
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit User modal
  const [editTarget, setEditTarget] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', phone_number: '', bio: '', role: 'user' });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);

  // Change Password modal
  const [pwTarget, setPwTarget] = useState<UserRecord | null>(null);
  const [pwForm, setPwForm] = useState({ new_password: '', confirm_password: '' });
  const [pwError, setPwError] = useState('');

  // ── Helpers ───────────────────────────────────────────────────────────────

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const getAvatarUrl = (avatarPath: string | null | undefined) => {
    if (!avatarPath) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/avatars/${avatarPath}`;
  };

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Try edge function to fetch real emails from auth admin
      try {
        const headers = await getAuthHeaders();
        const { data, error } = await supabase.functions.invoke('admin-manage-user', {
          body: { action: 'list' },
          headers
        });
        if (!error && data?.users && Array.isArray(data.users)) {
          setUsers(data.users as UserRecord[]);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        // Fallback to table fetch
      }

      // Fallback: Fetch roles and profiles separately
      const [{ data: rolesData, error: rolesError }, { data: profilesData, error: profilesError }] = await Promise.all([
        supabase.from('user_roles').select('user_id, role, created_at').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, phone_number, bio, avatar_url, email'),
      ]);

      if (rolesError) throw rolesError;
      if (profilesError) throw profilesError;

      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
      const merged = (rolesData || []).map(r => ({
        ...r,
        email: profilesMap.get(r.user_id)?.email || undefined,
        profiles: profilesMap.get(r.user_id) || null,
      }));

      setUsers(merged as UserRecord[]);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to fetch users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  // ── Create User ───────────────────────────────────────────────────────────

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { ...newUser }, headers
      });

      if (error || data?.error) throw new Error(data?.error || error?.message || 'Failed to create user.');

      const newUserId = data?.user?.id;
      if (newUserId && newUser.email) {
        const updatedMap = { ...emailMap, [newUserId]: newUser.email };
        setEmailMap(updatedMap);
        try { localStorage.setItem('rentbook_user_emails', JSON.stringify(updatedMap)); } catch {}
      }

      if (newUserId && profileImage) {
        const fileExt = profileImage.name.split('.').pop();
        const filePath = `${newUserId}/${newUserId}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, profileImage);
        if (!uploadError) {
          await supabase.from('profiles').update({ avatar_url: filePath }).eq('id', newUserId);
        }
      }

      setIsCreateOpen(false);
      setNewUser({ email: '', password: '', role: 'user', full_name: '', phone_number: '' });
      setProfileImage(null);
      showToast('success', 'User created successfully!');
      fetchUsers();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Edit User ─────────────────────────────────────────────────────────────

  const openEditModal = (user: UserRecord) => {
    setEditTarget(user);
    setEditForm({
      full_name: user.profiles?.full_name || '',
      phone_number: user.profiles?.phone_number || '',
      bio: user.profiles?.bio || '',
      role: user.role,
    });
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setIsSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action: 'edit', target_user_id: editTarget.user_id, ...editForm },
        headers
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);

      setEditTarget(null);
      showToast('success', 'User updated successfully!');
      fetchUsers();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete User ───────────────────────────────────────────────────────────

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action: 'delete', target_user_id: deleteTarget.user_id },
        headers
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);

      setDeleteTarget(null);
      showToast('success', 'User deleted successfully!');
      fetchUsers();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Change Password ───────────────────────────────────────────────────────

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwTarget) return;
    setPwError('');
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError('Passwords do not match.');
      return;
    }
    if (pwForm.new_password.length < 6) {
      setPwError('Password must be at least 6 characters.');
      return;
    }
    setIsSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action: 'change_password', target_user_id: pwTarget.user_id, new_password: pwForm.new_password },
        headers
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);

      setPwTarget(null);
      setPwForm({ new_password: '', confirm_password: '' });
      showToast('success', 'Password changed successfully!');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to change password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUserEmail = (u: UserRecord) => {
    if (u.email) return u.email;
    if (u.profiles?.email) return u.profiles.email;
    if (emailMap[u.user_id]) return emailMap[u.user_id];
    return '—';
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="view-container">
      {/* Toast Notifications */}
      <div style={{ position: 'fixed', top: '80px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 18px', borderRadius: '10px', minWidth: '280px',
            background: t.type === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
            color: 'white', fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            animation: 'slideIn 0.3s ease'
          }}>
            {t.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
            {t.message}
          </div>
        ))}
      </div>
      <style>{`@keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', width: '100%', marginBottom: '8px' }}>
        <div className="surface-card glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
          <span style={{ color: '#4b5563', fontSize: '0.95rem', fontWeight: 500 }}>Total Users</span>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0f766e' }}>{users.length}</h2>
        </div>

        <div className="surface-card glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', background: 'linear-gradient(135deg, #FF6600 0%, #FF8500 35%, #FFA333 70%, #FFC277 100%)', border: '1.5px solid #FF8500', borderRadius: '16px', boxShadow: '0 10px 28px rgba(255, 102, 0, 0.25)' }}>
          <span style={{ color: '#0F172A', fontSize: '0.95rem', fontWeight: 600 }}>Administrators</span>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0F172A' }}>{users.filter(u => u.role === 'admin').length}</h2>
        </div>

        <div className="surface-card glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
          <span style={{ color: '#4b5563', fontSize: '0.95rem', fontWeight: 500 }}>Regular Users</span>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0f766e' }}>{users.filter(u => u.role === 'user').length}</h2>
        </div>
      </div>

      {/* Toolbar (Search + Filters + Actions) */}
      <div className="search-filter-row">
        <div className="search-input-container">
          <Search size={18} color="var(--text-secondary)" />
          <input 
            type="text" 
            placeholder="Search users by name, phone, email..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <CustomSelect
              value={roleFilter}
              onChange={val => setRoleFilter(val)}
              options={[
                { value: 'All Roles', label: 'All Users' },
                { value: 'admin', label: 'Admin Users' },
                { value: 'user', label: 'Users' }
              ]}
              width="160px"
              height="48px"
            />
          </div>
          <button className="btn-primary" onClick={() => setIsCreateOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '48px', padding: '0 20px', borderRadius: '8px', background: '#0f766e', color: '#ffffff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
            <UserPlus size={18} /> Create User
          </button>
        </div>
      </div>

      {/* ── Users Table ── */}
      <div className="surface-card glass-card static-card" style={{ padding: '0', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading users...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>User</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Phone</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Role</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Joined</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter(u => roleFilter === 'All Roles' || u.role === roleFilter)
                .filter(u => {
                  if (!searchQuery) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    u.profiles?.full_name?.toLowerCase().includes(q) ||
                    u.profiles?.phone_number?.toLowerCase().includes(q) ||
                    getUserEmail(u).toLowerCase().includes(q)
                  );
                })
                .map(u => {
                const avatarUrl = getAvatarUrl(u.profiles?.avatar_url);
                const displayName = u.profiles?.full_name || 'N/A';
                return (
                  <tr key={u.user_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={displayName} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600 }}>
                            {displayName !== 'N/A' ? displayName[0].toUpperCase() : '?'}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 500 }}>{displayName}</div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{getUserEmail(u)}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {u.profiles?.phone_number || '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '90px', padding: '4px 12px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 500,
                        backgroundColor: u.role === 'admin' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                        color: u.role === 'admin' ? '#10b981' : '#3b82f6'
                      }}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div 
                        style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}
                        onClick={e => e.stopPropagation()}
                        onPointerDown={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        onTouchStart={e => e.stopPropagation()}
                      >
                        <button onClick={(e) => { e.stopPropagation(); openEditModal(u); }} title="Edit User" style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: '#0f766e', display: 'flex', alignItems: 'center' }}>
                          <Pencil size={15} style={{ pointerEvents: 'none' }} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setPwTarget(u); setPwForm({ new_password: '', confirm_password: '' }); setPwError(''); }} title="Change Password" style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: '#0f766e', display: 'flex', alignItems: 'center' }}>
                          <KeyRound size={15} style={{ pointerEvents: 'none' }} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(u); }} title="Delete User" style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={15} style={{ pointerEvents: 'none' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No users found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* CREATE USER MODAL                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* CREATE USER MODAL                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={isCreateOpen} onClose={() => !isSubmitting && setIsCreateOpen(false)} title="Create New User">
        <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Profile Image */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
            <div onClick={() => fileInputRef.current?.click()} style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', border: '2px dashed var(--border-color)', flexShrink: 0 }}>
              {profileImage ? <img src={URL.createObjectURL(profileImage)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={24} color="var(--text-secondary)" />}
            </div>
            <div>
              <p style={{ marginBottom: '4px', fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Profile Picture <span style={{ textTransform: 'none', fontSize: '0.8rem' }}>(Optional)</span></p>
              <input type="file" ref={fileInputRef} onChange={e => e.target.files && setProfileImage(e.target.files[0])} accept="image/*" style={{ display: 'none' }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: '6px 14px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)' }}>Upload</button>
            </div>
          </div>

          <ModalInput 
            label="Full Name (Optional)" 
            value={newUser.full_name} 
            onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} 
            placeholder="John Doe" 
          />
          <ModalInput 
            type="tel" 
            label="Phone Number (Optional)" 
            value={newUser.phone_number} 
            onChange={e => setNewUser({ ...newUser, phone_number: e.target.value })} 
            placeholder="(555) 000-0000" 
          />
          
          <div>
            <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Address *</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', zIndex: 1 }} />
              <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="user@example.com" style={{ padding: '10px 14px', paddingLeft: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none', width: '100%', fontFamily: 'inherit' }} required />
            </div>
          </div>
          
          <ModalInput 
            type="password" 
            label="Temporary Password *" 
            value={newUser.password} 
            onChange={e => setNewUser({ ...newUser, password: e.target.value })} 
            placeholder="Min 6 characters" 
            minLength={6} 
            required 
          />
          <ModalSelect
            label="Role *"
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            options={[
              { label: 'User', value: 'user' },
              { label: 'Admin', value: 'admin' }
            ]}
          />
          <ModalActionButtons 
            onCancel={() => setIsCreateOpen(false)} 
            submitText="Create User" 
            isSubmitting={isSubmitting} 
          />
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* EDIT USER MODAL                                                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* EDIT USER MODAL                                                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={!!editTarget} onClose={() => !isSubmitting && setEditTarget(null)} title="Edit User">
        <form onSubmit={handleEditUser} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ModalInput 
            label="Full Name" 
            value={editForm.full_name} 
            onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} 
            placeholder="Full name" 
          />
          <ModalInput 
            type="tel" 
            label="Phone Number" 
            value={editForm.phone_number} 
            onChange={e => setEditForm({ ...editForm, phone_number: e.target.value })} 
            placeholder="(555) 000-0000" 
          />
          <ModalTextarea 
            label="Bio / Notes" 
            rows={3} 
            value={editForm.bio} 
            onChange={e => setEditForm({ ...editForm, bio: e.target.value })} 
            placeholder="A short bio..." 
          />
          <ModalSelect
            label="Role"
            value={editForm.role}
            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
            options={[
              { label: 'User', value: 'user' },
              { label: 'Admin', value: 'admin' }
            ]}
          />
          <ModalActionButtons 
            onCancel={() => setEditTarget(null)} 
            submitText="Save Changes" 
            isSubmitting={isSubmitting} 
          />
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* DELETE CONFIRMATION DIALOG                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* DELETE CONFIRMATION DIALOG                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={!!deleteTarget} onClose={() => !isSubmitting && setDeleteTarget(null)} title="Delete User" maxWidth="440px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '16px', backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={22} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>This action is permanent!</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                You are about to delete <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget?.profiles?.full_name || 'this user'}</strong>. Their profile, role, and all associated data will be permanently removed and cannot be recovered.
              </p>
            </div>
          </div>
          <ModalActionButtons 
            onCancel={() => setDeleteTarget(null)} 
            submitText="Yes, Delete User" 
            isSubmitting={isSubmitting} 
            isDanger={true}
            customSubmitAction={handleDeleteUser}
          />
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* CHANGE PASSWORD MODAL                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* CHANGE PASSWORD MODAL                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={!!pwTarget} onClose={() => !isSubmitting && setPwTarget(null)} title="Change Password" maxWidth="440px">
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '-8px', lineHeight: 1.5 }}>
            Setting a new password for <strong style={{ color: 'var(--text-primary)' }}>{pwTarget?.profiles?.full_name || 'this user'}</strong>. Their current session will be invalidated after the change.
          </p>
          {pwError && (
            <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '-8px' }}>{pwError}</div>
          )}
          <ModalInput 
            type="password" 
            label="New Password *" 
            value={pwForm.new_password} 
            onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} 
            placeholder="Min 6 characters" 
            minLength={6} 
            required 
          />
          <ModalInput 
            type="password" 
            label="Confirm Password *" 
            value={pwForm.confirm_password} 
            onChange={e => setPwForm({ ...pwForm, confirm_password: e.target.value })} 
            placeholder="Re-enter password" 
            required 
          />
          <ModalActionButtons 
            onCancel={() => setPwTarget(null)} 
            submitText="Change Password" 
            isSubmitting={isSubmitting} 
          />
        </form>
      </Modal>
    </div>
  );
};
