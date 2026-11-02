import Link from 'next/link';
import { PageHeading, Card } from '@/components/ui';
import { OrderForm } from '@/components/order-form';
import { createOrderAction } from '@/lib/actions';
import { requireProfile } from '@/lib/auth';
import { formatDate, todayInSaoPaulo, UNIT_PRICE, formatMoney } from '@/lib/domain';

export default async function NewOrder({ searchParams }: { searchParams: Promise<{ repetir?: string }> }) {
  const { supabase, establishment } = await requireProfile('establishment');
  const { repetir } = await searchParams;
  const { data: repeated } = repetir && /^[\da-f-]{36}$/i.test(repetir)
    ? await supabase.from('orders').select('*').eq('id', repetir).single()
    : { data: null };
  return <>
    <PageHeading eyebrow="BOM TER VOCÊ POR AQUI" title={`Olá, ${establishment!.name}!`} description="Seu próximo pedido começa aqui. Escolha a quantidade e o dia da entrega." />
    <div className="customer-grid"><Card className="product-card"><div className="product-header"><div className="product-icon" aria-hidden="true">◒</div><div><span className="eyebrow">NOSSO QUEIJO DE TODO DIA</span><h2>Queijo Fresco</h2><p className="muted">{formatMoney(UNIT_PRICE)} / unidade</p></div><span className="badge">Fresco</span></div>
      {repeated && <p className="repeat-note">Repetindo o pedido nº {repeated.order_number}. Confira a quantidade e escolha uma nova data.</p>}
      <OrderForm key={repeated?.id ?? 'novo'} action={createOrderAction} initial={repeated ? { quantity: repeated.quantity, notes: repeated.notes, deliveryDate: todayInSaoPaulo() } : undefined} />
    </Card><aside className="customer-aside"><div className="gentle-card"><span className="eyebrow">DO SEU JEITO, SEM COMPLICAÇÃO</span><h2>Um bom queijo.<br />Um pedido simples.</h2><p>Depois de confirmar, seu pedido já chega para a nossa família organizar a entrega.</p><div className="gentle-divider"/><p><strong>Quer pedir de novo?</strong><br />Encontre um pedido anterior e repita com a quantidade e a data que precisar.</p><Link className="text-link" href="/pedidos/historico">Ver meus pedidos <span aria-hidden="true">→</span></Link></div><p className="helper aside-date">Hoje, {formatDate(todayInSaoPaulo())}<br />Horário de Brasília</p></aside></div>
  </>;
}
