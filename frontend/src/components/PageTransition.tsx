'use client';

import { usePathname } from 'next/navigation';

/**
 * Suaviza el cambio entre páginas del panel (cada página del dashboard monta
 * su propio Sidebar/Topbar, así que Next.js reemplaza el árbol entero al
 * navegar). Sin esto el contenido aparecía de golpe; con la key por ruta,
 * React desmonta/monta el div y dispara el fade-in de globals.css en cada
 * cambio de menú. Respeta prefers-reduced-motion (ver globals.css).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}
