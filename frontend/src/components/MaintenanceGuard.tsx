'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Si ya estamos en /maintenance, no comprobar ni redirigir
    if (pathname.startsWith('/maintenance')) {
      setChecked(true);
      return;
    }

    // Rutas administrativas o internas que los administradores pueden usar para gestionar
    // Las rutas de autenticacion tienen que quedar fuera o el mantenimiento se
    // vuelve una trampa: sin sesion no eres admin, asi que /login rebotaba a
    // /maintenance y nadie podia entrar nunca a administrar. El propio enlace
    // "Iniciar Sesion de Staff" de esa pantalla devolvia al punto de partida.
    const isExemptRoute =
      pathname.startsWith('/admin') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/forgot-password') ||
      pathname.startsWith('/reset-password') ||
      pathname.startsWith('/terms') ||
      pathname.startsWith('/privacy');

    api.setup
      .getMaintenanceStatus()
      .then(async (status) => {
        if (status.inMaintenance) {
          // Comprobar si el usuario actual es administrador
          const me = await api.auth.me().catch(() => null);
          const user = me?.user || me;
          const isAdmin = user && user.role === 'ADMIN';

          if (!isAdmin && !isExemptRoute) {
            router.replace('/maintenance');
          }
        }
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [pathname]);

  return <>{children}</>;
}
