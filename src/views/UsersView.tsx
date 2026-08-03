import React, { useState, useEffect, useRef } from 'react';
import './views.css';
import {
  UserPlus, Shield, X, Mail, Image as ImageIcon,
  Pencil, Trash2, KeyRound, Check, AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface UserRecord {
  user_id: string;
  role: string;
  created_at: string;
  profiles: {
    full_name: string | null;
    phone_number: string | null;
    bio: string | null;
    avatar_url: string | null;
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
      // Fetch roles and profiles separately (no direct FK between them)
      const [{ data: rolesData, error: rolesError }, { data: profilesData, error: profilesError }] = await Promise.all([
        supabase.from('user_roles').select('user_id, role, created_at').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, phone_number, bio, avatar_url'),
      ]);

      if (rolesError) throw rolesError;
      if (profilesError) throw profilesError;

      // Merge: attach each profile to its matching role row
      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
      const merged = (rolesData || []).map(r => ({
        ...r,
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

      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="view-title" style={{ margin: 0 }}>Users Management</h1>
        <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserPlus size={18} /> Create User
        </button>
      </div>

      {/* ── Users Table ── */}
      <div className="surface-card glass-card" style={{ padding: '0', overflow: 'hidden' }}>
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
              {users.map(u => {
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
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{u.user_id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {u.profiles?.phone_number || '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '4px 12px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 500,
                        backgroundColor: u.role === 'admin' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                        color: u.role === 'admin' ? '#10b981' : '#3b82f6'
                      }}>
                        {u.role === 'admin' && <Shield size={12} />}
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => openEditModal(u)} title="Edit User" style={{ background: 'rgba(59,130,246,0.15)', border: 'none', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center' }}>
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => { setPwTarget(u); setPwForm({ new_password: '', confirm_password: '' }); setPwError(''); }} title="Change Password" style={{ background: 'rgba(245,158,11,0.15)', border: 'none', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: '#f59e0b', display: 'flex', alignItems: 'center' }}>
                          <KeyRound size={15} />
                        </button>
                        <button onClick={() => setDeleteTarget(u)} title="Delete User" style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={15} />
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
      {isCreateOpen && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setIsCreateOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">Create New User</h2>
              <button className="close-btn" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 4px' }}>
              {/* Profile Image */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div onClick={() => fileInputRef.current?.click()} style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', border: '2px dashed rgba(255,255,255,0.2)', flexShrink: 0 }}>
                  {profileImage ? <img src={URL.createObjectURL(profileImage)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={24} color="rgba(255,255,255,0.4)" />}
                </div>
                <div>
                  <p className="form-label" style={{ marginBottom: '4px' }}>Profile Picture <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>(Optional)</span></p>
                  <input type="file" ref={fileInputRef} onChange={e => e.target.files && setProfileImage(e.target.files[0])} accept="image/*" style={{ display: 'none' }} />
                  <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()} style={{ padding: '4px 14px', fontSize: '0.82rem' }}>Upload</button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Full Name <span style={{ color: 'var(--text-secondary)' }}>(Optional)</span></label>
                <input type="text" className="form-input" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} placeholder="John Doe" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number <span style={{ color: 'var(--text-secondary)' }}>(Optional)</span></label>
                <input type="tel" className="form-input" value={newUser.phone_number} onChange={e => setNewUser({ ...newUser, phone_number: e.target.value })} placeholder="(555) 000-0000" />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input type="email" className="form-input" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="user@example.com" style={{ paddingLeft: '38px' }} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Temporary Password *</label>
                <input type="password" className="form-input" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Min 6 characters" minLength={6} required />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-input" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white' }}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* EDIT USER MODAL                                                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {editTarget && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setEditTarget(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit User</h2>
              <button className="close-btn" onClick={() => setEditTarget(null)} disabled={isSubmitting}><X size={20} /></button>
            </div>
            <form onSubmit={handleEditUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 4px' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input type="text" className="form-input" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} placeholder="Full name" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input type="tel" className="form-input" value={editForm.phone_number} onChange={e => setEditForm({ ...editForm, phone_number: e.target.value })} placeholder="(555) 000-0000" />
              </div>
              <div className="form-group">
                <label className="form-label">Bio / Notes</label>
                <textarea rows={3} className="form-input" value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} placeholder="A short bio..." />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-input" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white' }}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditTarget(null)} disabled={isSubmitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* DELETE CONFIRMATION DIALOG                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setDeleteTarget(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: '#ef4444' }}>Delete User</h2>
              <button className="close-btn" onClick={() => setDeleteTarget(null)} disabled={isSubmitting}><X size={20} /></button>
            </div>
            <div style={{ padding: '8px 4px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '16px', backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertTriangle size={22} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '4px' }}>This action is permanent!</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    You are about to delete <strong style={{ color: 'white' }}>{deleteTarget.profiles?.full_name || 'this user'}</strong>. Their profile, role, and all associated data will be permanently removed and cannot be recovered.
                  </p>
                </div>
              </div>
              <div className="form-actions">
                <button className="btn-secondary" onClick={() => setDeleteTarget(null)} disabled={isSubmitting}>Cancel</button>
                <button className="btn btn-primary" onClick={handleDeleteUser} disabled={isSubmitting} style={{ background: '#ef4444', borderColor: '#ef4444' }}>
                  {isSubmitting ? 'Deleting...' : 'Yes, Delete User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* CHANGE PASSWORD MODAL                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {pwTarget && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setPwTarget(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Change Password</h2>
              <button className="close-btn" onClick={() => setPwTarget(null)} disabled={isSubmitting}><X size={20} /></button>
            </div>
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 4px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>
                Setting a new password for <strong style={{ color: 'white' }}>{pwTarget.profiles?.full_name || 'this user'}</strong>. Their current session will be invalidated after the change.
              </p>
              {pwError && (
                <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem' }}>{pwError}</div>
              )}
              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input type="password" className="form-input" value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} placeholder="Min 6 characters" minLength={6} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password *</label>
                <input type="password" className="form-input" value={pwForm.confirm_password} onChange={e => setPwForm({ ...pwForm, confirm_password: e.target.value })} placeholder="Re-enter password" required />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setPwTarget(null)} disabled={isSubmitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Change Password'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
