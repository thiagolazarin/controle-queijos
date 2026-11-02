import Link from "next/link";
import { Card, EmptyState, PageHeading, StatusBadge } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { addDays, formatDate, formatMoney, todayInSaoPaulo } from "@/lib/domain";
import { fetchDailyOrders, fetchEstablishments, isDate } from "./_lib/data";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const { supabase } = await requireProfile("admin");
  const params = await searchParams;
  const date = isDate(params.data) ? params.data : todayInSaoPaulo();
  const [orders, establishments] = await Promise.all([fetchDailyOrders(supabase, date), fetchEstablishments(supabase)]);
  const names = new Map(establishments.map((establishment) => [establishment.id, establishment.name]));
  const confirmed = orders.filter((order) => !order.cancelled_at);
  const cancelled = orders.filter((order) => order.cancelled_at);
  const quantity = confirmed.reduce((sum, order) => sum + order.quantity, 0);
  const total = confirmed.reduce((sum, order) => sum + Number(order.total_price), 0);
  const customers = new Set(confirmed.map((order) => order.establishment_id)).size;
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" }).format(new Date(`${date}T12:00:00Z`));

  return <div className="stack">
    <PageHeading eyebrow="Administração" title="Pedidos por dia" description="Consulte os pedidos e a quantidade total de queijos para cada data de entrega."
      action={<Link className="button" href="/admin/pedidos#novo-pedido">+ Registrar pedido</Link>} />

    <Card>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="muted capitalize">{weekday}</p><h2 className="text-2xl font-semibold">{formatDate(date)}</h2></div>
        <form className="flex flex-wrap items-end gap-3" action="/admin" method="get">
          <div className="field"><label className="label" htmlFor="delivery-date">Data da entrega</label><input className="input" id="delivery-date" name="data" type="date" defaultValue={date} required /></div>
          <button className="button button-secondary" type="submit">Consultar</button>
        </form>
      </div>
      <nav aria-label="Navegar entre datas" className="mt-5 flex flex-wrap gap-3">
        <Link className="button button-secondary" href={`/admin?data=${addDays(date, -1)}`}>← Dia anterior</Link>
        <Link className="button button-secondary" href="/admin">Hoje</Link>
        <Link className="button button-secondary" href={`/admin?data=${addDays(date, 1)}`}>Próximo dia →</Link>
      </nav>
    </Card>

    <div className="grid gap-4 sm:grid-cols-3">
      <Card><p className="muted">Queijos para o dia</p><p className="mt-2 text-4xl font-bold text-green-800">{quantity}</p><p className="muted mt-1">{confirmed.length} pedido{confirmed.length !== 1 ? "s" : ""} confirmado{confirmed.length !== 1 ? "s" : ""}</p></Card>
      <Card><p className="muted">Valor total do dia</p><p className="mt-2 text-3xl font-bold">{formatMoney(total)}</p><p className="muted mt-1">Pedidos cancelados não entram no total</p></Card>
      <Card><p className="muted">Estabelecimentos</p><p className="mt-2 text-4xl font-bold">{customers}</p><p className="muted mt-1">Com pedidos para esta data</p></Card>
    </div>

    <Card>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Entregas de {formatDate(date)}</h2><Link className="text-sm font-semibold text-green-800 underline" href={`/admin/pedidos?de=${date}&ate=${date}`}>Ver todos os pedidos deste dia</Link></div>
      {confirmed.length === 0 ? <EmptyState title="Nenhum pedido confirmado para esta data" description="Escolha outra data ou registre um pedido recebido pelo telefone ou WhatsApp." /> : <>
        <div className="table-wrap"><table><thead><tr><th>Estabelecimento</th><th>Pedido</th><th>Quantidade</th><th>Valor</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
          {confirmed.map((order) => <tr key={order.id}>
            <td className="font-medium">{names.get(order.establishment_id) || "Estabelecimento"}</td><td>#{order.order_number}</td><td>{order.quantity} queijos</td><td>{formatMoney(Number(order.total_price))}</td>
            <td><Link className="font-semibold text-green-800 underline" href={`/admin/pedidos/${order.id}`}>Ver pedido</Link></td>
          </tr>)}
        </tbody><tfoot><tr><th colSpan={2}>Total do dia</th><th>{quantity} queijos</th><th>{formatMoney(total)}</th><td /></tr></tfoot></table></div>
      </>}
    </Card>

    {cancelled.length > 0 && <Card><details><summary className="cursor-pointer font-semibold">{cancelled.length} pedido{cancelled.length !== 1 ? "s" : ""} cancelado{cancelled.length !== 1 ? "s" : ""} nesta data</summary><p className="muted mt-3">Estes pedidos permanecem no histórico e não entram nos totais.</p><ul className="mt-4 space-y-3">{cancelled.map((order) => <li className="flex flex-wrap items-center gap-3" key={order.id}><Link className="text-green-800 underline" href={`/admin/pedidos/${order.id}`}>#{order.order_number} · {names.get(order.establishment_id)} · {order.quantity} queijos</Link><StatusBadge cancelled /></li>)}</ul></details></Card>}
  </div>;
}
