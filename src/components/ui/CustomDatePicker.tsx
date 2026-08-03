import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface CustomDatePickerProps {
  name: string;
  defaultValue?: string;
  required?: boolean;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ name, defaultValue = '', required }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parse current value or use today
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (defaultValue) {
      const d = new Date(defaultValue);
      if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  
  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  
  const handleSelectDate = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    // Format as YYYY-MM-DD
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    setValue(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };
  
  const renderCalendar = () => {
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} style={{ width: '32px', height: '32px' }}></div>);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const isSelected = value && new Date(value).getDate() === i && new Date(value).getMonth() === currentMonth.getMonth() && new Date(value).getFullYear() === currentMonth.getFullYear();
      const isToday = new Date().getDate() === i && new Date().getMonth() === new Date().getMonth() && new Date().getFullYear() === new Date().getFullYear();
      
      days.push(
        <div 
          key={`day-${i}`}
          onClick={() => handleSelectDate(i)}
          style={{ 
            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', cursor: 'pointer', fontSize: '0.85rem',
            background: isSelected ? 'var(--primary-accent)' : 'transparent',
            color: isSelected ? 'var(--bg-main)' : (isToday ? 'var(--primary-accent)' : 'var(--text-primary)'),
            fontWeight: isSelected || isToday ? 600 : 400,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!isSelected) e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
          }}
          onMouseLeave={(e) => {
            if (!isSelected) e.currentTarget.style.background = 'transparent';
          }}
        >
          {i}
        </div>
      );
    }
    return days;
  };
  
  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
          background: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(0,0,0,0.1)',
          fontSize: '0.95rem', color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          boxShadow: isOpen ? '0 0 0 3px rgba(222, 163, 137, 0.2)' : 'none',
          borderColor: isOpen ? 'var(--primary-accent)' : 'rgba(0,0,0,0.1)',
          transition: 'all 0.2s', boxSizing: 'border-box', width: '100%'
        }}
      >
        {value ? new Date(value + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Select a date'}
        <CalendarIcon size={16} style={{ color: 'var(--text-muted)' }} />
      </div>
      
      {/* Hidden input to pass value back to forms */}
      <input type="hidden" name={name} value={value} required={required} />
      
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: '8px', padding: '16px',
          background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.8)', borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 100, width: '260px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button type="button" onClick={handlePrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '50%', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={20} />
            </button>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </div>
            <button type="button" onClick={handleNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '50%', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={20} />
            </button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', justifyItems: 'center', marginBottom: '8px' }}>
            {dayNames.map(day => (
              <div key={day} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', width: '32px', textAlign: 'center' }}>
                {day}
              </div>
            ))}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', justifyItems: 'center' }}>
            {renderCalendar()}
          </div>
        </div>
      )}
    </div>
  );
};
