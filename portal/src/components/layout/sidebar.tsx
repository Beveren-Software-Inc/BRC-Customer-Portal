import { createContext, useContext } from 'react';

// Create a simple toggle context to bridge between main-layout and navbar
interface ToggleSidebarContextType {
  toggle: () => void;
}

export const ToggleSidebarContext = createContext<ToggleSidebarContextType | null>(null);

export const useToggleSidebar = () => {
  const context = useContext(ToggleSidebarContext);
  if (!context) {
    throw new Error('useToggleSidebar must be used within a ToggleSidebarProvider');
  }
  return context;
};
