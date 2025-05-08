import React from 'react';

export function Button({ asChild, variant = 'default', className, children, ...props }) {
  const baseStyles = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  
  const variantStyles = {
    default: 'bg-[#d9a441] text-[#1f2b38] hover:bg-[#d9a441]/90',
    ghost: 'hover:bg-[#d9a441]/10',
  };
  
  const Component = asChild ? 'div' : 'button';
  
  return (
    <Component
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
} 