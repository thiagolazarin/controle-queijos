'use client';

import { useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import type { ActionState } from '@/lib/action-state';
import { addDays, formatMoney, isValidDate, MAX_QUANTITY, todayInSaoPaulo, UNIT_PRICE } from '@/lib/domain';
import { Icon } from '@/components/icon';
import { OrderSummary } from '@/components/order-summary';
import { Notice, SubmitButton } from './ui';

export function OrderForm({ action, establishments, initial, defaultDeliveryAddress, submitLabel = 'Confirmar pedido', admin = false }: {
  action: (previous: ActionState, form: FormData) => Promise<ActionState>;
  establishments?: { id: string; name: string; active: boolean; address?: string | null }[];
  initial?: { id?: string; quantity?: number; deliveryDate?: string; deliveryAddress?: string | null; deliveryEstimate?: string | null; notes?: string | null; establishmentId?: string };
  defaultDeliveryAddress?: string | null;
  submitLabel?: string;
  admin?: boolean;
}) {
  const today = todayInSaoPaulo();
  const tomorrow = addDays(today, 1);
  const editing = Boolean(initial?.id);
  const originalDate = admin && editing ? initial?.deliveryDate : undefined;
  const historical = Boolean(originalDate && originalDate < today);
  const initialEstablishmentId = initial?.establishmentId ?? '';
  const registeredAddress = defaultDeliveryAddress?.trim() || establishments?.find((establishment) => establishment.id === initialEstablishmentId)?.address?.trim() || '';
  const startingAddress = admin && editing ? initial?.deliveryAddress?.trim() || registeredAddress : registeredAddress;
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [deliveryDate, setDeliveryDate] = useState(initial?.deliveryDate ?? today);
  const [deliveryAddress, setDeliveryAddress] = useState(startingAddress);
  const [editingAddress, setEditingAddress] = useState(!startingAddress);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [establishmentId, setEstablishmentId] = useState(initialEstablishmentId);
  const [state, formAction] = useActionState(action, {});
  const [dismissedSuccessId, setDismissedSuccessId] = useState<string | null>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const addressInput = useRef<HTMLTextAreaElement>(null);
  const numericQuantity = Number(quantity);
  const validQuantity = Number.isInteger(numericQuantity) && numericQuantity >= 1 && numericQuantity <= MAX_QUANTITY;
  const canReview = validQuantity && isValidDate(deliveryDate);
  const selectedEstablishment = establishments?.find((establishment) => establishment.id === establishmentId);
  const unchangedDelivery = editing && deliveryDate === initial?.deliveryDate && deliveryAddress.trim() === initial?.deliveryAddress?.trim();

  function selectDeliveryDate(value: string) {
    setDeliveryDate(value);
    dateInput.current?.setCustomValidity('');
  }

  function selectEstablishment(value: string) {
    if (value === establishmentId) return;
    const address = establishments?.find((establishment) => establishment.id === value)?.address?.trim() || '';
    setEstablishmentId(value);
    setDeliveryAddress(address);
    setEditingAddress(!address);
    addressInput.current?.setCustomValidity('');
  }

  function changeAddress() {
    setEditingAddress(true);
    requestAnimationFrame(() => addressInput.current?.focus());
  }

  function startAnotherOrder() {
    const address = defaultDeliveryAddress?.trim() || '';
    setQuantity('1');
    setDeliveryDate(todayInSaoPaulo());
    setDeliveryAddress(address);
    setEditingAddress(!address);
    setNotes('');
    setEstablishmentId('');
    dateInput.current?.setCustomValidity('');
    addressInput.current?.setCustomValidity('');
    setDismissedSuccessId(state.orderId ?? null);
  }

  if (!admin && state.success && state.orderId && state.orderId !== dismissedSuccessId) {
    return <section className="order-complete stack" role="status" aria-labelledby="order-complete-title">
      <span className="confirmation-mark" aria-hidden="true">✓</span>
      <h2 id="order-complete-title">Pedido confirmado!</h2>
      <p>{state.success}</p>
      {state.receipt && <OrderSummary {...state.receipt} />}
      <Link className="button button-wide" href={'/pedidos/' + state.orderId}>Ver pedido <Icon name="arrow" /></Link>
      <button className="button button-secondary button-wide" type="button" onClick={startAnotherOrder}><Icon name="plus" /> Fazer outro pedido</button>
    </section>;
  }

  return <form action={formAction} className={`stack order-form ${admin ? 'order-form-admin' : 'order-form-customer'}`}>
    {initial?.id && <input type="hidden" name="order_id" value={initial.id} />}
    {establishments && <div className="field">
      <label htmlFor="establishment_id">Estabelecimento</label>
      <select className="input" id="establishment_id" name="establishment_id" value={establishmentId} onChange={(event) => selectEstablishment(event.target.value)} required>
        <option value="" disabled>Selecione o estabelecimento</option>
        {establishments.filter((establishment) => establishment.active || establishment.id === initial?.establishmentId).map((establishment) => <option key={establishment.id} value={establishment.id}>{establishment.name}{!establishment.active ? ' (inativo)' : ''}</option>)}
      </select>
    </div>}

    <section className="order-step" aria-labelledby="quantity-label">
      <label className="step-label" id="quantity-label" htmlFor="quantity"><span className="step-number">1</span> Quantidade</label>
      <div className="quantity-control">
        <button type="button" aria-label="Diminuir quantidade" disabled={!validQuantity || numericQuantity <= 1} onClick={() => setQuantity(String(numericQuantity - 1))}>−</button>
        <input id="quantity" name="quantity" aria-label="Quantidade de queijos" inputMode="numeric" type="number" min="1" max={MAX_QUANTITY} step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        <button type="button" aria-label="Aumentar quantidade" disabled={numericQuantity >= MAX_QUANTITY} onClick={() => setQuantity(String(Math.max(0, Number.isFinite(numericQuantity) ? numericQuantity : 0) + 1))}>+</button>
      </div>
      <div className="quick-options" aria-label="Escolher quantidade">
        {[5, 10, 20].map((value) => <button className="quick-option" type="button" key={value} aria-pressed={numericQuantity === value} onClick={() => setQuantity(String(value))}>{value} unidades</button>)}
      </div>
    </section>

    <section className="order-step" aria-labelledby="delivery-label">
      <label className="step-label" id="delivery-label" htmlFor="delivery_date"><span className="step-number">2</span> Entrega</label>
      <div className="quick-options" aria-label="Escolher data de entrega">
        <button className="quick-option" type="button" aria-pressed={deliveryDate === today} onClick={() => selectDeliveryDate(today)}>Hoje</button>
        <button className="quick-option" type="button" aria-pressed={deliveryDate === tomorrow} onClick={() => selectDeliveryDate(tomorrow)}>Amanhã</button>
      </div>
      <input ref={dateInput} className="input" type="date" name="delivery_date" id="delivery_date" min={historical ? originalDate : today} value={deliveryDate} onChange={(event) => {
        const nextDate = event.target.value;
        setDeliveryDate(nextDate);
        event.currentTarget.setCustomValidity(nextDate && nextDate < today && nextDate !== originalDate ? 'Mantenha a data original ou escolha uma data atual ou futura.' : '');
      }} aria-describedby={historical ? 'delivery-date-hint' : undefined} required />
      {historical && <span className="helper" id="delivery-date-hint">Mantenha a data original ou escolha hoje ou uma data futura.</span>}
    </section>

    <section className="order-step" aria-labelledby="address-label">
      <h3 className="step-label" id="address-label"><span className="step-number">3</span> Endereço da entrega</h3>
      {editingAddress ? <div className="address-editor field">
        <label className="sr-only" htmlFor="delivery_address">Endereço da entrega</label>
        <textarea ref={addressInput} className="input" id="delivery_address" name="delivery_address" rows={3} maxLength={500} value={deliveryAddress} onChange={(event) => {
          setDeliveryAddress(event.target.value);
          event.currentTarget.setCustomValidity(event.target.value.trim() ? '' : 'Informe o endereço da entrega.');
        }} placeholder="Rua, número, bairro e cidade" autoComplete="street-address" required />
        <span className="helper">Informe onde este pedido deve ser entregue.</span>
      </div> : <div className="address-preview">
        <input type="hidden" name="delivery_address" value={deliveryAddress} />
        <p className="preserve-lines">{deliveryAddress}</p>
        <button className="text-link" type="button" onClick={changeAddress}>Alterar endereço</button>
      </div>}
    </section>

    <details className="disclosure" open={Boolean(initial?.notes)}>
      <summary>Adicionar observação <span className="muted">(opcional)</span></summary>
      <div className="disclosure-body">
        <label className="sr-only" htmlFor="notes">Observações do pedido</label>
        <textarea className="input" id="notes" name="notes" rows={3} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Escreva uma orientação para o pedido." />
      </div>
    </details>

    {canReview && <section className="order-review" aria-label="Confira o pedido antes de confirmar">
      <OrderSummary quantity={numericQuantity} deliveryDate={deliveryDate} deliveryAddress={deliveryAddress.trim() || null} deliveryEstimate={unchangedDelivery ? initial?.deliveryEstimate : null} establishmentName={selectedEstablishment?.name} compact />
    </section>}

    <div className="order-confirm">
      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.success && (admin || !state.orderId) && <div className="order-success" role="status">
        <strong>{state.success}</strong>
        {state.orderId && <Link className="button button-secondary" href={(admin ? '/admin/pedidos/' : '/pedidos/') + state.orderId}>Ver pedido <Icon name="arrow" /></Link>}
      </div>}
      <div className="order-total">
        <span>Total do pedido<small>{validQuantity ? numericQuantity : '—'} {numericQuantity === 1 ? 'queijo' : 'queijos'}</small></span>
        <strong aria-live="polite">{validQuantity ? formatMoney(numericQuantity * UNIT_PRICE) : '—'}</strong>
      </div>
      <SubmitButton pendingText={editing ? 'Salvando alterações…' : 'Confirmando pedido…'} className="button button-wide">{submitLabel} <Icon name="arrow" /></SubmitButton>
    </div>
  </form>;
}