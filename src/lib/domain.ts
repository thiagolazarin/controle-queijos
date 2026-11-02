export const UNIT_PRICE = 20;
export const TIME_ZONE = 'America/Sao_Paulo';
export const MAX_QUANTITY = 100_000;

export function todayInSaoPaulo(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, dateStyle: 'short' })
    .format(new Date(`${value}T12:00:00Z`));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE, dateStyle: 'short', timeStyle: 'short',
  }).format(new Date(value));
}

export function validateOrderInput(input: {
  quantity: unknown; deliveryDate: unknown; notes?: unknown;
}, today = todayInSaoPaulo(), existingDeliveryDate?: string) {
  const rawQuantity = input.quantity;
  if ((typeof rawQuantity !== 'string' && typeof rawQuantity !== 'number') || !/^\d+$/.test(String(rawQuantity))) {
    throw new Error('Informe uma quantidade inteira de queijos.');
  }
  const quantity = Number(rawQuantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new Error(`A quantidade deve ser entre 1 e ${MAX_QUANTITY.toLocaleString('pt-BR')}.`);
  }
  const deliveryDate = String(input.deliveryDate ?? '');
  if (!isValidDate(deliveryDate)) throw new Error('Escolha uma data de entrega válida.');
  if (deliveryDate < today && deliveryDate !== existingDeliveryDate) throw new Error('A data de entrega não pode estar no passado.');
  if (input.notes != null && typeof input.notes !== 'string') throw new Error('Informe observações válidas.');
  const notes = String(input.notes ?? '').trim();
  if (notes.length > 1000) throw new Error('As observações devem ter no máximo 1.000 caracteres.');
  return { quantity, deliveryDate, notes: notes || null };
}

export function summarizeOrders(orders: { quantity: number; total_price: number; cancelled_at: string | null }[]) {
  return orders.reduce((total, order) => order.cancelled_at ? total : {
    quantity: total.quantity + order.quantity,
    amount: total.amount + Number(order.total_price),
    count: total.count + 1,
  }, { quantity: 0, amount: 0, count: 0 });
}

export const MAX_DELIVERY_ADDRESS_LENGTH = 500;
export const MAX_DELIVERY_ESTIMATE_LENGTH = 120;

export function validateDeliveryAddress(value: unknown, { required = true }: { required?: boolean } = {}): string | null {
  if (value != null && typeof value !== 'string') throw new Error('Informe um endereço de entrega válido.');
  const address = String(value ?? '').trim();
  if (required && !address) throw new Error('Informe o endereço de entrega.');
  if (address.length > MAX_DELIVERY_ADDRESS_LENGTH) throw new Error('O endereço de entrega deve ter no máximo 500 caracteres.');
  return address || null;
}

export function validateDeliveryEstimate(value: unknown): string | null {
  if (value != null && typeof value !== 'string') throw new Error('Informe uma previsão de entrega válida.');
  const estimate = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (estimate.length > MAX_DELIVERY_ESTIMATE_LENGTH) throw new Error('A previsão deve ter no máximo 120 caracteres.');
  return estimate || null;
}
