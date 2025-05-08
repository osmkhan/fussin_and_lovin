import React from 'react';

export function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function DialogContent({ className, children, ...props }) {
  return (
    <div className={`rounded-lg shadow-lg ${className}`} {...props}>
      {children}
    </div>
  );
} 