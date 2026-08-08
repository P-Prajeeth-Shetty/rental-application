import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import './LiquidGlassModal.css';

interface LiquidGlassDatePickerProps {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  required?: boolean;
}

export const LiquidGlassDatePicker: React.FC<LiquidGlassDatePickerProps> = ({
  label,
  value,
  onChange,
  required
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Current month/year being viewed in the calendar
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const [y, m, d] = value.split('-');
      if (y && m && d) {
        return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      }
    }
    return new Date();
  });

  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();
  
  const totalDays = daysInMonth(currentYear, currentMonth);
  const firstDay = firstDayOfMonth(currentYear, currentMonth);

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };
  
  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleSelect = (day: number) => {
    const m = (currentMonth + 1).toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    onChange(`${currentYear}-${m}-${d}`);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setViewDate(now);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Selected date parts
  let selY = 0, selM = -1, selD = 0;
  if (value) {
    const parts = value.split('-');
    if(parts.length >= 3) {
      selY = parseInt(parts[0]);
      selM = parseInt(parts[1]) - 1;
      selD = parseInt(parts[2]);
    }
  }

  // Convert YYYY-MM-DD to DD-MM-YYYY for display
  const formatDisplay = (iso: string) => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length >= 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return iso;
  };

  const [textValue, setTextValue] = useState(formatDisplay(value));

  // Sync if parent changes value
  useEffect(() => {
    setTextValue(formatDisplay(value));
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    const isDeleting = (e.nativeEvent as any).inputType === 'deleteContentBackward';
    
    // Keep only digits
    let digits = val.replace(/\D/g, '');
    if (digits.length > 8) digits = digits.slice(0, 8);

    // Format with hyphens
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    }
    
    // Auto-append hyphen when user types the 2nd and 4th digit
    if (!isDeleting) {
      if (digits.length === 2) formatted += '-';
      if (digits.length === 4) formatted += '-';
    }

    setTextValue(formatted);
    
    // Auto-parse DD-MM-YYYY to YYYY-MM-DD if valid
    const match = formatted.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) {
      const d = match[1];
      const m = match[2];
      const y = match[3];
      onChange(`${y}-${m}-${d}`);
      setViewDate(new Date(parseInt(y), parseInt(m) - 1, parseInt(d)));
    } else if (digits === '') {
      onChange('');
    }
  };

  return (
    <div className="lg-input-group" style={{ position: 'relative' }}>
      {label && (
        <label className="lg-input-label">
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input 
          className="lg-input"
          type="text"
          placeholder="DD-MM-YYYY"
          required={required}
          value={textValue}
          onChange={handleTextChange}
          onFocus={() => setIsOpen(true)}
          style={{ width: '100%', paddingRight: '40px' }}
        />
        <div 
          onClick={() => setIsOpen(!isOpen)}
          style={{ 
            position: 'absolute', 
            right: '14px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            cursor: 'pointer',
            color: '#FF7700',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Calendar size={18} />
        </div>
      </div>

      {isOpen && (
        <div 
          ref={popoverRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 10000,
            width: '300px',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1.5px solid #fed7aa',
            boxShadow: '0 16px 40px rgba(0,0,0,0.15), 0 4px 14px rgba(255, 119, 0, 0.1)',
            padding: '18px',
            color: '#111827',
            animation: 'lgInputEnter 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button 
              type="button"
              onMouseDown={prevMonth} 
              style={{ background: '#fff7ed', border: '1px solid #fed7aa', cursor: 'pointer', color: '#FF7700', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={18} />
            </button>
            <strong style={{ fontSize: '0.95rem', color: '#111827', fontWeight: 700 }}>{monthNames[currentMonth]} {currentYear}</strong>
            <button 
              type="button"
              onMouseDown={nextMonth} 
              style={{ background: '#fff7ed', border: '1px solid #fed7aa', cursor: 'pointer', color: '#FF7700', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Days of Week Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '8px', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280' }}>
            {daysOfWeek.map(d => <div key={d}>{d}</div>)}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1;
              const isSelected = day === selD && currentMonth === selM && currentYear === selY;
              const isToday = day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear();
              
              return (
                <div 
                  key={day}
                  onClick={() => handleSelect(day)}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '34px',
                    fontSize: '0.85rem',
                    fontWeight: isSelected ? 700 : 500,
                    borderRadius: '8px',
                    background: isSelected ? '#FF7700' : isToday ? '#fff7ed' : 'transparent',
                    color: isSelected ? '#ffffff' : isToday ? '#FF7700' : '#111827',
                    border: isToday && !isSelected ? '1.5px solid #fed7aa' : '1px solid transparent',
                    boxShadow: isSelected ? '0 4px 10px rgba(255, 119, 0, 0.3)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background = '#ffedd5' }}
                  onMouseLeave={e => { if(!isSelected) e.currentTarget.style.background = isToday ? '#fff7ed' : 'transparent' }}
                >
                  {day}
                </div>
              )
            })}
          </div>

          {/* Quick Footer Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
            <button 
              type="button"
              onClick={handleClear}
              style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', padding: '4px 8px' }}
            >
              Clear
            </button>
            <button 
              type="button"
              onClick={handleSelectToday}
              style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#FF7700', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', padding: '4px 12px', borderRadius: '6px' }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
