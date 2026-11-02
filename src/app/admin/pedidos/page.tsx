import Link from "next/link";
import { OrderForm } from "@/components/order-form";
import { Card, EmptyState, Notice, PageHeading, StatusBadge } from "@/components/ui";
import { createManualOrder } from "@/lib/admin-actions";
import { requireProfile } from "@/lib/auth";
import { formatDate, formatDateTime, formatMoney } from "@/lib/domain";
import { fetchEstablishments, fetchOrderPage, isDate, isUuid } from "../_lib/data";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string; estabelecimento?: string; pagina?: string }> }) {
  const { supabase } = await requireProfile("admin");
  const params = await searchParams;
  const from = isDate(params.de) ? params.de : "";
  const to = isDate(params.ate) ? params.ate : "";
  const establishmentId = isUuid(params.estabelecimento) ? params.estabelecimento : "";
  const pageNumber = Number(params.pagina || 1);
  const page = Number.isSafeInteger(pageNumber) && pageNumber > 0 && pageNumber < 1000000 ? pageNumber : 1;
  const establishments = await fetchEstablishments(supabase);
  const names = new Map(establishments.map((establishment) => [establishment.id, establishment.name]));
  const invalidPeriod = Boolean(from && to && from > to);
  const { orders, count } = invalidPeriod ? { orders: [], count: 0 } : await fetchOrderPage(supabase, { from, to, establishmentId, page });
  const pageCount = Math.max(1, Math.ceil(count / 50));
  function pageHref(number: number) {
    const query = new URLSearchParams();
    if (from) query.set("de", from);
    if (to) query.set("ate", to);
    if (establishmentId) query.set("estabelecimento", establishmentId);
    query.set("pagina", String(number));
    return `/admin/pedidos?${query.toString()}`;
  }

  return <div className="stack">
    <PageHeading eyebrow="Administração" title="Todos os pedidos" description="Consulte o histórico e registre pedidos recebidos pelo telefone ou WhatsApp."
      action={<a className="button" href="#novo-pedido">+ Registrar pedido</a>} />
    <Card>
      <h2 className="mb-4 text-lg font-semibold">Filtrar por data de entrega</h2>
      <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" method="get" action="/admin/pedidos">
        <div className="field"><label className="label" htmlFor="from">De</label><input className="input" type="date" name="de" id="from" defaultValue={from} /></div>
        <div className="field"><label className="label" htmlFor="to">Até</label><input className="input" type="date" name="ate" id="to" defaultValue={to} /></div>
        <div className="field"><label className="label" htmlFor="establishment-filter">Estabelecimento</label><select className="input" id="establishment-filter" name="estabelecimento" defaultValue={establishmentId}><option value="">Todos</option>{establishments.map((establishment) => <option key={establishment.id} value={establishment.id}>{establishment.name}{!establishment.active ? " (inativo)" : ""}</option>)}</select></div>
        <div className="flex items-end gap-3"><button className="button" type="submit">Filtrar</button><Link className="button button-secondary" href="/admin/pedidos">Limpar</Link></div>
      </form>
      {invalidPeriod && <div className="mt-4"><Notice kind="error">A data inicial deve ser igual ou anterior à data final.</Notice></div>}
    </Card>

    <Card>
      <div className="mb-4 flex flex-wrap justify-between gap-2"><h2 className="text-xl font-semibold">Histórico de pedidos</h2><p className="muted">{count} pedido{count !== 1 ? "s" : ""} encontrado{count !== 1 ? "s" : ""}</p></div>
      {orders.length === 0 ? <EmptyState title="Nenhum pedido encontrado" description="Ajuste os filtros ou registre um novo pedido abaixo." /> : <div className="table-wrap"><table><thead><tr><th>Pedido / solicitado em</th><th>Estabelecimento</th><th>Entrega</th><th>Quantidade</th><th>Total</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
        {orders.map((order) => <tr key={order.id}><td><Link className="font-semibold text-green-800 underline" href={`/admin/pedidos/${order.id}`}>#{order.order_number}</Link><span className="muted mt-1 block text-xs">{formatDateTime(order.created_at)}</span></td><td>{names.get(order.establishment_id) || "Estabelecimento"}</td><td>{formatDate(order.delivery_date)}</td><td>{order.quantity}</td><td>{formatMoney(Number(order.total_price))}</td><td><StatusBadge cancelled={Boolean(order.cancelled_at)} /></td><td><Link className="font-semibold text-green-800 underline" href={`/admin/pedidos/${order.id}`}>Detalhes</Link></td></tr>)}
      </tbody></table></div>}
      {(pageCount > 1 || page > 1) && <nav aria-label="Paginação de pedidos" className="mt-5 flex flex-wrap items-center justify-between gap-3"><span className="muted">Página {page} de {pageCount}</span><div className="inline-actions">{page > 1 && <Link className="button button-secondary" href={pageHref(page - 1)}>← Anterior</Link>}{page < pageCount && <Link className="button button-secondary" href={pageHref(page + 1)}>Próxima →</Link>}</div></nav>}
    </Card>

    <section id="novo-pedido" className="scroll-mt-8"><Card><h2 className="text-xl font-semibold">Registrar pedido manualmente</h2><p className="muted mb-6 mt-2">O pedido será confirmado e aparecerá no histórico do estabelecimento.</p>
      {establishments.some((establishment) => establishment.active) ? <OrderForm action={createManualOrder} establishments={establishments} submitLabel="Registrar pedido" admin /> : <EmptyState title="Cadastre um estabelecimento ativo para começar" description="Na página Estabelecimentos, crie um cadastro ou reative um estabelecimento existente." />}
    </Card></section>
  </div>;
}
