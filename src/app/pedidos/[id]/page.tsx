import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, PageHeading, StatusBadge } from '@/components/ui';
import { requireProfile } from '@/lib/auth';
import { formatDate, formatDateTime, formatMoney, isUuid } from '@/lib/domain';

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireProfile('establishment');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Não foi possível consultar o pedido.');
  if (!order) notFound();
  return <><PageHeading eyebrow="DETALHES DO PEDIDO" title={`Pedido nº ${order.order_number}`} description={`Solicitado em ${formatDateTime(order.created_at)}`} action={<Link className="button-secondary" href="/pedidos/historico">Voltar aos pedidos</Link>}/>
    <Card className="detail-card stack"><StatusBadge cancelled={!!order.cancelled_at}/><h2>Queijo Fresco</h2><dl className="detail-grid"><div><dt>Data de entrega</dt><dd>{formatDate(order.delivery_date)}</dd></div><div><dt>Quantidade</dt><dd>{order.quantity} queijos</dd></div><div><dt>Preço por unidade</dt><dd>{formatMoney(order.unit_price)}</dd></div><div><dt>Total do pedido</dt><dd className="detail-total">{formatMoney(order.total_price)}</dd></div></dl>
    {order.notes && <div><h3>Observações</h3><p className="preserve-lines">{order.notes}</p></div>}{order.cancelled_at && <p className="muted">Cancelado pela administração em {formatDateTime(order.cancelled_at)}. O registro foi preservado no seu histórico.</p>}
    <Link className="button" href={`/pedidos?repetir=${order.id}`}>Repetir este pedido →</Link><p className="helper">Você poderá alterar a quantidade e a data antes de confirmar.</p></Card></>;
}
