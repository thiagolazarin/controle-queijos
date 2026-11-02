import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { OrderForm } from "@/components/order-form";
import { OrderSummary } from "@/components/order-summary";
import { DeliveryEstimateForm } from "@/components/delivery-estimate-form";
import { Card, Notice, PageHeading, StatusBadge, SubmitButton } from "@/components/ui";
import { cancelOrder, updateOrder } from "@/lib/admin-actions";
import { requireProfile } from "@/lib/auth";
import { formatDateTime, formatMoney } from "@/lib/domain";
import { isUuid } from "../../_lib/data";

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { supabase } = await requireProfile("admin");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { data: order, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar o pedido.");
  if (!order) notFound();
  const [establishmentResult, authorsResult, query] = await Promise.all([
    supabase.from("establishments").select("id, name, address").eq("id", order.establishment_id).single(),
    supabase.from("profiles").select("id, full_name, role").in("id", [order.created_by, order.cancelled_by].filter((value): value is string => Boolean(value))),
    searchParams,
  ]);
  if (establishmentResult.error || authorsResult.error) throw new Error("Não foi possível carregar os detalhes do pedido.");
  const establishment = establishmentResult.data;
  const authors = new Map(authorsResult.data.map((author) => [author.id, author]));
  const creator = authors.get(order.created_by);

  return <div className="stack">
    <Link className="text-link" href="/admin/pedidos">← Voltar aos pedidos</Link>
    <PageHeading title={`Pedido #${order.order_number}`} action={<StatusBadge cancelled={Boolean(order.cancelled_at)} />} />
    {query.created === "1" && <Notice kind="success">Pedido #{order.order_number} confirmado.</Notice>}

    <Card className="stack">
      <OrderSummary cancelled={Boolean(order.cancelled_at)} quantity={order.quantity} deliveryDate={order.delivery_date} deliveryAddress={order.delivery_address} deliveryEstimate={order.delivery_estimate} totalPrice={Number(order.total_price)} unitPrice={Number(order.unit_price)} orderNumber={order.order_number} establishmentName={establishment?.name} />
      <Link className="text-link" href={`/admin/estabelecimentos/${order.establishment_id}`}>Ver cadastro do cliente <Icon name="arrow" /></Link>
      {order.notes && <div><h3>Observações</h3><p className="preserve-lines">{order.notes}</p></div>}
      <details className="disclosure">
        <summary>Mais informações</summary>
        <div className="disclosure-body"><dl className="detail-grid">
          <div><dt>Pedido feito em</dt><dd>{formatDateTime(order.created_at)}</dd></div>
          <div><dt>Preço por queijo</dt><dd>{formatMoney(Number(order.unit_price))}</dd></div>
          <div><dt>Registrado por</dt><dd>{creator?.full_name || (creator?.role === "admin" ? "Administrador" : "Cliente")}{creator?.role === "admin" && <small className="muted block">Pela administração</small>}</dd></div>
          <div><dt>Última alteração</dt><dd>{formatDateTime(order.updated_at)}</dd></div>
        </dl></div>
      </details>
    </Card>

    {order.cancelled_at ? <Card className="stack">
      <h2>Pedido cancelado</h2>
      <p className="muted">Cancelado em {formatDateTime(order.cancelled_at)}{order.cancelled_by && authors.get(order.cancelled_by)?.full_name ? ` por ${authors.get(order.cancelled_by)?.full_name}` : ""}. Ele continua no histórico e não entra no total do dia.</p>
      <div><Link className="button" href="/admin/pedidos?novo=1#novo-pedido"><Icon name="plus" />Novo pedido</Link></div>
    </Card> : <>
      <Card className="stack">
        <div className="section-heading"><Icon name="clock" /><h2>Previsão da entrega</h2></div>
        <DeliveryEstimateForm key={`${order.id}:${order.updated_at}`} orderId={order.id} updatedAt={order.updated_at} initialEstimate={order.delivery_estimate} />
      </Card>
      <Card className="stack">
        <div className="section-heading"><Icon name="orders" /><h2>Alterar pedido</h2></div>
        <OrderForm action={updateOrder} initial={{ id: order.id, quantity: order.quantity, deliveryDate: order.delivery_date, notes: order.notes || "", deliveryAddress: order.delivery_address, deliveryEstimate: order.delivery_estimate }} defaultDeliveryAddress={establishment?.address} submitLabel="Salvar alterações" admin />
      </Card>
      <Card className="compact-card">
        <details className="disclosure">
          <summary>Cancelar pedido</summary>
          <div className="disclosure-body stack">
            <p className="muted">O pedido sai do total do dia, mas continua no histórico. O cancelamento não pode ser desfeito.</p>
            <ActionForm action={cancelOrder} className="stack">
              <input type="hidden" name="id" value={order.id} />
              <label className="checkbox-label"><input type="checkbox" name="confirm" value="yes" required /><span>Quero cancelar o pedido #{order.order_number}.</span></label>
              <div><SubmitButton className="button button-danger" pendingText="Cancelando…">Confirmar cancelamento</SubmitButton></div>
            </ActionForm>
          </div>
        </details>
      </Card>
    </>}
  </div>;
}