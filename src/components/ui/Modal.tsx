import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = '600px' }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'none', zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="surface-card" style={{ width: '90%', maxWidth, maxHeight: '85vh', overflowY: 'auto', padding: '32px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)' }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const Drawer: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = '600px' }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'flex-end' }}>
      <div className="surface-card" style={{ width: '100%', maxWidth, height: '100vh', borderRadius: '0', display: 'flex', flexDirection: 'column', padding: '32px', overflowY: 'auto', borderLeft: '1px solid var(--border-color)', animation: 'slideInRight 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)' }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export const ModalInput = (props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => {
  const { label, ...inputProps } = props;
  return (
    <div style={{ flex: 1 }}>
      <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </label>
      <input 
        {...inputProps}
        style={{
          padding: '10px 14px',
          borderRadius: '2px',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-main)',
          color: 'var(--text-primary)',
          fontSize: '0.95rem',
          outline: 'none',
          width: '100%',
          fontFamily: 'inherit',
          ...inputProps.style
        }}
      />
    </div>
  );
};

export const ModalTextarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) => {
  const { label, ...textareaProps } = props;
  return (
    <div style={{ flex: 1 }}>
      <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </label>
      <textarea 
        {...textareaProps}
        style={{
          padding: '10px 14px',
          borderRadius: '2px',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-main)',
          color: 'var(--text-primary)',
          fontSize: '0.95rem',
          outline: 'none',
          width: '100%',
          fontFamily: 'inherit',
          resize: 'vertical',
          ...textareaProps.style
        }}
      />
    </div>
  );
};

export const ModalSelect = (props: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string, options: {value: string, label: string}[] }) => {
  const { label, options, ...selectProps } = props;
  return (
    <div style={{ flex: 1 }}>
      <label style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </label>
      <select 
        {...selectProps}
        style={{
          padding: '10px 14px',
          borderRadius: '2px',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-main)',
          color: 'var(--text-primary)',
          fontSize: '0.95rem',
          outline: 'none',
          width: '100%',
          fontFamily: 'inherit',
          ...selectProps.style
        }}
      >
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
};

export const ModalActionButtons = ({ onCancel, submitText, isSubmitting, isDanger = false, customSubmitAction }: { onCancel: () => void, submitText: string, isSubmitting?: boolean, isDanger?: boolean, customSubmitAction?: () => void }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
      <button type="button" onClick={onCancel} disabled={isSubmitting} style={{ padding: '10px 20px', borderRadius: '2px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-main)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
        Cancel
      </button>
      <button type={customSubmitAction ? "button" : "submit"} onClick={customSubmitAction} disabled={isSubmitting} style={{ padding: '10px 20px', borderRadius: '2px', border: 'none', background: isDanger ? 'var(--danger, #ef4444)' : 'var(--primary-accent, #fb5d3e)', color: 'white', fontWeight: 600, cursor: 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
        {isSubmitting ? (isDanger ? 'Deleting...' : 'Saving...') : submitText}
      </button>
    </div>
  );
};
