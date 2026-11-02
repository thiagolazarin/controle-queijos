import Link from 'next/link';
import { Icon } from '@/components/icon';
import { DeliveryEstimateForm } from '@/components/delivery-estimate-form';
import { StatusBadge } from '@/components/ui';
import { formatDate, formatDateTime, formatMoney } from '@/lib/domain';
import type { Order } from '../_lib/data';

export function AdminOrderList({ orders, names, history = false }: {
  orders: Order[];
  names: Map<string, string>;
  history?: boolean;
}) {
  return <ul className="order-list">{orders.map((order) => <li className="order-list-item" key={order.id}>
    <div className="order-list-main">
      <h3>{names.get(order.establishment_id) || 'Cliente'}</h3>
      <p className="order-list-meta">Pedido #{order.order_number}{history ? ` · Entrega ${formatDate(order.delivery_date)}` : ''}</p>
      <p className="delivery-address" title={order.delivery_address || undefined}><strong>Endereço:</strong> {order.delivery_address ? (order.delivery_address.length > 140 ? `${order.delivery_address.slice(0, 137)}…` : order.delivery_address) : 'Não informado neste pedido'}</p>
      <p className="delivery-estimate"><strong>Previsão:</strong> {order.delivery_estimate || 'A combinar'}</p>
      {history && <p className="order-list-meta">Feito em {formatDateTime(order.created_at)}</p>}
      {history && <StatusBadge cancelled={Boolean(order.cancelled_at)} />}
    </div>
    <div className="order-list-quantity"><strong>{order.quantity}</strong><span>queijos</span><small>{formatMoney(Number(order.total_price))}</small></div>
    <Link className="button button-secondary" href={`/admin/pedidos/${order.id}`}>Ver pedido <Icon name="arrow" /></Link>
    {!history && !order.cancelled_at && <details className="disclosure order-estimate-editor"><summary><Icon name="clock" /> {order.delivery_estimate ? 'Alterar previsão' : 'Informar previsão'}</summary><div className="disclosure-body"><DeliveryEstimateForm key={`${order.id}:${order.updated_at}`} orderId={order.id} updatedAt={order.updated_at} initialEstimate={order.delivery_estimate} compact /></div></details>}
  </li>)}</ul>;
}