import { redirect } from 'next/navigation';
import { hasSupabaseConfig } from '@/lib/supabase/env';
import { requireProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (!hasSupabaseConfig()) redirect('/login');
  const { profile } = await requireProfile();
  redirect(profile.role === 'admin' ? '/admin' : '/pedidos');
}
