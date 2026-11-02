"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";
import { todayInSaoPaulo, validateDeliveryAddress, validateDeliveryEstimate, validateOrderInput } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { establishmentCreationError } from "@/lib/establishment-errors";

function uuid(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("Registro inválido. Atualize a página e tente novamente.");
  }
  return value;
}

function orderVersion(value: FormDataEntryValue | null) {
  // Preserve the PostgreSQL timestamp verbatim: Date would discard microseconds.
  const parts = typeof value === "string" ? /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value) : null;
  if (!parts || Number(parts[1]) === 0) throw new Error("Atualize a página antes de informar a previsão deste pedido.");
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonth[month - 1]) throw new Error("Atualize a página antes de informar a previsão deste pedido.");
  return value as string;
}
function text(form: FormData, name: string, label: string, maximum: number, required = false) {
  const entry = form.get(name);
  if (entry !== null && typeof entry !== "string") throw new Error(`${label} inválido.`);
  const value = typeof entry === "string" ? entry.trim() : "";
  if (required && !value) throw new Error(`Informe ${label.toLocaleLowerCase("pt-BR")}.`);
  if (value.length > maximum) throw new Error(`${label} deve ter até ${maximum} caracteres.`);
  return value || null;
}

function email(form: FormData) {
  const value = text(form, "email", "E-mail de acesso", 254, true)!.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("Informe um e-mail válido.");
  return value;
}

function password(form: FormData) {
  const value = form.get("password");
  if (typeof value !== "string" || value.length < 12) throw new Error("A senha deve ter pelo menos 12 caracteres.");
  if (value.length > 128) throw new Error("A senha deve ter no máximo 128 caracteres.");
  if (value.trim() !== value) throw new Error("A senha não pode começar ou terminar com espaços.");
  return value;
}

function establishmentData(form: FormData) {
  return {
    name: text(form, "name", "Nome do estabelecimento", 150, true)!,
    contact_name: text(form, "contact_name", "Responsável", 150),
    phone: text(form, "phone", "Telefone", 30),
    address: text(form, "address", "Endereço", 500),
  };
}

function message(error: unknown, fallback: string): ActionState {
  return { error: error instanceof Error ? error.message : fallback };
}

function refreshOrders(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  revalidatePath("/pedidos");
  revalidatePath("/pedidos/historico");
  if (id) {
    revalidatePath(`/admin/pedidos/${id}`);
    revalidatePath(`/pedidos/${id}`);
  }
}

