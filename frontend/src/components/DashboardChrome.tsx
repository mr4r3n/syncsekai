'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { PageTransition } from './PageTransition';

/**
 * El sidebar vive aquí, una sola vez para todo el panel: montarlo en cada
 * página lo desmontaba en cada navegación y parpadeaba. Al ser
 * `position: fixed` no necesita vivir en el árbol de cada página.
 *
 * /docs es la excepción: es pública y decide ELLA MISMA si mostrar el
 * sidebar (con sesión) o una cabecera pública (visitante anónimo, ver
 * AuthGuard). Si el sidebar se montara aquí también para /docs, alguien con
 * sesión vería dos sidebars superpuestos.
 */
export function DashboardChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showPersistentSidebar = !pathname.startsWith('/docs');

  return (
    <>
      {showPersistentSidebar && <Sidebar />}
      <PageTransition>{children}</PageTransition>
    </>
  );
}
