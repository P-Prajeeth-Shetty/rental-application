import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface Option {
  label: string;
  value: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  width?: string;
  searchable?: boolean;
  menuPlacement?: 'bottom' | 'top';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Select...',
  width = '100%',
  searchable = false,
  menuPlacement = 'bottom'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen, searchable]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery) return options;
    return options.filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [options, searchable, searchQuery]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width, userSelect: 'none' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
          background: 'var(--bg-surface)', border: '2px solid var(--input-border)',
          fontSize: '0.95rem', color: selectedOption ? 'var(--text-primary)' : 'var(--text-secondary)',
          boxShadow: isOpen ? '0 0 0 3px rgba(222, 163, 137, 0.2)' : 'none',
          borderColor: isOpen ? 'var(--primary-accent)' : 'var(--input-border)',
          transition: 'all 0.2s',
          height: '42px', boxSizing: 'border-box'
        }}
      >
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
          {selectedOption?.label || placeholder}
        </div>
        <ChevronDown size={18} style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none', flexShrink: 0, color: 'var(--text-secondary)' }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', 
          ...(menuPlacement === 'bottom' ? { top: '100%', marginTop: '8px' } : { bottom: '100%', marginBottom: '8px' }),
          left: 0, right: 0,
          background: '#ffffff', boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          border: '1px solid var(--border-color)', borderRadius: '8px',
          zIndex: 1000, 
          display: 'flex', flexDirection: 'column'
        }}>
          {searchable && (
            <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.03)', borderRadius: '6px', padding: '6px 10px' }}>
                <Search size={14} style={{ color: 'var(--text-secondary)', marginRight: '6px' }} />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.9rem', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          )}
          <div style={{ maxHeight: '250px', overflowY: 'auto', padding: '4px' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No results found</div>
            ) : (
              filteredOptions.map(opt => (
                <div 
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  style={{
                    padding: '10px 12px', cursor: 'pointer', fontSize: '0.9rem',
                    color: opt.value === value ? 'var(--primary-accent)' : 'var(--text-primary)',
                    background: opt.value === value ? 'rgba(222, 163, 137, 0.1)' : 'transparent',
                    transition: 'background 0.1s', borderRadius: '6px',
                    fontWeight: opt.value === value ? 600 : 400,
                    marginBottom: '2px',
                  }}
                  onMouseEnter={(e) => {
                    if (opt.value !== value) e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (opt.value !== value) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
