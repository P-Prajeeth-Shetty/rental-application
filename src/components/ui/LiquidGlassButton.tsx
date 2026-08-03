import React from 'react';
import './LiquidGlassButton.css';

interface LiquidGlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  active?: boolean;
}

export const LiquidGlassButton: React.FC<LiquidGlassButtonProps> = ({ 
  children, 
  icon, 
  active, 
  className = '', 
  ...props 
}) => {
  return (
    <button 
      className={`liquid-glass-btn ${active ? 'active-state' : ''} ${className}`}
      {...props}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  );
};
