import { redirect } from 'next/navigation';

/** Los enlaces del pie viven en Ajustes del sitio; la ruta queda por los marcadores. */
export default function AdminLinksPage() {
  redirect('/admin/site');
}
