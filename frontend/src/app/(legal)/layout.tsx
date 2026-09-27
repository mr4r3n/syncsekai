import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
  },
  // Sin `alternates`: el canonical relativo del layout raíz ya resuelve
  // /terms y /privacy a su propia URL.
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
