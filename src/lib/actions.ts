'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { validateOrderInput } from '@/lib/domain';
import type { ActionState } from '@/lib/action-state';

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password || email.length > 254 || password.length > 1024) return { error: 'Informe seu e-mail e senha.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' : 'Não foi possível entrar. Confira seu e-mail e senha.' };
  const { profile } = await requireProfile();
  redirect(profile.role === 'admin' ? '/admin' : '/pedidos');
}

export async function logoutAction() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error('Não foi possível sair. Tente novamente.');
  redirect('/login');
}

export async function createOrderAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireProfile('establishment');
  let input;
  try { input = validateOrderInput({ quantity: form.get('quantity'), deliveryDate: form.get('delivery_date'), notes: form.get('notes') }); }
  catch (error) { return { error: error instanceof Error ? error.message : 'Confira os dados do pedido.' }; }
  const { data: id, error } = await supabase.rpc('create_order', {
    p_quantity: input.quantity, p_delivery_date: input.deliveryDate, p_notes: input.notes,
  });
  if (error || !id) return { error: 'Não foi possível registrar o pedido. Confira os dados e se o estabelecimento está ativo, e tente novamente.' };
  const { data: order } = await supabase.from('orders').select('order_number').eq('id', id).single();
  revalidatePath('/pedidos'); revalidatePath('/pedidos/historico');
  revalidatePath('/admin'); revalidatePath('/admin/pedidos');
  return { success: `Pedido ${order ? `nº ${order.order_number} ` : ''}confirmado com sucesso!`, orderId: id };
}
