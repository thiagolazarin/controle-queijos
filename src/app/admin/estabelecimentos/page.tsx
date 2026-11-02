import Link from 'next/link';
import { Icon } from '@/components/icon';
import { ActionForm } from '@/components/action-form';
import { Card, EmptyState, PageHeading, SubmitButton } from '@/components/ui';
import { createEstablishment } from '@/lib/admin-actions';
import { requireProfile } from '@/lib/auth';
import { fetchEstablishments } from '../_lib/data';
import { AccessFields, EstablishmentFields } from './_fields';

export default async function EstablishmentsPage({ searchParams }: { searchParams: Promise<{ busca?: string; situacao?: string; novo?: string }> }) {
  const { supabase } = await requireProfile('admin');
  const params = await searchParams;
  const establishments = await fetchEstablishments(supabase);
  const search = typeof params.busca === 'string' ? params.busca.trim().slice(0, 150) : '';
  const status = params.situacao === 'ativo' || params.situacao === 'inativo' ? params.situacao : '';
  const filtered = establishments.filter((establishment) => (!search || establishment.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))) && (!status || establishment.active === (status === 'ativo')));
  const hasFilters = Boolean(search || status);

  return <div className="stack">
    <PageHeading title="Clientes" />
    <details className="disclosure" id="novo-cliente" open={params.novo === '1'}>
      <summary><Icon name="plus" /> Cadastrar cliente</summary>
      <div className="disclosure-body"><p className="helper">Preencha os dados e crie o acesso para o cliente fazer pedidos.</p><ActionForm action={createEstablishment} className="stack">
        <EstablishmentFields />
        <div className="form-divider"><h3>Acesso do cliente</h3><AccessFields /></div>
        <label className="checkbox-label"><input type="checkbox" name="active" defaultChecked /><span>Permitir que este cliente faça pedidos</span></label>
        <div><SubmitButton pendingText="Cadastrando cliente…">Cadastrar cliente</SubmitButton></div>
      </ActionForm></div>
    </details>

    <details className="disclosure" open={hasFilters}>
      <summary><Icon name="customers" /> Buscar cliente{hasFilters ? ' · filtro ativo' : ''}</summary>
      <div className="disclosure-body"><form className="filter-grid" method="get" action="/admin/estabelecimentos">
        <div className="field"><label htmlFor="search">Nome do cliente</label><input className="input" id="search" name="busca" type="search" maxLength={150} placeholder="Digite o nome" defaultValue={search} /></div>
        <div className="field"><label htmlFor="status">Mostrar</label><select className="input" id="status" name="situacao" defaultValue={status}><option value="">Todos os clientes</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select></div>
        <div className="inline-actions"><button className="button" type="submit">Buscar</button>{hasFilters && <Link className="button button-secondary" href="/admin/estabelecimentos">Limpar busca</Link>}</div>
      </form></div>
    </details>

    <Card><div className="section-heading"><h2>Seus clientes</h2><span className="muted">{filtered.length} cliente{filtered.length !== 1 ? 's' : ''}</span></div>
      {filtered.length === 0 ? <EmptyState title="Nenhum cliente encontrado" description="Toque em Cadastrar cliente ou ajuste a busca." /> : <ul className="customer-list">{filtered.map((establishment) => <li className="customer-list-item" key={establishment.id}>
        <div className="order-list-main"><h3>{establishment.name}</h3>{(establishment.contact_name || establishment.phone) && <p className="order-list-meta">{[establishment.contact_name, establishment.phone].filter(Boolean).join(' · ')}</p>}<p className="order-list-meta">{establishment.access_email || 'Sem e-mail de acesso'}</p></div>
        <div className="inline-actions"><span className={`badge ${establishment.active ? '' : 'badge-cancelled'}`}>{establishment.active ? 'Ativo' : 'Inativo'}</span><Link className="button button-secondary" href={`/admin/estabelecimentos/${establishment.id}`}>Ver cliente <Icon name="arrow" /></Link></div>
      </li>)}</ul>}
    </Card>
  </div>;
}