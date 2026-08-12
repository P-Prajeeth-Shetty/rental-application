import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Clock, MoreHorizontal, Check } from 'lucide-react';
import './layout.css';

export const TimePill: React.FC = () => {
  const [time, setTime] = useState<string>('');
  const [format, setFormat] = useState<'12h' | '24h'>('12h');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{top: number, left: number} | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: format === '12h'
      }));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [format]);

  // Handle portal positioning and clicks outside
  useEffect(() => {
    if (!isMenuOpen) return;
    
    const updateRect = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mainContainer = document.querySelector('.main-glass-container');
        
        if (mainContainer) {
          const mainRect = mainContainer.getBoundingClientRect();
          setCoords({
            top: rect.top - mainRect.top, // Align top with TimePill
            left: rect.right - mainRect.left + 16 // 16px to the right of TimePill
          });
        } else {
          setCoords({
            top: rect.top,
            left: rect.right + 16
          });
        }
      }
    };
    
    updateRect();

    const handleScrollOrResize = () => {
      updateRect();
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target) &&
          containerRef.current && !containerRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const portalTarget = document.querySelector('.main-glass-container') || document.body;

  return (
    <div className="time-pill" ref={containerRef} style={{ position: 'relative' }}>
      <div className="time-pill-icon-left">
        <Clock size={16} color="var(--text-primary)" strokeWidth={2.5} />
      </div>
      <span className="time-pill-text">{time}</span>
      <div 
        className="time-pill-icon-right" 
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        style={{ cursor: 'pointer', transition: 'background 0.2s', borderRadius: '1px' }}
      >
        <MoreHorizontal size={16} color="var(--text-secondary)" strokeWidth={2.5} />
      </div>

      {isMenuOpen && coords && createPortal(
        <div 
          ref={menuRef}
          className="profile-dropdown ignore-click-outside" 
          style={{ 
            position: 'absolute', // Absolute to the main-glass-container
            top: coords.top, 
            left: coords.left,
            right: 'auto',
            width: '200px',
            minWidth: '160px',
            padding: '8px', 
            zIndex: 1000,
            transformOrigin: 'top left'
          }}
        >
          <div className="dropdown-header" style={{ padding: '4px 8px 8px' }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Time Format</h4>
          </div>
          <button 
            className="dropdown-item" 
            onClick={() => { setFormat('12h'); setIsMenuOpen(false); }}
            style={{ display: 'flex', justifyContent: 'space-between' }}
          >
            12-Hour (AM/PM)
            {format === '12h' && <Check size={16} color="var(--text-primary)" />}
          </button>
          <button 
            className="dropdown-item" 
            onClick={() => { setFormat('24h'); setIsMenuOpen(false); }}
            style={{ display: 'flex', justifyContent: 'space-between' }}
          >
            24-Hour
            {format === '24h' && <Check size={16} color="var(--text-primary)" />}
          </button>
        </div>,
        portalTarget
      )}
    </div>
  );
};
