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
        // En móvil el sidebar fijo está oculto; se maneja con drawer
        setIsCollapsed(false);
        setIsLocked(false);
      } else if (width >= 768 && width < 1150) {
        // En pantallas medianas / reducidas, forzar colapso a solo iconos y bloquear descolapso
        setIsCollapsed(true);
        setIsLocked(true);
      } else {
        // En pantallas grandes (>= 1150px), volver automáticamente a tamaño completo
        setIsCollapsed(false);
        setIsLocked(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cerrar el drawer en móvil cuando cambie la ruta
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    // Si la pantalla es mediana (< 1150px), no permitir descolapsar para no romper los contenedores
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
