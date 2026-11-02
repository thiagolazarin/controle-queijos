import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { OrderForm } from "@/components/order-form";
import { Card, Notice, PageHeading, StatusBadge, SubmitButton } from "@/components/ui";
import { cancelOrder, updateOrder } from "@/lib/admin-actions";
import { requireProfile } from "@/lib/auth";
import { formatDate, formatDateTime, formatMoney } from "@/lib/domain";
import { isUuid } from "../../_lib/data";

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { supabase } = await requireProfile("admin");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { data: order, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar o pedido.");
  if (!order) notFound();
  const [establishmentResult, authorsResult, query] = await Promise.all([
    supabase.from("establishments").select("id, name").eq("id", order.establishment_id).single(),
    supabase.from("profiles").select("id, full_name, role").in("id", [order.created_by, order.cancelled_by].filter((value): value is string => Boolean(value))),
    searchParams,
  ]);
  if (establishmentResult.error || authorsResult.error) throw new Error("Não foi possível carregar os detalhes do pedido.");
  const establishment = establishmentResult.data;
  const authors = new Map(authorsResult.data.map((author) => [author.id, author]));
  const creator = authors.get(order.created_by);

  return <div className="stack">
    <Link className="font-semibold text-green-800 underline" href="/admin/pedidos">← Todos os pedidos</Link>
    <PageHeading eyebrow={establishment?.name || "Pedido"} title={`Pedido #${order.order_number}`} description={`Solicitado em ${formatDateTime(order.created_at)}`}
      action={<StatusBadge cancelled={Boolean(order.cancelled_at)} />} />
    {query.created === "1" && <Notice kind="success">Pedido #{order.order_number} registrado e confirmado com sucesso.</Notice>}

    <Card><h2 className="mb-5 text-xl font-semibold">Detalhes do pedido</h2><dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div><dt className="muted">Estabelecimento</dt><dd className="mt-1 font-semibold"><Link className="text-green-800 underline" href={`/admin/estabelecimentos/${order.establishment_id}`}>{establishment?.name}</Link></dd></div>
      <div><dt className="muted">Data de entrega</dt><dd className="mt-1 font-semibold">{formatDate(order.delivery_date)}</dd></div>
      <div><dt className="muted">Quantidade</dt><dd className="mt-1 font-semibold">{order.quantity} queijos</dd></div>
      <div><dt className="muted">Preço por unidade</dt><dd className="mt-1 font-semibold">{formatMoney(Number(order.unit_price))}</dd></div>
      <div><dt className="muted">Total do pedido</dt><dd className="mt-1 text-xl font-bold text-green-800">{formatMoney(Number(order.total_price))}</dd></div>
      <div><dt className="muted">Registrado por</dt><dd className="mt-1 font-semibold">{creator?.full_name || (creator?.role === "admin" ? "Administrador" : "Estabelecimento")}{creator?.role === "admin" && <span className="muted block text-sm font-normal">Pedido registrado pela administração</span>}</dd></div>
      <div><dt className="muted">Última atualização</dt><dd className="mt-1">{formatDateTime(order.updated_at)}</dd></div>
      {order.notes && <div className="sm:col-span-2"><dt className="muted">Observações</dt><dd className="mt-1 whitespace-pre-wrap break-words">{order.notes}</dd></div>}
    </dl></Card>

    {order.cancelled_at ? <Card><h2 className="mb-3 text-xl font-semibold">Pedido cancelado</h2><p className="muted">Cancelado em {formatDateTime(order.cancelled_at)}{order.cancelled_by && authors.get(order.cancelled_by)?.full_name ? ` por ${authors.get(order.cancelled_by)?.full_name}` : ""}.</p><p className="muted mt-2">O registro foi preservado no histórico e não faz parte dos totais do dia. Para atender este estabelecimento, registre um novo pedido.</p><Link className="button mt-5" href="/admin/pedidos#novo-pedido">Registrar novo pedido</Link></Card> : <>
      <Card><h2 className="text-xl font-semibold">Editar pedido</h2><p className="muted mb-6 mt-2">A quantidade e o total serão atualizados para o estabelecimento e para o resumo do dia.</p><OrderForm action={updateOrder} initial={{ id: order.id, quantity: order.quantity, deliveryDate: order.delivery_date, notes: order.notes || "" }} submitLabel="Salvar alterações" admin /></Card>
      <Card><h2 className="text-lg font-semibold">Cancelar este pedido</h2><p className="muted mb-4 mt-2">O cancelamento retira o pedido dos totais e preserva seu histórico. Esta ação não pode ser desfeita.</p><ActionForm action={cancelOrder} className="stack"><input type="hidden" name="id" value={order.id} /><label className="flex items-start gap-3"><input className="mt-1 h-5 w-5 accent-green-800" type="checkbox" name="confirm" value="yes" required /><span>Confirmo o cancelamento do pedido #{order.order_number}.</span></label><div><SubmitButton className="button button-danger" pendingText="Cancelando…">Cancelar pedido</SubmitButton></div></ActionForm></Card>
    </>}
  </div>;
}
