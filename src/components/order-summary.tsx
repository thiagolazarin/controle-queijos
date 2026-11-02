import { formatDate, formatMoney, isValidDate, UNIT_PRICE } from '@/lib/domain';
import { Icon } from './icon';

type OrderSummaryProps = {
  quantity: number;
  deliveryDate: string;
  deliveryAddress?: string | null;
  deliveryEstimate?: string | null;
  totalPrice?: number;
  unitPrice?: number;
  orderNumber?: number;
  establishmentName?: string;
  compact?: boolean;
  cancelled?: boolean;
};

export function OrderSummary({ quantity, deliveryDate, deliveryAddress, deliveryEstimate, totalPrice, unitPrice = UNIT_PRICE, orderNumber, establishmentName, compact = false, cancelled = false }: OrderSummaryProps) {
  const validQuantity = Number.isSafeInteger(quantity) && quantity >= 1;
  const total = totalPrice ?? (validQuantity ? quantity * unitPrice : NaN);
  return <section className={`order-summary ${compact ? 'order-summary-compact' : ''}`} aria-label="Resumo do pedido">
    <div className="summary-heading"><h2><Icon name="orders" /> Resumo do pedido</h2>{orderNumber !== undefined && <span className="summary-order-number">Nº {orderNumber}</span>}</div>
    {establishmentName && <p className="summary-customer">{establishmentName}</p>}
    <div className="summary-amount"><div><span>Queijo fresco</span><strong>{validQuantity ? `${quantity} ${quantity === 1 ? 'queijo' : 'queijos'}` : 'Informe a quantidade'}</strong></div><strong>{Number.isFinite(total) ? formatMoney(total) : '—'}</strong></div>
    <dl className="summary-items">
      <div className="summary-row"><dt><Icon name="calendar" /> Entrega</dt><dd>{isValidDate(deliveryDate) ? formatDate(deliveryDate) : 'Escolha a data'}</dd></div>
      <div className="summary-row"><dt><Icon name="location" /> Endereço</dt><dd className="delivery-address">{deliveryAddress?.trim() || (orderNumber !== undefined ? 'Não informado neste pedido.' : 'Informe o endereço de entrega.')}</dd></div>
      <div className="summary-row"><dt><Icon name="clock" /> Previsão da família</dt><dd className={`delivery-estimate ${deliveryEstimate ? 'delivery-estimate-informed' : ''}`}>{deliveryEstimate?.trim() || (cancelled ? 'Não informada neste pedido.' : 'A família informará o horário')}</dd></div>
      {!compact && <div className="summary-row"><dt>Preço por unidade</dt><dd>{formatMoney(unitPrice)}</dd></div>}
    </dl>
  </section>;
}
