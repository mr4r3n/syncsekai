import { redirect } from 'next/navigation';

/** Footer links live in Site Settings; route remains for bookmarks. */
export default function AdminLinksPage() {
  redirect('/admin/site');
}
