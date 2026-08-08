import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import './dashboard.css';

interface Option {
  value: string;
  label: string;
}

interface ChartDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: Option[];
}

export const ChartDropdown: React.FC<ChartDropdownProps> = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="custom-chart-dropdown">
      <button 
        type="button" 
        className="dropdown-trigger-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown size={15} className={`chevron-icon ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="dropdown-menu-popover">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`dropdown-menu-item ${opt.value === value ? 'active' : ''}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
