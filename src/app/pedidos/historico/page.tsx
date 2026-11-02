import Link from 'next/link';
import { PageHeading, Card, EmptyState, StatusBadge } from '@/components/ui';
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
  return <><PageHeading eyebrow="SEU HISTÓRICO" title="Meus pedidos" description="Todos os seus pedidos, organizados do mais recente para o mais antigo." action={<Link className="button" href="/pedidos">+ Fazer pedido</Link>} />
    <Card>{!orders?.length ? <EmptyState title="Nenhum pedido por aqui" description="Quando você confirmar um pedido, os detalhes aparecerão aqui." /> : <><div className="table-wrap"><table><thead><tr><th>Pedido</th><th>Solicitado em</th><th>Entrega</th><th>Quantidade</th><th>Total</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><Link className="text-link" href={`/pedidos/${order.id}`}>#{order.order_number}</Link></td><td>{formatDateTime(order.created_at)}</td><td>{formatDate(order.delivery_date)}</td><td>{order.quantity} queijos</td><td className="money">{formatMoney(order.total_price)}</td><td><StatusBadge cancelled={!!order.cancelled_at}/></td><td><Link className="text-link" href={`/pedidos?repetir=${order.id}`}>Repetir →</Link></td></tr>)}</tbody></table></div></>}
    <div className="pagination"><span className="muted">{count ?? 0} pedidos · Página {page}</span><div className="inline-actions">{page > 1 && <Link className="button-secondary" href={`/pedidos/historico?pagina=${page - 1}`}>Anterior</Link>}{(count ?? 0) > page * pageSize && <Link className="button-secondary" href={`/pedidos/historico?pagina=${page + 1}`}>Próxima</Link>}</div></div></Card>
  </>;
}
