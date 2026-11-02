type EstablishmentError = { code?: string } | null;

/** Translate only public error codes/statuses; never return remote diagnostic text. */
export function establishmentCreationError(error: EstablishmentError, status?: number): string {
  const code = error?.code;
  if (code === '23505') return 'Este e-mail de acesso já está em uso.';
  if (code === 'PGRST204' || code === '42703') {
    return 'A estrutura do cadastro de estabelecimentos está incompatível com esta versão. Peça ao responsável técnico para conferir as migrations pendentes e atualizar o cache da API do Supabase.';
  }
  if (code === '42P01' || code === 'PGRST205') {
    return 'A tabela de estabelecimentos não está disponível. Peça ao responsável técnico para conferir o projeto Supabase configurado e as migrations pendentes.';
  }
  if (code === '23502') {
    return 'O banco exige informações adicionais para este cadastro. Peça ao responsável técnico para conferir a estrutura da tabela de estabelecimentos e as migrations pendentes.';
  }
  if (code === '23514') {
    return 'Os dados não atendem às regras do cadastro no banco. Confira o nome e o e-mail. Se estiverem corretos, peça ao responsável técnico para revisar as regras do cadastro.';
  }
  if (code === '42501') {
    return 'O Supabase bloqueou o cadastro por falta de permissão. Peça ao responsável técnico para conferir a chave administrativa do servidor e as permissões do banco.';
  }
  if (status === 401 || code === 'PGRST301' || code === 'PGRST302' || code === 'PGRST303') {
    return 'A credencial administrativa do Supabase foi recusada. Peça ao responsável técnico para conferir SUPABASE_SERVICE_ROLE_KEY do mesmo projeto e reiniciar o servidor.';
  }
  if (status === 403) {
    return 'A credencial configurada não tem permissão administrativa. Peça ao responsável técnico para conferir a chave administrativa do Supabase e as permissões do projeto.';
  }
  if (status === 0) {
    return 'Não foi possível conectar ao Supabase. Confira a conexão e atualize a lista de estabelecimentos antes de tentar novamente.';
  }
  if (status === 429) return 'O Supabase recebeu muitas solicitações. Aguarde alguns instantes e atualize a lista antes de tentar novamente.';
  if (status !== undefined && status >= 500) {
    return 'O Supabase está temporariamente indisponível. Aguarde alguns instantes e atualize a lista de estabelecimentos antes de tentar novamente.';
  }
  return 'Não foi possível confirmar o cadastro do estabelecimento. Atualize a lista antes de tentar novamente.';
}