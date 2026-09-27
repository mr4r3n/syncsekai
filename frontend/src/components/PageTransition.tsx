'use client';

import { usePathname } from 'next/navigation';

/**
 * Smooths page transitions across the dashboard (each dashboard page mounts
 * its own Sidebar/Topbar, so Next.js replaces the entire tree on navigation).
 * Without this, content appeared abruptly; with the route key, React
 * unmounts/mounts the div and triggers the globals.css fade-in on each
 * menu change. Respects prefers-reduced-motion (see globals.css).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}
