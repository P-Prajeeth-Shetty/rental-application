import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface WidgetPortalOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  targetRef: React.RefObject<HTMLElement>;
  children: React.ReactNode;
}

export const WidgetPortalOverlay: React.FC<WidgetPortalOverlayProps> = ({
  isOpen,
  onClose,
  targetRef,
  children
}) => {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [borderRadius, setBorderRadius] = useState('24px'); // Default
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !targetRef.current) return;

    const updateRect = () => {
      if (targetRef.current) {
        setRect(targetRef.current.getBoundingClientRect());
        const computed = window.getComputedStyle(targetRef.current);
        if (computed.borderRadius) {
          setBorderRadius(computed.borderRadius);
        }
      }
    };

    updateRect();

    const handleScrollOrResize = () => {
      updateRect();
    };

    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
    };
  }, [isOpen, targetRef]);

  // Handle clicks outside the overlay to close it
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      // Ignore clicks on date picker portals or anything explicitly marked
      if (target.closest('.ignore-click-outside')) {
        return;
      }
      if (overlayRef.current && overlayRef.current.contains(target as Node)) {
        return;
      }
      // Delay closing slightly so it doesn't conflict with the open button click
      setTimeout(() => onClose(), 0);
    };

    // Use capturing phase so we intercept before other things
    document.addEventListener('mousedown', handleClickOutside, { capture: true });
    return () => document.removeEventListener('mousedown', handleClickOutside, { capture: true });
  }, [isOpen, onClose]);

  if (!isOpen || !rect) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="widget-portal-overlay"
      style={{
        position: 'fixed',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        background: 'rgba(255, 255, 255, 0.4)', // Base overlay tint
        backdropFilter: 'blur(24px) saturate(200%)',
        WebkitBackdropFilter: 'blur(24px) saturate(200%)',
        zIndex: 'var(--z-overlay, 300)',
        borderRadius: borderRadius,
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        boxShadow: '0 24px 60px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.6)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        borderTop: '1px solid rgba(255, 255, 255, 0.8)',
        animation: 'lgOverlayEnter 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <style>{`
        @keyframes lgOverlayEnter {
          from { opacity: 0; transform: scale(0.98) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden'
      }}>
        {children}
      </div>
    </div>,
    document.body
  );
};
