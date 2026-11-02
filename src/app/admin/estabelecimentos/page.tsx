import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Card, EmptyState, PageHeading, SubmitButton } from "@/components/ui";
import { createEstablishment } from "@/lib/admin-actions";
import { requireProfile } from "@/lib/auth";
import { fetchEstablishments } from "../_lib/data";
import { AccessFields, EstablishmentFields } from "./_fields";

export default async function EstablishmentsPage({ searchParams }: { searchParams: Promise<{ busca?: string; situacao?: string }> }) {
  const { supabase } = await requireProfile("admin");
  const params = await searchParams;
  const establishments = await fetchEstablishments(supabase);
  const search = typeof params.busca === "string" ? params.busca.trim().slice(0, 150) : "";
  const status = params.situacao === "ativo" || params.situacao === "inativo" ? params.situacao : "";
  const filtered = establishments.filter((establishment) => (!search || establishment.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))) && (!status || establishment.active === (status === "ativo")));

  return <div className="stack">
    <PageHeading eyebrow="Administração" title="Estabelecimentos" description="Cadastre seus clientes e gerencie os acessos para fazer pedidos."
      action={<a className="button" href="#novo-estabelecimento">+ Cadastrar estabelecimento</a>} />
    <Card>
      <form className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end" method="get" action="/admin/estabelecimentos">
        <div className="field flex-1"><label className="label" htmlFor="search">Buscar pelo nome</label><input className="input" id="search" name="busca" type="search" maxLength={150} placeholder="Nome do estabelecimento" defaultValue={search} /></div>
        <div className="field"><label className="label" htmlFor="status">Situação</label><select className="input" id="status" name="situacao" defaultValue={status}><option value="">Todos</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select></div>
        <div className="flex gap-3"><button className="button button-secondary" type="submit">Buscar</button>{(search || status) && <Link className="button button-secondary" href="/admin/estabelecimentos">Limpar</Link>}</div>
      </form>
      <h2 className="mb-4 text-lg font-semibold">{filtered.length} estabelecimento{filtered.length !== 1 ? "s" : ""}</h2>
      {filtered.length === 0 ? <EmptyState title="Nenhum estabelecimento encontrado" description="Cadastre seu primeiro cliente abaixo ou ajuste os filtros de busca." /> : <div className="table-wrap"><table><thead><tr><th>Estabelecimento</th><th>Responsável / telefone</th><th>E-mail de acesso</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
        {filtered.map((establishment) => <tr key={establishment.id}><td><Link className="font-semibold text-green-800 underline" href={`/admin/estabelecimentos/${establishment.id}`}>{establishment.name}</Link></td><td>{establishment.contact_name || "Não informado"}{establishment.phone && <span className="muted mt-1 block text-sm">{establishment.phone}</span>}</td><td>{establishment.access_email || "Sem e-mail"}</td><td><span className={`badge ${establishment.active ? "" : "badge-cancelled"}`}>{establishment.active ? "Ativo" : "Inativo"}</span></td><td><Link className="font-semibold text-green-800 underline" href={`/admin/estabelecimentos/${establishment.id}`}>Gerenciar</Link></td></tr>)}
      </tbody></table></div>}
    </Card>
    <section id="novo-estabelecimento" className="scroll-mt-8"><Card><h2 className="text-xl font-semibold">Cadastrar estabelecimento</h2><p className="muted mb-6 mt-2">O acesso será criado junto com o cadastro. Os campos com * são obrigatórios.</p>
      <ActionForm action={createEstablishment} className="stack">
        <EstablishmentFields />
        <div className="border-t border-slate-100 pt-6"><h3 className="mb-4 text-lg font-semibold">Credenciais de acesso</h3><AccessFields /></div>
        <label className="flex items-start gap-3"><input className="mt-1 h-5 w-5 accent-green-800" type="checkbox" name="active" defaultChecked /><span>Estabelecimento ativo<span className="muted mt-1 block text-sm">Permitir acesso e registro de pedidos após o cadastro.</span></span></label>
        <div><SubmitButton pendingText="Criando cadastro e acesso…">Cadastrar e criar acesso</SubmitButton></div>
      </ActionForm>
    </Card></section>
  </div>;
}
