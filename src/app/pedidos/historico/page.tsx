import Link from 'next/link';
import { PageHeading, Card, EmptyState, StatusBadge } from '@/components/ui';
import { Icon } from '@/components/icon';
import { requireProfile } from '@/lib/auth';
import { formatDate, formatDateTime, formatMoney } from '@/lib/domain';

export default async function History({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { supabase } = await requireProfile('establishment');
  const params = await searchParams;
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.pagina ?? '1', 10) || 1));
  const pageSize = 20;
  const { data: orders, error, count } = await supabase.from('orders').select('*', { count: 'exact' })
    .order('created_at', { ascending: false }).order('id', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error('Não foi possível consultar os pedidos.');

  return <>
    <PageHeading title="Meus pedidos" action={<Link className="button" href="/pedidos"><Icon name="plus" /> Fazer pedido</Link>} />
    {!orders?.length ? <Card><EmptyState title={count ? 'Nenhum pedido nesta página' : 'Você ainda não fez pedidos'} description={count ? 'Volte para a página anterior para ver seus pedidos.' : 'Toque em Fazer pedido para começar.'} /></Card> :
      <div className="order-list" role="list">
        {orders.map((order) => <article className="order-list-item" role="listitem" key={order.id}>
          <div className="order-list-main">
            <h2>Pedido nº {order.order_number}</h2>
            <StatusBadge cancelled={Boolean(order.cancelled_at)} />
          </div>
          <div className="order-list-meta">
            <span><Icon name="calendar" /> Entrega em {formatDate(order.delivery_date)}</span>
            <span>Solicitado em {formatDateTime(order.created_at)}</span>
          </div>
          <div className="order-delivery-info">
            <p><Icon name="location" /><span className="preserve-lines"><strong>Endereço:</strong> {order.delivery_address || 'Não registrado neste pedido.'}</span></p>
            <p><Icon name="clock" /><span><strong>Horário:</strong> {order.delivery_estimate || (order.cancelled_at ? 'Não informado' : 'A família informará o horário')}</span></p>
          </div>
          <div className="order-list-quantity">
            <strong>{order.quantity} {order.quantity === 1 ? 'queijo' : 'queijos'}</strong>
            <strong className="money">{formatMoney(order.total_price)}</strong>
          </div>
          <div className="order-actions">
            <Link className="button button-secondary" href={'/pedidos/' + order.id}>Ver pedido</Link>
            <Link className="button" href={'/pedidos?repetir=' + order.id}>Pedir novamente <Icon name="arrow" /></Link>
          </div>
        </article>)}
      </div>}
    {(count ?? 0) > 0 && <div className="pagination">
      <span className="muted">{count} {count === 1 ? 'pedido' : 'pedidos'} · Página {page}</span>
      <div className="inline-actions">
        {page > 1 && <Link className="button button-secondary" href={'/pedidos/historico?pagina=' + (page - 1)}>Anterior</Link>}
        {(count ?? 0) > page * pageSize && <Link className="button button-secondary" href={'/pedidos/historico?pagina=' + (page + 1)}>Próxima</Link>}
      </div>
    </div>}
  </>;
}