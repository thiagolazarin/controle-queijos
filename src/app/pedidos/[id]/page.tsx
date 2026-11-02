import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, PageHeading, StatusBadge, Notice } from '@/components/ui';
import { Icon } from '@/components/icon';
import { OrderSummary } from '@/components/order-summary';
import { requireProfile } from '@/lib/auth';
import { formatDateTime, isUuid } from '@/lib/domain';

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireProfile('establishment');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Não foi possível consultar o pedido.');
  if (!order) notFound();

  return <>
    <PageHeading title={'Pedido nº ' + order.order_number} action={<Link className="button button-secondary" href="/pedidos/historico">Voltar aos pedidos</Link>} />
    <Card className="detail-card stack">
      <div className="product-header">
        <div className="product-icon" aria-hidden="true"><Icon name="cheese" /></div>
        <div><h2>Queijo fresco</h2></div>
        <StatusBadge cancelled={Boolean(order.cancelled_at)} />
      </div>
      <OrderSummary cancelled={Boolean(order.cancelled_at)} orderNumber={order.order_number} quantity={order.quantity} deliveryDate={order.delivery_date} deliveryAddress={order.delivery_address} deliveryEstimate={order.delivery_estimate} totalPrice={order.total_price} unitPrice={order.unit_price} />
      <p className="helper">Pedido feito em {formatDateTime(order.created_at)}.</p>
      {order.notes && <div><h3 className="section-heading">Observações</h3><p className="preserve-lines">{order.notes}</p></div>}
      {order.cancelled_at && <Notice kind="error">Cancelado pela administração em {formatDateTime(order.cancelled_at)}.</Notice>}
      <Link className="button button-wide" href={'/pedidos?repetir=' + order.id}>Pedir novamente <Icon name="arrow" /></Link>
      <p className="helper">Confira a quantidade, a data e o endereço do novo pedido antes de confirmar.</p>
    </Card>
  </>;
}