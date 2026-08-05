import React from 'react';
import { createPortal } from 'react-dom';

interface GlassWorkspacePanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const GlassWorkspacePanel: React.FC<GlassWorkspacePanelProps> = ({ 
  isOpen, 
  onClose, 
  children 
}) => {
  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Invisible backdrop just for click-to-close. No blur, no dimming. */}
      <div 
        className="glass-workspace-backdrop"
        onClick={onClose}
      />
      
      {/* The floating glass panel */}
      <div 
        className="glass-workspace-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  );
};
