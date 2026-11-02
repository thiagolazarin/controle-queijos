import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Card, Notice, PageHeading, SubmitButton } from "@/components/ui";
import { createEstablishmentAccess, setEstablishmentActive, updateAccessEmail, updateAccessPassword, updateEstablishment } from "@/lib/admin-actions";
import { requireProfile } from "@/lib/auth";
import { formatDateTime } from "@/lib/domain";
import { isUuid } from "../../_lib/data";
import { AccessFields, EstablishmentFields } from "../_fields";

export default async function EstablishmentDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { supabase } = await requireProfile("admin");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { data: establishment, error } = await supabase.from("establishments").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar o estabelecimento.");
  if (!establishment) notFound();
  const [profileResult, query] = await Promise.all([
    supabase.from("profiles").select("id").eq("establishment_id", id).eq("role", "establishment").maybeSingle(),
    searchParams,
  ]);
  if (profileResult.error) throw new Error("Não foi possível verificar o acesso do estabelecimento.");
  const hasAccess = Boolean(profileResult.data);

  return <div className="stack">
    <Link className="font-semibold text-green-800 underline" href="/admin/estabelecimentos">← Todos os estabelecimentos</Link>
    <PageHeading eyebrow="Cadastro do cliente" title={establishment.name} description={`Cadastrado em ${formatDateTime(establishment.created_at)}`}
      action={<Link className="button button-secondary" href={`/admin/pedidos?estabelecimento=${id}`}>Ver histórico de pedidos</Link>} />
    {query.created === "1" && <Notice kind="success">Estabelecimento cadastrado e acesso criado com sucesso. Entregue o e-mail e a senha inicial ao responsável.</Notice>}
    {!establishment.active && <Notice kind="error">Este estabelecimento está inativo e não pode acessar as operações do cliente. Seu histórico está preservado.</Notice>}

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Card><h2 className="text-xl font-semibold">Dados do estabelecimento</h2><p className="muted mb-6 mt-2">Mantenha o nome e as informações de contato atualizados.</p><ActionForm action={updateEstablishment} className="stack"><input type="hidden" name="id" value={id} /><EstablishmentFields initial={establishment} /><div><SubmitButton pendingText="Salvando…">Salvar dados</SubmitButton></div></ActionForm></Card>
      <Card><h2 className="text-xl font-semibold">Situação do estabelecimento</h2><p className="my-4"><span className={`badge ${establishment.active ? "" : "badge-cancelled"}`}>{establishment.active ? "Ativo" : "Inativo"}</span></p><p className="muted mb-5">{establishment.active ? "Ao desativar, o cliente perde acesso às operações. Todos os pedidos permanecem no histórico." : "Ao reativar, o cliente poderá voltar a acessar sua conta e registrar pedidos."}</p><ActionForm action={setEstablishmentActive} className="stack"><input type="hidden" name="id" value={id} /><input type="hidden" name="active" value={establishment.active ? "false" : "true"} /><SubmitButton className={establishment.active ? "button button-secondary" : "button"} pendingText="Atualizando…">{establishment.active ? "Desativar estabelecimento" : "Reativar estabelecimento"}</SubmitButton></ActionForm></Card>
    </div>

    <Card><h2 className="text-xl font-semibold">Acesso do estabelecimento</h2><p className="muted mb-6 mt-2">O responsável usa o e-mail e a senha para entrar e fazer pedidos.</p>
      {!hasAccess ? <ActionForm action={createEstablishmentAccess} className="stack"><input type="hidden" name="id" value={id} /><Notice kind="error">Ainda não há uma conta vinculada a este estabelecimento. Crie o acesso abaixo.</Notice><AccessFields initialEmail={establishment.access_email || ""} /><div><SubmitButton pendingText="Criando acesso…">Criar acesso</SubmitButton></div></ActionForm> : <div className="grid-2">
        <ActionForm action={updateAccessEmail} className="stack"><input type="hidden" name="id" value={id} /><div className="field"><label className="label" htmlFor="access-email">E-mail de acesso</label><input className="input" id="access-email" name="email" type="email" maxLength={254} defaultValue={establishment.access_email || ""} required /></div><p className="muted text-sm">A alteração passa a valer no próximo login.</p><div><SubmitButton className="button button-secondary" pendingText="Atualizando e-mail…">Atualizar e-mail</SubmitButton></div></ActionForm>
        <ActionForm action={updateAccessPassword} className="stack"><input type="hidden" name="id" value={id} /><div className="field"><label className="label" htmlFor="new-password">Nova senha</label><input className="input" id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} aria-describedby="new-password-hint" required /></div><p className="muted text-sm" id="new-password-hint">Pelo menos 12 caracteres. Entregue a nova senha ao responsável por um canal seguro.</p><div><SubmitButton className="button button-secondary" pendingText="Redefinindo senha…">Redefinir senha</SubmitButton></div></ActionForm>
      </div>}
    </Card>
  </div>;
}
