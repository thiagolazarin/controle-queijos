import Link from 'next/link';
import { Icon } from '@/components/icon';
import { Card, EmptyState, PageHeading } from '@/components/ui';
import { requireProfile } from '@/lib/auth';
import { addDays, formatDate, formatMoney, todayInSaoPaulo } from '@/lib/domain';
import { fetchDailyOrders, fetchEstablishments, isDate } from './_lib/data';
import { AdminOrderList } from './_components/order-list';

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const { supabase } = await requireProfile('admin');
  const params = await searchParams;
  const today = todayInSaoPaulo();
  const date = isDate(params.data) ? params.data : today;
  const [orders, establishments] = await Promise.all([fetchDailyOrders(supabase, date), fetchEstablishments(supabase)]);
  const names = new Map(establishments.map((establishment) => [establishment.id, establishment.name]));
  const confirmed = orders.filter((order) => !order.cancelled_at);
  const cancelled = orders.filter((order) => order.cancelled_at);
  const quantity = confirmed.reduce((sum, order) => sum + order.quantity, 0);
  const total = confirmed.reduce((sum, order) => sum + Number(order.total_price), 0);
  const customers = new Set(confirmed.map((order) => order.establishment_id)).size;
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(`${date}T12:00:00Z`));
  const quickDates = [{ label: 'Ontem', value: addDays(today, -1) }, { label: 'Hoje', value: today }, { label: 'Amanhã', value: addDays(today, 1) }];

  return <div className="stack">
    <PageHeading title="Entregas do dia" action={<Link className="button" href="/admin/pedidos?novo=1#novo-pedido"><Icon name="plus" /> Novo pedido</Link>} />
    <Card className="compact-card">
      <div className="day-toolbar">
        <div><p className="stat-label">Data da entrega</p><h2>{formatDate(date)}</h2><span className="muted capitalize">{weekday}</span></div>
        <div className="date-controls">
          <nav className="inline-actions" aria-label="Escolher dia">{quickDates.map((day) => <Link key={day.label} className={date === day.value ? 'button' : 'button button-secondary'} aria-current={date === day.value ? 'date' : undefined} href={day.value === today ? '/admin' : `/admin?data=${day.value}`}>{day.label}</Link>)}</nav>
          <form action="/admin" method="get" className="date-controls"><label className="sr-only" htmlFor="delivery-date">Escolher outra data</label><input className="input" id="delivery-date" name="data" type="date" defaultValue={date} required /><button className="button button-secondary" type="submit"><Icon name="calendar" /> Ver</button></form>
        </div>
      </div>
    </Card>

    <Card className="daily-total">
      <div><p className="stat-label">Total para entregar</p><div className="daily-total-number">{quantity}<span>queijos</span></div></div>
      <div className="summary-secondary"><strong>{formatMoney(total)}</strong><span>{confirmed.length} pedido{confirmed.length !== 1 ? 's' : ''} · {customers} cliente{customers !== 1 ? 's' : ''}</span></div>
    </Card>

    <Card>
      <div className="section-heading"><h2>Para entregar</h2><Link className="text-link" href={`/admin/pedidos?de=${date}&ate=${date}`}>Ver histórico <Icon name="history" /></Link></div>
      {confirmed.length === 0 ? <EmptyState title="Nenhum pedido para este dia" description="Escolha outra data ou use Novo pedido para registrar uma solicitação." /> : <AdminOrderList orders={confirmed} names={names} />}
    </Card>

    {cancelled.length > 0 && <details className="disclosure"><summary><Icon name="history" /> Cancelados neste dia ({cancelled.length})</summary><div className="disclosure-body"><p className="helper">Pedidos cancelados ficam no histórico e não entram no total do dia.</p><AdminOrderList orders={cancelled} names={names} history /></div></details>}
  </div>;
}