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
  // El enlace "Saltar al contenido principal" vive en el layout raíz y por tanto
  // aparece en todas las páginas, pero el ancla #main-content solo existía en la
  // landing: en todo el panel apuntaba a un destino inexistente y no hacía nada.
  // tabIndex={-1} permite que el foco aterrice aquí al seguir el enlace.
  return (
    <AuthGuard>
      <div id="main-content" tabIndex={-1} className="outline-none">
        <DashboardChrome>{children}</DashboardChrome>
      </div>
    </AuthGuard>
  );
}
