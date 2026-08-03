import React, { useState, useEffect } from 'react';
import { Clock, MoreHorizontal } from 'lucide-react';
import './layout.css';

export const TimePill: React.FC = () => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    
    updateTime(); // Initial call
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="time-pill">
      <div className="time-pill-icon-left">
        <Clock size={16} color="var(--text-primary)" strokeWidth={2.5} />
      </div>
      <span className="time-pill-text">{time}</span>
      <div className="time-pill-icon-right">
        <MoreHorizontal size={16} color="var(--text-secondary)" strokeWidth={2.5} />
      </div>
    </div>
  );
};
