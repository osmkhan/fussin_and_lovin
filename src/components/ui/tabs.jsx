import React, { createContext, useContext, useState } from 'react';

const TabsContext = createContext();

export function Tabs({ defaultValue, children, className }) {
  const [value, setValue] = useState(defaultValue);
  
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }) {
  return (
    <div className={`flex space-x-1 ${className}`}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className }) {
  const { value: selectedValue, setValue } = useContext(TabsContext);
  const isSelected = value === selectedValue;
  
  return (
    <button
      className={`px-3 py-2 rounded-md ${
        isSelected
          ? 'bg-[#d9a441] text-[#1f2b38]'
          : 'text-[#c5a77d] hover:bg-[#d9a441]/10'
      } ${className}`}
      onClick={() => setValue(value)}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className }) {
  const { value: selectedValue } = useContext(TabsContext);
  
  if (value !== selectedValue) return null;
  
  return <div className={className}>{children}</div>;
} 