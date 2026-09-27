'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface SidebarContextType {
  isCollapsed: boolean;
  isLocked: boolean;
  toggleCollapsed: () => void;
  isMobileOpen: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  // Escuchar redimensionamiento de pantalla
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        // On mobile the fixed sidebar is hidden; handled with drawer
        setIsCollapsed(false);
        setIsLocked(false);
      } else if (width >= 768 && width < 1150) {
        // On medium / smaller screens, force collapse to icons only and block expanding
        setIsCollapsed(true);
        setIsLocked(true);
      } else {
        // On large screens (>= 1150px), automatically return to full size
        setIsCollapsed(false);
        setIsLocked(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close drawer on mobile when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    // If screen is medium (< 1150px), prevent expanding to avoid breaking containers
    if (isLocked) return;
    setIsCollapsed((prev) => !prev);
  };

  const toggleMobile = () => {
    setIsMobileOpen((prev) => !prev);
  };

  const closeMobile = () => {
    setIsMobileOpen(false);
  };

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        isLocked,
        toggleCollapsed,
        isMobileOpen,
        toggleMobile,
        closeMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    return {
      isCollapsed: false,
      isLocked: false,
      toggleCollapsed: () => {},
      isMobileOpen: false,
      toggleMobile: () => {},
      closeMobile: () => {},
    };
  }
  return context;
}
