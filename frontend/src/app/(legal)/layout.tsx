import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
  },
  // Without `alternates`: relative canonical from root layout already resolves
  // /terms and /privacy to their own URL.
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
