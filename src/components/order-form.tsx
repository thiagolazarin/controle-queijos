'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import type { ActionState } from '@/lib/action-state';
import { formatMoney, MAX_QUANTITY, todayInSaoPaulo, UNIT_PRICE } from '@/lib/domain';
import { Notice, SubmitButton } from './ui';

export function OrderForm({ action, establishments, initial, submitLabel = 'Confirmar pedido', admin = false }: {
  action: (previous: ActionState, form: FormData) => Promise<ActionState>;
  establishments?: { id: string; name: string; active: boolean }[];
  initial?: { id?: string; quantity?: number; deliveryDate?: string; notes?: string | null; establishmentId?: string };
  submitLabel?: string;
  admin?: boolean;
}) {
  const today = todayInSaoPaulo();
  const editing = Boolean(initial?.id);
  const originalDate = admin && editing ? initial?.deliveryDate : undefined;
  const historical = Boolean(originalDate && originalDate < today);
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [deliveryDate, setDeliveryDate] = useState(initial?.deliveryDate ?? today);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [establishmentId, setEstablishmentId] = useState(initial?.establishmentId ?? '');
  const [state, formAction] = useActionState(action, {});
  const numericQuantity = Number(quantity);
  const validQuantity = Number.isInteger(numericQuantity) && numericQuantity >= 1 && numericQuantity <= MAX_QUANTITY;

  return <form action={formAction} className="stack order-form">
    {state.error && <Notice kind="error">{state.error}</Notice>}
    {state.success && <Notice kind="success">{state.success} {state.orderId && <Link className="text-link" href={`${admin ? '/admin/pedidos' : '/pedidos'}/${state.orderId}`}>Ver pedido →</Link>}</Notice>}
    {initial?.id && <input type="hidden" name="order_id" value={initial.id} />}
    {establishments && <div className="field"><label htmlFor="establishment_id">Estabelecimento</label><select className="input" id="establishment_id" name="establishment_id" value={establishmentId} onChange={(event) => setEstablishmentId(event.target.value)} required>
      <option value="" disabled>Selecione o estabelecimento</option>
      {establishments.filter((establishment) => establishment.active || establishment.id === initial?.establishmentId).map((establishment) => <option key={establishment.id} value={establishment.id}>{establishment.name}{!establishment.active ? ' (inativo)' : ''}</option>)}
    </select></div>}
    <div className="field"><label htmlFor="quantity">{admin ? 'Quantidade de queijos' : 'Quantos queijos você precisa?'}</label><div className="quantity-control">
      <button type="button" aria-label="Diminuir quantidade" disabled={!validQuantity || numericQuantity <= 1} onClick={() => setQuantity(String(numericQuantity - 1))}>−</button>
      <input id="quantity" name="quantity" inputMode="numeric" type="number" min="1" max={MAX_QUANTITY} step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      <button type="button" aria-label="Aumentar quantidade" disabled={numericQuantity >= MAX_QUANTITY} onClick={() => setQuantity(String(Math.max(0, Number.isFinite(numericQuantity) ? numericQuantity : 0) + 1))}>+</button>
    </div><span className="helper">{formatMoney(UNIT_PRICE)} por unidade</span></div>
    <div className="field"><label htmlFor="delivery_date">Data da entrega</label><input className="input" type="date" name="delivery_date" id="delivery_date" min={historical ? originalDate : today} value={deliveryDate} onChange={(event) => {
      const nextDate = event.target.value;
      setDeliveryDate(nextDate);
      event.currentTarget.setCustomValidity(nextDate && nextDate < today && nextDate !== originalDate ? 'Mantenha a data original ou escolha uma data atual ou futura.' : '');
    }} aria-describedby="delivery-date-hint" required /><span className="helper" id="delivery-date-hint">{historical ? 'Você pode manter a data original ou escolher uma data atual ou futura.' : admin ? 'Selecione a data combinada com o estabelecimento.' : 'Escolha o dia em que deseja receber.'}</span></div>
    <div className="field"><label htmlFor="notes">Observações <span className="muted">(opcional)</span></label><textarea className="input" id="notes" name="notes" rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Alguma orientação para o pedido?" /></div>
    <div className="order-total"><span>Total do pedido<small>{validQuantity ? numericQuantity : '—'} {numericQuantity === 1 ? 'queijo' : 'queijos'}</small></span><strong aria-live="polite">{validQuantity ? formatMoney(numericQuantity * UNIT_PRICE) : '—'}</strong></div>
    <SubmitButton pendingText={editing ? 'Atualizando pedido…' : 'Registrando pedido…'} className="button button-wide">{submitLabel} <span aria-hidden="true">→</span></SubmitButton>
    {!editing && <p className="helper text-center">{admin ? 'O pedido será confirmado automaticamente.' : 'Seu pedido será confirmado automaticamente.'}</p>}
  </form>;
}