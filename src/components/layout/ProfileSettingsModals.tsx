import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Bell, Moon, Lock, Loader2, User, Phone, Mail, FileText } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { supabase } from '../../lib/supabase';
import type { UserProfile } from './Layout';
import './layout.css';

interface ProfileSettingsModalsProps {
  activeModal: 'profile' | 'settings' | null;
  onClose: () => void;
  profile: UserProfile | null;
  email: string;
  userRole: string;
  onProfileUpdate: () => void;
}

export const ProfileSettingsModals: React.FC<ProfileSettingsModalsProps> = ({
  activeModal,
  onClose,
  profile,
  email,
  userRole,
  onProfileUpdate
}) => {
  const [settingsTab, setSettingsTab] = useState<'preferences' | 'security'>('preferences');
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  // Admin-only edit form state
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhoneNumber(profile.phone_number || '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  if (!activeModal) return null;

  // Admin: save profile edits
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone_number: phoneNumber, bio })
        .eq('id', profile.id);
      if (error) throw error;
      onProfileUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  // Admin: upload avatar
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !profile) return;
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${profile.id}/${profile.id}-${Date.now()}.${fileExt}`;
    setUploadingImage(true);
    try {
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: filePath }).eq('id', profile.id);
      if (updateError) throw updateError;
      onProfileUpdate();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Failed to upload image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const defaultAvatar = "https://i.pravatar.cc/150?img=68";
  const avatarUrl = profile?.avatar_url
    ? `${supabaseUrl}/storage/v1/object/public/avatars/${profile.avatar_url}`
    : defaultAvatar;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">
            {activeModal === 'profile' ? 'My Profile' : 'Account Settings'}
          </h3>
          <button className="modal-close-btn" onClick={onClose} disabled={isSaving || uploadingImage}>
            <X size={20} />
          </button>
        </div>

        {/* ── PROFILE MODAL ─────────────────────────────────────────────── */}
        {activeModal === 'profile' && (
          <div className="modal-body profile-modal">

            {/* Avatar section */}
            <div className="profile-avatar-section">
              <div className="avatar-wrapper">
                <img src={avatarUrl} alt="Profile" className="large-avatar" style={{ objectFit: 'cover' }} />
                {isAdmin && (
                  <>
                    <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" style={{ display: 'none' }} />
                    <button type="button" className="change-photo-btn" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                      {uploadingImage ? <Loader2 size={16} className="spin" /> : <Camera size={16} />}
                    </button>
                  </>
                )}
              </div>
              <div className="avatar-info">
                <h4>{profile?.full_name || 'User'}</h4>
                <p style={{ textTransform: 'capitalize' }}>Role: {userRole}</p>
              </div>
            </div>

            {/* ── ADMIN: Editable form ── */}
            {isAdmin && (
              <form id="profile-form" className="modal-form" onSubmit={handleProfileSave}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="form-input" placeholder="e.g. Your Name" />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" value={email} disabled className="form-input" style={{ opacity: 0.6 }} />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="form-input" placeholder="(555) 123-4567" />
                </div>
                <div className="form-group">
                  <label>Bio / Notes</label>
                  <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} className="form-input" placeholder="A short bio..." />
                </div>
              </form>
            )}

            {/* ── REGULAR USER: Read-only card ── */}
            {!isAdmin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
                {[
                  { icon: <User size={16} />, label: 'Full Name', value: profile?.full_name || '—' },
                  { icon: <Mail size={16} />, label: 'Email Address', value: email || '—' },
                  { icon: <Phone size={16} />, label: 'Phone Number', value: profile?.phone_number || '—' },
                  { icon: <FileText size={16} />, label: 'Bio', value: profile?.bio || '—' },
                ].map(({ icon, label, value }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ color: 'var(--text-secondary)', marginTop: '1px', flexShrink: 0 }}>{icon}</span>
                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                      <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>{value}</p>
                    </div>
                  </div>
                ))}
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
                  Contact your administrator to update your profile information.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS MODAL ────────────────────────────────────────────── */}
        {activeModal === 'settings' && (
          <div className="modal-body settings-modal">
            <div className="settings-tabs">
              <button className={`settings-tab ${settingsTab === 'preferences' ? 'active' : ''}`} onClick={() => setSettingsTab('preferences')}>Preferences</button>
              <button className={`settings-tab ${settingsTab === 'security' ? 'active' : ''}`} onClick={() => setSettingsTab('security')}>Security</button>
            </div>
            <div className="settings-content">
              {settingsTab === 'preferences' && (
                <div className="settings-section">
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <Bell size={20} className="text-secondary" />
                      <div>
                        <h5>Email Notifications</h5>
                        <p>Receive daily summaries of rent collection.</p>
                      </div>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" defaultChecked />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <Moon size={20} className="text-secondary" />
                      <div>
                        <h5>Dark Mode</h5>
                        <p>Switch between light and dark themes.</p>
                      </div>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={isDarkMode} onChange={toggleDarkMode} />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
              )}
              {settingsTab === 'security' && (
                <div className="settings-section">
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <Lock size={20} className="text-secondary" />
                      <div>
                        <h5>Two-Factor Authentication</h5>
                        <p>Add an extra layer of security to your account.</p>
                      </div>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" defaultChecked />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <div className="settings-action-row">
                    <button className="btn-secondary">Change Password</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={isSaving || uploadingImage}>
            {!isAdmin && activeModal === 'profile' ? 'Close' : 'Cancel'}
          </button>
          {(isAdmin || activeModal === 'settings') && activeModal === 'profile' && (
            <button
              type="submit"
              form="profile-form"
              className="btn-primary"
              disabled={isSaving || uploadingImage}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
          {activeModal === 'settings' && (
            <button className="btn-primary" onClick={onClose}>Done</button>
          )}
        </div>
      </div>
    </div>
  );
};
