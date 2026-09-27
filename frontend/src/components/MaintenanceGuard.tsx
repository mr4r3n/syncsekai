'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // If already on /maintenance, do not check or redirect
    if (pathname.startsWith('/maintenance')) {
      setChecked(true);
      return;
    }

    // Administrative or internal routes that administrators can use to manage
    // Authentication routes must be excluded or maintenance becomes
    // a trap: without a session you are not admin, so /login bounced to
    // /maintenance and no one could ever log in to administer. The link itself
    // "Staff Login" on that screen looped right back to the start.
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
          // Check if current user is administrator
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
