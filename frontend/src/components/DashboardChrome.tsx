'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { PageTransition } from './PageTransition';
import { DemoBar } from './DemoBar';
import { isDemo, DEMO_PAGES } from '@/lib/demo';

/**
 * The sidebar lives here, once for the entire panel: mounting it on each
 * page unmounted it on every navigation and caused flickering. Being
 * `position: fixed`, it does not need to live in each page's tree.
 *
 * /docs is the exception: it is public and decides ITSELF whether to show the
 * sidebar (authenticated session) or a public header (anonymous visitor, see
 * AuthGuard). If the sidebar were mounted here for /docs as well, an authenticated
 * user would see two overlapping sidebars.
 */
export function DashboardChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const showPersistentSidebar = !pathname.startsWith('/docs');

  // Demo mode (lib/demo.ts): read after mounting, and pages outside the demo
  // go to the catalog instead of asking for data the recording does not have.
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    const on = isDemo();
    setDemo(on);
    if (on && !pathname.startsWith('/docs') && !DEMO_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
      router.replace('/catalog');
    }
  }, [pathname, router]);

  return (
    <>
      {showPersistentSidebar && <Sidebar />}
      <PageTransition>{children}</PageTransition>
      {demo && <DemoBar />}
    </>
  );
}
