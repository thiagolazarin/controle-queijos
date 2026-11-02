import { test } from 'node:test';
import assert from 'node:assert/strict';
import { establishmentCreationError } from '../src/lib/establishment-errors.ts';

test('conflito de e-mail tem orientação específica', () => {
  assert.equal(establishmentCreationError({ code: '23505' }, 409), 'Este e-mail de acesso já está em uso.');
});

test('distingue estrutura incompatível, tabela ausente e campo obrigatório', () => {
  for (const code of ['PGRST204', '42703']) {
    assert.match(establishmentCreationError({ code }, 400), /estrutura.*incompatível/i);
  }
  for (const code of ['42P01', 'PGRST205']) {
    assert.match(establishmentCreationError({ code }, 404), /tabela.*não está disponível/i);
  }
  assert.match(establishmentCreationError({ code: '23502' }, 400), /informações adicionais/i);
});

test('violação de regra não é apresentada como falha de autenticação', () => {
  const result = establishmentCreationError({ code: '23514' }, 400);
  assert.match(result, /regras do cadastro/i);
  assert.match(result, /nome e o e-mail/i);
  assert.doesNotMatch(result, /credencial.*recusada/i);
});

test('identifica credencial recusada e permissão insuficiente separadamente', () => {
  assert.match(establishmentCreationError(null, 401), /credencial.*recusada/i);
  for (const code of ['PGRST301', 'PGRST302', 'PGRST303']) {
    assert.match(establishmentCreationError({ code }), /SUPABASE_SERVICE_ROLE_KEY/);
  }
  assert.match(establishmentCreationError(null, 403), /permissão administrativa/i);
  assert.match(establishmentCreationError({ code: '42501' }, 403), /falta de permissão/i);
});

test('falhas de rede, limite e indisponibilidade orientam conferir a lista antes de repetir', () => {
  assert.match(establishmentCreationError({ code: '' }, 0), /conectar ao Supabase/i);
  assert.match(establishmentCreationError(null, 429), /muitas solicitações/i);
  assert.match(establishmentCreationError(null, 503), /temporariamente indisponível/i);
  for (const status of [0, 429, 500, undefined]) {
    assert.match(establishmentCreationError(null, status), /atualize a lista/i);
  }
});

test('não acessa nem expõe mensagens privadas, detalhes ou sugestões do servidor', () => {
  const diagnostic = {
    code: 'UNRECOGNIZED_CODE',
    get message(): string { throw new Error('A mensagem privada não deve ser acessada.'); },
    get details(): string { throw new Error('Os detalhes privados não devem ser acessados.'); },
    get hint(): string { throw new Error('As sugestões privadas não devem ser acessadas.'); },
  };
  assert.equal(establishmentCreationError(diagnostic, 400), 'Não foi possível confirmar o cadastro do estabelecimento. Atualize a lista antes de tentar novamente.');
});