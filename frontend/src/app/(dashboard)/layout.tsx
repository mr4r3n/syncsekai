import type { Metadata } from 'next';
import { AuthGuard } from '@/components/AuthGuard';
import { DashboardChrome } from '@/components/DashboardChrome';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The "Skip to main content" link lives in root layout and therefore
  // appears on all pages, but the #main-content anchor only existed on
  // landing: throughout the dashboard it pointed to a nonexistent target and did nothing.
  // tabIndex={-1} allows focus to land here when following the link.
  return (
    <AuthGuard>
      <div id="main-content" tabIndex={-1} className="outline-none">
        <DashboardChrome>{children}</DashboardChrome>
      </div>
    </AuthGuard>
  );
}