function refreshEstablishments(id: string) {
  revalidatePath("/admin/estabelecimentos");
  revalidatePath(`/admin/estabelecimentos/${id}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
}

function orderFailure(error: { message: string; code?: string }, fallback: string) {
  if (["PGRST202", "PGRST204", "42703"].includes(error.code || "")) {
    return "O banco precisa de uma atualização para usar endereços e previsões de entrega. Peça ao responsável técnico para aplicar as migrations pendentes.";
  }
  const knownMessages = ["quantidade", "data de entrega", "endereço", "previsão", "cancelado", "inativo", "não encontrado", "não existe", "permissão"];
  return knownMessages.some((term) => error.message.toLocaleLowerCase("pt-BR").includes(term)) ? error.message : fallback;
}

export async function createManualOrder(_previous: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireProfile("admin");
  let id: string;
  try {
    const establishmentId = uuid(form.get("establishment_id"));
    const input = validateOrderInput({ quantity: form.get("quantity"), deliveryDate: form.get("delivery_date"), notes: form.get("notes") });
    const deliveryAddress = validateDeliveryAddress(form.get("delivery_address"));
    const { data, error } = await supabase.rpc("create_order", {
      p_establishment_id: establishmentId,
      p_quantity: input.quantity,
      p_delivery_date: input.deliveryDate,
      p_notes: input.notes,
      p_delivery_address: deliveryAddress,
    });
    if (error || !data) return { error: error ? orderFailure(error, "Não foi possível registrar o pedido. Tente novamente.") : "Não foi possível registrar o pedido." };
    id = data;
  } catch (error) {
    return message(error, "Confira os dados do pedido e tente novamente.");
  }
  refreshOrders(id);
  redirect(`/admin/pedidos/${id}?created=1`);
}

export async function updateOrder(_previous: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireProfile("admin");
  let id: string;
  let estimateCleared = false;
  try {
    id = uuid(form.get("order_id"));
    const { data: original, error: originalError } = await supabase.from("orders").select("delivery_date, delivery_address, delivery_estimate, cancelled_at").eq("id", id).maybeSingle();
    if (originalError) return { error: orderFailure(originalError, "Não foi possível verificar o pedido. Tente novamente.") };
    if (!original) return { error: "Pedido não encontrado." };
    if (original.cancelled_at) return { error: "Um pedido cancelado não pode ser alterado." };
    const input = validateOrderInput({ quantity: form.get("quantity"), deliveryDate: form.get("delivery_date"), notes: form.get("notes") }, todayInSaoPaulo(), original.delivery_date);
    const deliveryAddress = validateDeliveryAddress(form.get("delivery_address"));
    estimateCleared = Boolean(original.delivery_estimate && (original.delivery_date !== input.deliveryDate || original.delivery_address !== deliveryAddress));
    const { error } = await supabase.rpc("update_order", { p_order_id: id, p_quantity: input.quantity, p_delivery_date: input.deliveryDate, p_notes: input.notes, p_delivery_address: deliveryAddress });
    if (error) return { error: orderFailure(error, "Não foi possível atualizar o pedido. Tente novamente.") };
  } catch (error) {
    return message(error, "Confira os dados do pedido e tente novamente.");
  }
  refreshOrders(id);
  return { success: estimateCleared ? "Pedido atualizado. Como a data ou o endereço mudou, informe novamente a previsão da entrega." : "Pedido atualizado com sucesso." };
}

export async function cancelOrder(_previous: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireProfile("admin");
  let id: string;
  try {
    id = uuid(form.get("id"));
    if (form.get("confirm") !== "yes") return { error: "Marque a confirmação para cancelar este pedido." };
    const { error } = await supabase.rpc("cancel_order", { p_order_id: id });
    if (error) return { error: orderFailure(error, "Não foi possível cancelar o pedido. Tente novamente.") };
  } catch (error) {
    return message(error, "Não foi possível cancelar o pedido.");
  }
  refreshOrders(id);
  return { success: "Pedido cancelado. Ele foi preservado no histórico e retirado dos totais." };
}

export async function updateDeliveryEstimate(_previous: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireProfile("admin");
  let id: string;
  let estimate: string | null;
  try {
    id = uuid(form.get("order_id"));
    estimate = validateDeliveryEstimate(form.get("delivery_estimate"));
    const expectedUpdatedAt = orderVersion(form.get("order_version"));
    const { error } = await supabase.rpc("set_delivery_estimate", { p_order_id: id, p_estimate: estimate, p_expected_updated_at: expectedUpdatedAt });
    if (error) {
      if (error.code === "40001" || /pedido(?:\s+foi)?\s+alterado/i.test(error.message)) {
        return { error: "Este pedido foi alterado. Atualize a página antes de informar a previsão." };
      }
      return { error: orderFailure(error, "Não foi possível salvar a previsão. Tente novamente.") };
    }
  } catch (error) {
    return message(error, "Confira a previsão da entrega e tente novamente.");
  }
  refreshOrders(id);
  return { success: estimate ? "Previsão salva. O cliente já pode vê-la no pedido." : "Previsão retirada. A entrega ficou a combinar." };
}
export async function createEstablishment(_previous: ActionState, form: FormData): Promise<ActionState> {
  await requireProfile("admin");
  let id: string;
  try {
    const values = establishmentData(form);
    const accessEmail = email(form);
    const accessPassword = password(form);
    const admin = createAdminClient();
    const { data: establishment, error: insertError, status: insertStatus } = await admin.from("establishments")
      .insert({ ...values, access_email: accessEmail, active: false }).select("id").single();
    if (insertError || !establishment) {
      console.error({ operation: 'create_establishment.insert', code: insertError?.code || 'missing_result', status: insertStatus });
      return { error: establishmentCreationError(insertError, insertStatus) };
    }
    id = establishment.id;
    const { data: account, error: accountError } = await admin.auth.admin.createUser({
      email: accessEmail, password: accessPassword, email_confirm: true,
      user_metadata: { full_name: values.contact_name || values.name },
    });
    if (accountError || !account.user) {
      // Roll back only a brand-new, incomplete registration; no historical data exists.
      const { error: cleanupError } = await admin.from("establishments").delete().eq("id", id).eq("active", false);
      if (cleanupError) {
        refreshEstablishments(id);
        return { error: "Não foi possível criar o acesso. Um cadastro inativo foi preservado: localize-o na lista e use Criar acesso para concluir." };
      }
      return { error: accountError?.code === "email_exists" || accountError?.code === "email_address_not_authorized" || accountError?.code === "user_already_exists" ? "Não foi possível criar o acesso com este e-mail. Verifique se ele já está em uso." : "Não foi possível criar o acesso. Confira o e-mail e os requisitos de senha do Supabase." };
    }
    const { error: profileError } = await admin.from("profiles").insert({
      id: account.user.id, full_name: values.contact_name || values.name, role: "establishment", establishment_id: id,
    });
    if (profileError) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(account.user.id);
      if (cleanupError) {
        refreshEstablishments(id);
        return { error: "Não foi possível concluir nem remover a conta de acesso. O cadastro permaneceu inativo. Peça ao responsável técnico para conferir Supabase > Authentication > Users e remover somente a conta recém-criada que esteja sem perfil antes de tentar novamente." };
      }
      const { error: recordCleanupError } = await admin.from("establishments").delete().eq("id", id).eq("active", false);
      refreshEstablishments(id);
      return { error: recordCleanupError ? "Não foi possível vincular o acesso. O cadastro permaneceu inativo; localize-o e use Criar acesso para concluir." : "Não foi possível vincular o acesso. O cadastro incompleto foi desfeito. Tente novamente." };
    }
    const { error: activationError } = await admin.from("establishments").update({ active: form.get("active") === "on" }).eq("id", id);
    if (activationError) {
      refreshEstablishments(id);
      return { error: "Cadastro e acesso criados, mas o estabelecimento permaneceu inativo. Abra o cadastro e ative-o." };
    }
  } catch (error) {
    return message(error, "Não foi possível cadastrar o estabelecimento.");
  }
  refreshEstablishments(id);
  redirect(`/admin/estabelecimentos/${id}?created=1`);
}

export async function updateEstablishment(_previous: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireProfile("admin");
  let id: string;
  try {
    id = uuid(form.get("id"));
    const values = establishmentData(form);
    const { data, error } = await supabase.from("establishments").update(values).eq("id", id).select("id").single();
    if (error || !data) return { error: "Não foi possível salvar os dados do estabelecimento. Tente novamente." };
  } catch (error) {
    return message(error, "Confira os dados do estabelecimento.");
  }
  refreshEstablishments(id);
  return { success: "Dados do estabelecimento atualizados." };
}

export async function setEstablishmentActive(_previous: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireProfile("admin");
  let id: string;
  const active = form.get("active") === "true";
  try {
    id = uuid(form.get("id"));
    if (form.get("active") !== "true" && form.get("active") !== "false") return { error: "Situação inválida." };
    const { data, error } = await supabase.from("establishments").update({ active }).eq("id", id).select("id").single();
    if (error || !data) return { error: "Não foi possível alterar a situação. Tente novamente." };
  } catch (error) {
    return message(error, "Não foi possível alterar a situação.");
  }
  refreshEstablishments(id);
  return { success: active ? "Estabelecimento reativado." : "Estabelecimento desativado. O histórico foi preservado." };
}

export async function createEstablishmentAccess(_previous: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireProfile("admin");
  let id: string;
  try {
    id = uuid(form.get("id"));
    const accessEmail = email(form);
    const accessPassword = password(form);
    const { data: establishment, error } = await supabase.from("establishments").select("*").eq("id", id).single();
    if (error || !establishment) return { error: "Estabelecimento não encontrado." };
    const admin = createAdminClient();
    const { data: existing, error: lookupError } = await admin.from("profiles").select("id").eq("establishment_id", id).eq("role", "establishment").maybeSingle();
    if (lookupError) return { error: "Não foi possível verificar o acesso existente." };
    if (existing) return { error: "Este estabelecimento já possui acesso. Use os campos para alterar o e-mail ou a senha." };
    // Reserve the unique e-mail before creating an Auth identity. The row stays
    // inactive until its account and profile are both ready. The version check
    // prevents two administrators from provisioning the same row concurrently.
    const { data: reservation, error: reservationError } = await admin.from("establishments")
      .update({ access_email: accessEmail, active: false }).eq("id", id).eq("updated_at", establishment.updated_at).select("id").maybeSingle();
    if (reservationError) return { error: reservationError.code === "23505" ? "Este e-mail já está vinculado a outro estabelecimento." : "Não foi possível preparar o acesso. Tente novamente." };
    if (!reservation) return { error: "O cadastro foi alterado por outra pessoa. Atualize a página e tente novamente." };
    async function restoreReservation() {
      const { data: restored, error: restoreError } = await admin.from("establishments")
        .update({ access_email: establishment!.access_email, active: establishment!.active }).eq("id", id)
        .eq("access_email", accessEmail).eq("active", false).select("id").maybeSingle();
      return !restoreError && Boolean(restored);
    }
    const { data: account, error: accountError } = await admin.auth.admin.createUser({ email: accessEmail, password: accessPassword, email_confirm: true, user_metadata: { full_name: establishment.contact_name || establishment.name } });
    if (accountError || !account.user) {
      const restored = await restoreReservation();
      refreshEstablishments(id);
      return { error: restored ? "Não foi possível criar o acesso. Verifique se o e-mail já está em uso e se a senha atende aos requisitos do Supabase." : "Não foi possível criar o acesso nem restaurar o cadastro. O estabelecimento permaneceu inativo; confira seus dados antes de tentar novamente." };
    }
    const { error: profileError } = await admin.from("profiles").insert({ id: account.user.id, role: "establishment", establishment_id: id, full_name: establishment.contact_name || establishment.name });
    if (profileError) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(account.user.id);
      const restored = !cleanupError && await restoreReservation();
      refreshEstablishments(id);
      if (cleanupError) return { error: "Não foi possível concluir nem remover a conta de acesso. O estabelecimento permaneceu inativo. Peça ao responsável técnico para conferir Supabase > Authentication > Users e remover somente a conta recém-criada que esteja sem perfil antes de tentar novamente." };
      return { error: restored ? "Não foi possível vincular o acesso. O cadastro anterior foi mantido. Tente novamente." : "Não foi possível concluir o acesso e sua restauração. O estabelecimento permaneceu inativo; peça ao responsável técnico para revisar o acesso antes de tentar novamente." };
    }
    const { data: restoredStatus, error: statusError } = await admin.from("establishments").update({ active: establishment.active })
      .eq("id", id).eq("access_email", accessEmail).eq("active", false).select("id").maybeSingle();
    if (statusError || !restoredStatus) {
      refreshEstablishments(id);
      return { error: "O acesso foi criado, mas não foi possível restaurar a situação do estabelecimento. Confira o cadastro e reative-o, se necessário." };
    }
  } catch (error) {
    return message(error, "Não foi possível criar o acesso.");
  }
  refreshEstablishments(id);
  return { success: "Acesso criado. Entregue as credenciais ao responsável por um canal seguro." };
}

export async function updateAccessEmail(_previous: ActionState, form: FormData): Promise<ActionState> {
  await requireProfile("admin");
  let id: string;
  try {
    id = uuid(form.get("id"));
    const accessEmail = email(form);
    const admin = createAdminClient();
    const { data: duplicate, error: duplicateError } = await admin.from("establishments").select("id").eq("access_email", accessEmail).neq("id", id).maybeSingle();
    if (duplicateError) return { error: "Não foi possível verificar o e-mail de acesso. Tente novamente." };
    if (duplicate) return { error: "Este e-mail de acesso já está vinculado a outro estabelecimento." };
    const { data: profile, error: profileError } = await admin.from("profiles").select("id").eq("establishment_id", id).eq("role", "establishment").maybeSingle();
    if (profileError || !profile) return { error: "O estabelecimento ainda não possui acesso. Crie-o primeiro." };
    const { data: original, error: originalError } = await admin.auth.admin.getUserById(profile.id);
    if (originalError || !original.user?.email) return { error: "Não foi possível verificar a conta de acesso. Tente novamente." };
    const { error: authError } = await admin.auth.admin.updateUserById(profile.id, { email: accessEmail, email_confirm: true });
    if (authError) return { error: "Não foi possível alterar o e-mail. Verifique se ele já está em uso." };
    const { data: updated, error: updateError } = await admin.from("establishments").update({ access_email: accessEmail }).eq("id", id).select("id").single();
    if (updateError || !updated) {
      const { error: rollbackError } = await admin.auth.admin.updateUserById(profile.id, { email: original.user.email, email_confirm: true });
      if (rollbackError) {
        refreshEstablishments(id);
        return { error: "O acesso passou a usar o novo e-mail, mas o cadastro não foi atualizado. Salve novamente o novo e-mail para sincronizar." };
      }
      return { error: "Não foi possível salvar a alteração. O e-mail de acesso anterior foi mantido." };
    }
  } catch (error) {
    return message(error, "Não foi possível alterar o e-mail de acesso.");
  }
  refreshEstablishments(id);
  return { success: "E-mail de acesso atualizado. Use o novo e-mail no próximo login." };
}

export async function updateAccessPassword(_previous: ActionState, form: FormData): Promise<ActionState> {
  await requireProfile("admin");
  try {
    const id = uuid(form.get("id"));
    const accessPassword = password(form);
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from("profiles").select("id").eq("establishment_id", id).eq("role", "establishment").maybeSingle();
    if (profileError || !profile) return { error: "O estabelecimento ainda não possui acesso. Crie-o primeiro." };
    const { error } = await admin.auth.admin.updateUserById(profile.id, { password: accessPassword });
    if (error) return { error: "Não foi possível redefinir a senha. Confira os requisitos de senha do Supabase e tente novamente." };
  } catch (error) {
    return message(error, "Não foi possível redefinir a senha.");
  }
  return { success: "Senha redefinida. Entregue a nova senha ao responsável por um canal seguro." };
}
