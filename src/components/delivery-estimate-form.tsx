'use client';

import { useActionState, useId, useState } from 'react';
import { updateDeliveryEstimate } from '@/lib/admin-actions';
import { Notice, SubmitButton } from '@/components/ui';

export function DeliveryEstimateForm({ orderId, updatedAt, initialEstimate, compact = false }: {
  orderId: string;
  updatedAt: string;
  initialEstimate?: string | null;
  compact?: boolean;
}) {
  const fieldId = useId();
  const [estimate, setEstimate] = useState(initialEstimate ?? '');
  const [state, formAction, pending] = useActionState(updateDeliveryEstimate, {});
  const shortcuts = [{ label: 'Pela manhã', value: 'Pela manhã' }, { label: 'À tarde', value: 'À tarde' }, { label: 'A combinar', value: '' }];

  return <form action={formAction} className="estimate-form">
    <input type="hidden" name="order_id" value={orderId} />
    <input type="hidden" name="order_version" value={updatedAt} />
    <div className="field"><label htmlFor={fieldId}>Previsão da entrega</label><input className="input" id={fieldId} name="delivery_estimate" maxLength={120} value={estimate} onChange={(event) => setEstimate(event.target.value)} placeholder="Ex.: entre 9h e 11h" disabled={pending} /></div>
    <div className="estimate-shortcuts" aria-label="Previsões rápidas">{shortcuts.map((shortcut) => <button className="quick-option" key={shortcut.label} type="button" aria-pressed={estimate.trim() === shortcut.value} onClick={() => setEstimate(shortcut.value)} disabled={pending}>{shortcut.label}</button>)}</div>
    {!compact && <p className="helper">O cliente verá essa previsão no pedido. Para retirar a previsão, escolha A combinar e salve.</p>}
    {state.error && <Notice kind="error">{state.error}</Notice>}
    {state.success && <Notice kind="success">{state.success}</Notice>}
    <div><SubmitButton pendingText="Salvando previsão…">Salvar previsão</SubmitButton></div>
  </form>;
}