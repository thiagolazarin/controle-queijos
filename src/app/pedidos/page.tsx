import { PageHeading, Card } from '@/components/ui';
import { Icon } from '@/components/icon';
import { OrderForm } from '@/components/order-form';
import { createOrderAction } from '@/lib/actions';
import { requireProfile } from '@/lib/auth';
import { todayInSaoPaulo, UNIT_PRICE, formatMoney, isUuid } from '@/lib/domain';

export default async function NewOrder({ searchParams }: { searchParams: Promise<{ repetir?: string }> }) {
  const { supabase, establishment } = await requireProfile('establishment');
  const { repetir } = await searchParams;
  const { data: repeated } = isUuid(repetir)
    ? await supabase.from('orders').select('*').eq('id', repetir).single()
    : { data: null };

  return <>
    <PageHeading title="Fazer pedido" description={establishment!.name} />
    <Card className="product-card">
      <div className="product-header">
        <div className="product-icon" aria-hidden="true"><Icon name="cheese" /></div>
        <div><h2>Queijo fresco</h2><p className="muted">{formatMoney(UNIT_PRICE)} / unidade</p></div>
      </div>
      {repeated && <p className="repeat-note">Pedido nº {repeated.order_number} selecionado. Confira a quantidade, a data e o endereço antes de confirmar.</p>}
      <OrderForm key={repeated?.id ?? 'novo'} action={createOrderAction} defaultDeliveryAddress={establishment!.address} initial={repeated ? { quantity: repeated.quantity, notes: repeated.notes, deliveryDate: todayInSaoPaulo() } : undefined} />
    </Card>
  </>;
}