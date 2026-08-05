import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './LiquidGlassModal.css';

// ── MODAL COUNTER: tracks how many overlays are open ──────────────────────
// We use a counter instead of a boolean class so nested/stacked modals
// don't prematurely remove the class when one closes.
let _activeModalCount = 0;

function incrementModalCount() {
  _activeModalCount++;
  document.body.classList.add('lg-modal-active');
}

function decrementModalCount() {
  _activeModalCount = Math.max(0, _activeModalCount - 1);
  if (_activeModalCount === 0) {
    document.body.classList.remove('lg-modal-active');
  }
}

// ── LAYER 2 & 3: APPLICATION DE-EMPHASIS & ATMOSPHERIC GLASS ─────────────

export const LiquidGlassOverlay: React.FC<{ children: React.ReactNode, onClose?: () => void }> = ({ children, onClose }) => {
  useEffect(() => {
    incrementModalCount();
    return () => {
      decrementModalCount();
    };
  }, []);

  const content = (
    <div className="lg-overlay">
      {/* Atmospheric glass layer — pointer-events: none so it never blocks modal content */}
      <div className="lg-atmospheric-glass" />
      {/* If the user clicks exactly on the container (the padding/empty area), trigger onClose.
          If they click inside the window shell, it bubbles here but e.target != e.currentTarget. */}
      <div className="lg-modal-container" onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}>
        {children}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

// ── LAYER 4: FLOATING WINDOW SHELL & GLASS SURFACE ───────────────────────

export const LiquidGlassWindow: React.FC<{ children: React.ReactNode, className?: string, style?: React.CSSProperties }> = ({ children, className = '', style }) => {
  return (
    <div className={`lg-window-shell ${className}`} style={style}>
      <div className="lg-glass-surface">
        <div className="lg-reflection-layer" />
        {children}
      </div>
    </div>
  );
};

// ── CONTENT SURFACE ───────────────────────────────────────────────────────

export const LiquidGlassContent: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => {
  return (
    <div className={`lg-content-surface ${className}`}>
      {children}
    </div>
  );
};

// ── INTERACTIVE SURFACE (INPUTS) ──────────────────────────────────────────

interface LiquidGlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const LiquidGlassInput = React.forwardRef<HTMLInputElement, LiquidGlassInputProps>(
  ({ label, className = '', ...props }, ref) => {
    return (
      <div className="lg-input-group">
        {label && <label className="lg-input-label">{label}</label>}
        <div className="lg-input-wrapper">
          <input ref={ref} className={`lg-input ${className}`} {...props} />
        </div>
      </div>
    );
  }
);
LiquidGlassInput.displayName = 'LiquidGlassInput';

// ── INTERACTIVE SURFACE (TEXTAREA) ────────────────────────────────────────

interface LiquidGlassTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const LiquidGlassTextarea = React.forwardRef<HTMLTextAreaElement, LiquidGlassTextareaProps>(
  ({ label, className = '', ...props }, ref) => {
    return (
      <div className="lg-input-group">
        {label && <label className="lg-input-label">{label}</label>}
        <div className="lg-input-wrapper">
          <textarea ref={ref} className={`lg-input ${className}`} {...props} />
        </div>
      </div>
    );
  }
);
LiquidGlassTextarea.displayName = 'LiquidGlassTextarea';

// ── INTERACTIVE SURFACE (CUSTOM SELECT) ───────────────────────────────────

interface LiquidGlassCustomSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  className?: string;
}

export const LiquidGlassCustomSelect: React.FC<LiquidGlassCustomSelectProps> = ({ 
  label, value, onChange, options, className = '' 
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  const selectedOption = options.find(o => o.value === value);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="lg-input-group" ref={containerRef}>
      {label && <label className="lg-input-label">{label}</label>}
      <div className="lg-input-wrapper" style={{ position: 'relative' }}>
        <div 
          className={`lg-input ${className}`}
          style={{ 
            cursor: 'pointer', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            boxShadow: isOpen ? '0 0 0 4px rgba(255, 255, 255, 0.25)' : undefined,
          }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{selectedOption?.label || 'Select...'}</span>
          <svg 
            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
            style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none', opacity: 0.6 }}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        
        {isOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '8px',
            background: 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(24px) saturate(200%)',
            WebkitBackdropFilter: 'blur(24px) saturate(200%)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            borderRadius: '16px',
            overflow: 'hidden',
            zIndex: 1000,
            boxShadow: '0 10px 40px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.4)',
            animation: 'lgInputEnter 0.2s ease-out forwards'
          }}>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {options.map(opt => (
                <div 
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  style={{
                    padding: '12px 18px',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    fontWeight: opt.value === value ? 600 : 400,
                    background: opt.value === value ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = opt.value === value ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = opt.value === value ? 'rgba(255, 255, 255, 0.2)' : 'transparent'}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
