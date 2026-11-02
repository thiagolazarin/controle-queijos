import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, PageHeading, StatusBadge, Notice } from '@/components/ui';
import { Icon } from '@/components/icon';
import { requireProfile } from '@/lib/auth';
import { formatDate, formatDateTime, formatMoney, isUuid } from '@/lib/domain';

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
        <div><h2>Queijo fresco</h2><p className="muted">{formatMoney(order.unit_price)} / unidade</p></div>
        <StatusBadge cancelled={Boolean(order.cancelled_at)} />
      </div>
      <div className="order-list-quantity">
        <strong>{order.quantity} {order.quantity === 1 ? 'queijo' : 'queijos'}</strong>
        <strong className="detail-total">{formatMoney(order.total_price)}</strong>
      </div>
      <dl className="detail-grid">
        <div><dt>Data de entrega</dt><dd>{formatDate(order.delivery_date)}</dd></div>
        <div><dt>Pedido feito em</dt><dd>{formatDateTime(order.created_at)}</dd></div>
      </dl>
      {order.notes && <div><h3 className="section-heading">Observações</h3><p className="preserve-lines">{order.notes}</p></div>}
      {order.cancelled_at && <Notice kind="error">Cancelado pela administração em {formatDateTime(order.cancelled_at)}.</Notice>}
      <Link className="button button-wide" href={'/pedidos?repetir=' + order.id}>Pedir novamente <Icon name="arrow" /></Link>
      <p className="helper">Confira a quantidade e a data antes de confirmar o novo pedido.</p>
    </Card>
  </>;
}