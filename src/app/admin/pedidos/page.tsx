import Link from 'next/link';
import { Icon } from '@/components/icon';
import { OrderForm } from '@/components/order-form';
import { Card, EmptyState, Notice, PageHeading } from '@/components/ui';
import { createManualOrder } from '@/lib/admin-actions';
import { requireProfile } from '@/lib/auth';
import { fetchEstablishments, fetchOrderPage, isDate, isUuid } from '../_lib/data';
import { AdminOrderList } from '../_components/order-list';

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string; estabelecimento?: string; pagina?: string; novo?: string }> }) {
  const { supabase } = await requireProfile('admin');
  const params = await searchParams;
  const from = isDate(params.de) ? params.de : '';
  const to = isDate(params.ate) ? params.ate : '';
  const establishmentId = isUuid(params.estabelecimento) ? params.estabelecimento : '';
  const pageNumber = Number(params.pagina || 1);
  const page = Number.isSafeInteger(pageNumber) && pageNumber > 0 && pageNumber < 1000000 ? pageNumber : 1;
  const establishments = await fetchEstablishments(supabase);
  const names = new Map(establishments.map((establishment) => [establishment.id, establishment.name]));
  const invalidPeriod = Boolean(from && to && from > to);
  const { orders, count } = invalidPeriod ? { orders: [], count: 0 } : await fetchOrderPage(supabase, { from, to, establishmentId, page });
  const pageCount = Math.max(1, Math.ceil(count / 50));
  const hasFilters = Boolean(from || to || establishmentId);
  function pageHref(number: number) {
    const query = new URLSearchParams();
    if (from) query.set('de', from);
    if (to) query.set('ate', to);
    if (establishmentId) query.set('estabelecimento', establishmentId);
    query.set('pagina', String(number));
    return `/admin/pedidos?${query.toString()}`;
  }

  return <div className="stack">
    <PageHeading title="Pedidos" />
    <details className="disclosure" id="novo-pedido" open={params.novo === '1'}>
      <summary><Icon name="plus" /> Novo pedido</summary>
      <div className="disclosure-body"><p className="helper">Registre aqui um pedido recebido pelo telefone ou WhatsApp.</p>
        {establishments.some((establishment) => establishment.active) ? <OrderForm action={createManualOrder} establishments={establishments} initial={{ establishmentId: establishments.find((establishment) => establishment.id === establishmentId && establishment.active)?.id }} submitLabel="Confirmar pedido" admin /> : <div className="stack"><EmptyState title="Cadastre um cliente para começar" description="É preciso ter um cliente ativo para registrar pedidos." /><Link className="button" href="/admin/estabelecimentos?novo=1#novo-cliente"><Icon name="customers" /> Cadastrar cliente</Link></div>}
      </div>
    </details>

    <details className="disclosure" open={hasFilters}>
      <summary><Icon name="history" /> Buscar pedidos{hasFilters ? ' · filtro ativo' : ''}</summary>
      <div className="disclosure-body"><form className="filter-grid" method="get" action="/admin/pedidos">
        <div className="field"><label htmlFor="from">Entrega a partir de</label><input className="input" type="date" name="de" id="from" defaultValue={from} /></div>
        <div className="field"><label htmlFor="to">Entrega até</label><input className="input" type="date" name="ate" id="to" defaultValue={to} /></div>
        <div className="field"><label htmlFor="establishment-filter">Cliente</label><select className="input" id="establishment-filter" name="estabelecimento" defaultValue={establishmentId}><option value="">Todos os clientes</option>{establishments.map((establishment) => <option key={establishment.id} value={establishment.id}>{establishment.name}{!establishment.active ? ' (inativo)' : ''}</option>)}</select></div>
        <div className="inline-actions"><button className="button" type="submit">Buscar</button>{hasFilters && <Link className="button button-secondary" href="/admin/pedidos">Limpar busca</Link>}</div>
      </form>{invalidPeriod && <Notice kind="error">A data inicial precisa ser anterior ou igual à data final.</Notice>}</div>
    </details>

    <Card>
      <div className="section-heading"><h2>Histórico</h2><span className="muted">{count} pedido{count !== 1 ? 's' : ''}</span></div>
      {orders.length === 0 ? <EmptyState title="Nenhum pedido encontrado" description="Ajuste a busca ou toque em Novo pedido para começar." /> : <AdminOrderList orders={orders} names={names} history />}
      {(pageCount > 1 || page > 1) && <nav aria-label="Páginas do histórico" className="pagination"><span className="muted">Página {page} de {pageCount}</span><div className="inline-actions">{page > 1 && <Link className="button button-secondary" href={pageHref(page - 1)}>← Anterior</Link>}{page < pageCount && <Link className="button button-secondary" href={pageHref(page + 1)}>Próxima →</Link>}</div></nav>}
    </Card>
  </div>;
}