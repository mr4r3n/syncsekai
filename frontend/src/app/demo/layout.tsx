import type { Metadata } from 'next';

// The demo shows sample data: search engines should index the landing page instead.
export const metadata: Metadata = {
  title: 'Demo',
  robots: { index: false, follow: false },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
