import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronUp, ChevronDown, Check } from 'lucide-react';

interface CustomDatePickerProps {
  name: string;
  defaultValue?: string;
  required?: boolean;
}

const getRoundedTime = () => {
  const now = new Date();
  const minutes = now.getMinutes();
  const remainder = minutes % 5;
  const add = remainder === 0 ? 0 : 5 - remainder;
  now.setMinutes(minutes + add);
  return { h: now.getHours(), m: now.getMinutes() };
};

const getDaysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate();

const SpinBox = ({ value, label, max, min = 0, onChange }: { value: number, label: string, max: number, min?: number, onChange: (v: number) => void }) => {
  const handleInc = () => onChange(value >= max ? min : value + 1);
  const handleDec = () => onChange(value <= min ? max : value - 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '50px' }}>
      <button type="button" onClick={handleInc} style={{ width: '100%', padding: '6px', border: 'none', background: 'rgba(255,255,255,0.4)', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', color: 'var(--text-secondary)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.6)'} onMouseOut={e => e.currentTarget.style.background='rgba(255,255,255,0.4)'}>
        <ChevronUp size={16} />
      </button>
      <div style={{ width: '100%', padding: '8px 0', background: 'rgba(255,255,255,0.8)', textAlign: 'center', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', borderTop: '1px solid rgba(0,0,0,0.05)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        {String(value).padStart(2, '0')}
      </div>
      <button type="button" onClick={handleDec} style={{ width: '100%', padding: '6px', border: 'none', background: 'rgba(255,255,255,0.4)', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', color: 'var(--text-secondary)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.6)'} onMouseOut={e => e.currentTarget.style.background='rgba(255,255,255,0.4)'}>
        <ChevronDown size={16} />
      </button>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
    </div>
  );
};

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ name, defaultValue = '', required }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const initialDate = defaultValue ? new Date(defaultValue.split('T')[0]) : new Date();
  const initialTime = defaultValue && defaultValue.includes('T') ? defaultValue.split('T')[1] : null;
  const initialH = initialTime ? parseInt(initialTime.split(':')[0], 10) : getRoundedTime().h;
  const initialM = initialTime ? parseInt(initialTime.split(':')[1], 10) : getRoundedTime().m;

  const [day, setDay] = useState(initialDate.getDate());
  const [month, setMonth] = useState(initialDate.getMonth() + 1);
  const [year, setYear] = useState(initialDate.getFullYear());
  const [hour, setHour] = useState(initialH);
  const [minute, setMinute] = useState(initialM);

  const [inputValue, setInputValue] = useState('');

  // Set initial input format DD/MM/YYYY HH:mm
  useEffect(() => {
    if (defaultValue) {
      const dd = String(initialDate.getDate()).padStart(2, '0');
      const mm = String(initialDate.getMonth() + 1).padStart(2, '0');
      const yyyy = initialDate.getFullYear();
      const hh = String(initialH).padStart(2, '0');
      const min = String(initialM).padStart(2, '0');
      setInputValue(`${dd}/${mm}/${yyyy} ${hh}:${min}`);
    }
  }, [defaultValue]);

  // Keep day valid when month/year changes
  useEffect(() => {
    const maxDays = getDaysInMonth(month, year);
    if (day > maxDays) setDay(maxDays);
  }, [month, year, day]);

  const openPopup = () => {
    if (containerRef.current) {
      setRect(containerRef.current.getBoundingClientRect());
      setIsOpen(true);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => {
      if (containerRef.current) setRect(containerRef.current.getBoundingClientRect());
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node) && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('resize', handleScrollOrResize, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen]);

  const handleApply = () => {
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    const yyyy = year;
    const hh = String(hour).padStart(2, '0');
    const min = String(minute).padStart(2, '0');
    setInputValue(`${dd}/${mm}/${yyyy} ${hh}:${min}`);
    setIsOpen(false);
  };

  const parseInputFormat = (val: string, updateState: boolean = false) => {
    const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})\s(\d{2}):(\d{2})$/);
    if (match) {
      const [_, dd, mm, yyyy, hh, min] = match;
      const d = parseInt(dd, 10);
      const m = parseInt(mm, 10);
      const y = parseInt(yyyy, 10);
      const h = parseInt(hh, 10);
      const mn = parseInt(min, 10);
      
      if (m >= 1 && m <= 12 && d >= 1 && d <= getDaysInMonth(m, y) && h >= 0 && h <= 23 && mn >= 0 && mn <= 59) {
        if (updateState) {
          setDay(d); setMonth(m); setYear(y); setHour(h); setMinute(mn);
        }
        return { dateStr: `${y}-${mm}-${dd}`, timeStr: `${hh}:${min}` };
      }
    }
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    parseInputFormat(e.target.value, true);
  };

  // Convert current stepper states to ISO string for hidden input (so form submits correctly)
  const parsed = parseInputFormat(inputValue, false);
  const hiddenValue = parsed ? `${parsed.dateStr}T${parsed.timeStr}` : '';

  return (
    <div style={{ position: 'relative', width: '100%' }} ref={containerRef}>
      <input 
        type="text" 
        placeholder="DD/MM/YYYY HH:mm"
        value={inputValue}
        onChange={handleInputChange}
        onClick={openPopup}
        style={{
          width: '100%', padding: '10px 12px', paddingRight: '40px', borderRadius: '8px', 
          background: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(0,0,0,0.1)',
          fontSize: '0.95rem', color: 'var(--text-primary)', transition: 'all 0.2s', boxSizing: 'border-box', outline: 'none'
        }}
      />
      <CalendarIcon size={16} style={{ color: 'var(--text-muted)', position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      <input type="hidden" name={name} value={hiddenValue} required={required} />

      {isOpen && rect && createPortal(
        <div ref={popupRef} className="ignore-click-outside" style={{
          position: 'fixed',
          top: rect.bottom + 8,
          left: rect.left,
          background: 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(24px) saturate(200%)',
          WebkitBackdropFilter: 'blur(24px) saturate(200%)',
          padding: '20px',
          borderRadius: '16px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.12), inset 0 2px 4px rgba(255,255,255,0.8)',
          border: '1px solid rgba(255,255,255,0.7)',
          zIndex: 1000,
          animation: 'stepperFadeIn 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        }}>
          <style>{`
            @keyframes stepperFadeIn {
              from { opacity: 0; transform: translateY(-8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <SpinBox label="Day" value={day} min={1} max={getDaysInMonth(month, year)} onChange={setDay} />
            <SpinBox label="Month" value={month} min={1} max={12} onChange={setMonth} />
            <SpinBox label="Year" value={year} min={new Date().getFullYear() - 5} max={new Date().getFullYear() + 10} onChange={setYear} />
            <div style={{ width: '1px', background: 'rgba(0,0,0,0.1)', margin: '0 4px' }} />
            <SpinBox label="Hour" value={hour} max={23} onChange={setHour} />
            <SpinBox label="Min" value={minute} max={59} onChange={setMinute} />
          </div>
          <button type="button" onClick={handleApply} style={{
            width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
            background: '#dea389', color: 'white', fontWeight: 600, fontSize: '0.9rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: '0 4px 12px rgba(222, 163, 137, 0.3)'
          }}>
            <Check size={18} /> Apply Date & Time
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

