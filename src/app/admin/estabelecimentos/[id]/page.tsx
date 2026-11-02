import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icon";
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
    <Link className="text-link" href="/admin/estabelecimentos">← Voltar aos clientes</Link>
    <PageHeading title={establishment.name} action={<Link className="button button-secondary" href={`/admin/pedidos?estabelecimento=${id}`}><Icon name="history" />Ver pedidos</Link>} />
    {query.created === "1" && <Notice kind="success">Cliente cadastrado. Entregue o e-mail e a senha inicial ao responsável.</Notice>}
    {!establishment.active && <Notice kind="error">Cliente inativo: não pode entrar nem fazer pedidos. Os pedidos anteriores continuam no histórico.</Notice>}

    <Card className="stack">
      <div className="section-heading"><Icon name="customers" /><h2>Dados do cliente</h2></div>
      <ActionForm action={updateEstablishment} className="stack">
        <input type="hidden" name="id" value={id} />
        <EstablishmentFields initial={establishment} />
        <div><SubmitButton pendingText="Salvando…">Salvar dados</SubmitButton></div>
      </ActionForm>
    </Card>

    <Card className="stack">
      <h2>Entrada no sistema</h2>
      {!hasAccess ? <ActionForm action={createEstablishmentAccess} className="stack">
        <input type="hidden" name="id" value={id} />
        <p className="muted">Crie o e-mail e a senha que o cliente usará para fazer pedidos.</p>
        <AccessFields initialEmail={establishment.access_email || ""} />
        <div><SubmitButton pendingText="Criando acesso…">Criar acesso</SubmitButton></div>
      </ActionForm> : <>
        <div><p className="stat-label">E-mail para entrar</p><p className="preserve-lines"><strong>{establishment.access_email}</strong></p></div>
        <details className="disclosure">
          <summary>Trocar e-mail</summary>
          <div className="disclosure-body"><ActionForm action={updateAccessEmail} className="stack">
            <input type="hidden" name="id" value={id} />
            <div className="field"><label className="label" htmlFor="access-email">Novo e-mail para entrar</label><input className="input" id="access-email" name="email" type="email" maxLength={254} defaultValue={establishment.access_email || ""} required /></div>
            <div><SubmitButton className="button button-secondary" pendingText="Salvando e-mail…">Salvar e-mail</SubmitButton></div>
          </ActionForm></div>
        </details>
        <details className="disclosure">
          <summary>Criar nova senha</summary>
          <div className="disclosure-body"><ActionForm action={updateAccessPassword} className="stack">
            <input type="hidden" name="id" value={id} />
            <div className="field"><label className="label" htmlFor="new-password">Nova senha do cliente</label><input className="input" id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} aria-describedby="new-password-hint" required /><span className="helper" id="new-password-hint">Use pelo menos 12 caracteres e entregue a nova senha ao responsável.</span></div>
            <div><SubmitButton className="button button-secondary" pendingText="Salvando senha…">Salvar nova senha</SubmitButton></div>
          </ActionForm></div>
        </details>
      </>}
    </Card>

    <Card className="compact-card stack">
      <div className="section-heading"><h2>Acesso aos pedidos</h2><span className={`badge ${establishment.active ? "" : "badge-cancelled"}`}>{establishment.active ? "Ativo" : "Inativo"}</span></div>
      <p className="muted">{establishment.active ? "Ao desativar, o cliente não poderá entrar nem fazer novos pedidos. O histórico é mantido." : "Reative para o cliente voltar a entrar e fazer pedidos."}</p>
      <ActionForm action={setEstablishmentActive} className="stack">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="active" value={establishment.active ? "false" : "true"} />
        <div><SubmitButton className={establishment.active ? "button button-secondary" : "button"} pendingText="Atualizando…">{establishment.active ? "Desativar cliente" : "Reativar cliente"}</SubmitButton></div>
      </ActionForm>
      <small className="muted">Cadastro criado em {formatDateTime(establishment.created_at)}.</small>
    </Card>
  </div>;
}