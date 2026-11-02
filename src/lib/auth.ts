import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function requireProfile(role?: 'admin' | 'establishment') {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login?motivo=sessao');
  const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (profileError || !profile) redirect('/acesso-bloqueado');
  let establishment = null;
  if (profile.role === 'establishment') {
    if (!profile.establishment_id) redirect('/acesso-bloqueado');
    const { data } = await supabase.from('establishments').select('*').eq('id', profile.establishment_id).single();
    if (!data?.active) redirect('/acesso-bloqueado');
    establishment = data;
  }
  if (role && profile.role !== role) redirect(profile.role === 'admin' ? '/admin' : '/pedidos');
  return { supabase, profile, establishment };
}
