import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import ts from 'typescript';

// Execute the actual Server Action with isolated SDK/Next adapters, without a
// database, secrets, cookies or an Auth mutation against a hosted project.
const source = readFileSync(new URL('../src/lib/admin-actions.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

type FakeError = { code?: string; message?: string };
type Options = { ready?: boolean; rpcError?: FakeError; authError?: FakeError; blocked?: boolean };
type State = { error?: string; success?: string };
type UpdateEmail = (previous: State, form: FormData) => Promise<State>;

function harness(options: Options = {}) {
  const calls: string[] = [];
  const admin = {
    async rpc(name: string) {
      calls.push(`rpc:${name}`);
      return { data: options.ready ?? true, error: options.rpcError ?? null };
    },
    from(table: string) {
      calls.push(`read:${table}`);
      return {
        select() { return this; },
        eq() { return this; },
        neq() { return this; },
        async maybeSingle() {
          return { data: table === 'profiles' ? { id: 'fixture-user' } : null, error: null };
        },
        update() { throw new Error('A separate email table mutation is forbidden.'); },
      };
    },
    auth: { admin: {
      async updateUserById(id: string, values: { email: string; email_confirm: boolean }) {
        calls.push('auth:update');
        assert.equal(id, 'fixture-user');
        assert.equal(values.email, 'novo@example.test');
        assert.equal(values.email_confirm, true);
        return { error: options.authError ?? null };
      },
      async getUserById() { throw new Error('A compensating email rollback is forbidden.'); },
    } },
  };
  const exports: { updateAccessEmail?: UpdateEmail } = {};
  const adapters: Record<string, unknown> = {
    'next/cache': { revalidatePath: (path: string) => calls.push(`refresh:${path}`) },
    'next/navigation': { redirect: () => { throw new Error('Unexpected redirect.'); } },
    '@/lib/auth': { requireProfile: async (role: string) => {
      calls.push(`authorize:${role}`);
      if (options.blocked) throw new Error('Access denied fixture.');
    } },
    '@/lib/supabase/admin': { createAdminClient: () => { calls.push('admin:create'); return admin; } },
    '@/lib/domain': {},
    '@/lib/establishment-errors': {},
  };
  new Script(compiled, { filename: 'admin-actions.fixture.cjs' }).runInNewContext({
    exports,
    require: (name: string) => {
      if (!(name in adapters)) throw new Error(`Unexpected dependency: ${name}`);
      return adapters[name];
    },
  });
  assert.ok(exports.updateAccessEmail);
  const form = new FormData();
  form.set('id', '11111111-1111-4111-8111-111111111111');
  form.set('email', 'NOVO@example.test');
  return { calls, form, action: exports.updateAccessEmail };
}

test('troca de e-mail exige administrador antes de criar o cliente privilegiado', async () => {
  const { action, calls, form } = harness({ blocked: true });
  await assert.rejects(action({}, form), /Access denied fixture/);
  assert.deepEqual(calls, ['authorize:admin']);
});

test('sem sincronização instalada, a troca orienta atualizar o banco sem alterar Auth', async () => {
  for (const options of [{ ready: false }, { rpcError: { code: 'PGRST202', message: 'private fixture detail' } }]) {
    const { action, calls, form } = harness(options);
    const result = await action({}, form);
    assert.match(result.error ?? '', /atualização.*migrations pendentes/);
    assert.doesNotMatch(result.error ?? '', /private fixture detail/);
    assert.deepEqual(calls, ['authorize:admin', 'admin:create', 'rpc:access_email_sync_ready']);
  }
});

test('troca confirmada escreve somente no Auth e atualiza as páginas', async () => {
  const { action, calls, form } = harness();
  const result = await action({}, form);
  assert.match(result.success ?? '', /E-mail de acesso atualizado/);
  assert.deepEqual(calls.slice(0, 6), [
    'authorize:admin', 'admin:create', 'rpc:access_email_sync_ready',
    'read:establishments', 'read:profiles', 'auth:update',
  ]);
  assert.equal(calls.filter((call) => call === 'auth:update').length, 1);
  assert.ok(calls.includes('refresh:/admin/estabelecimentos'));
});

test('falha do Auth não tenta restaurar e-mail antigo nem exibe diagnóstico privado', async () => {
  const { action, calls, form } = harness({ authError: { code: 'unexpected_failure', message: 'private fixture detail' } });
  const result = await action({}, form);
  assert.match(result.error ?? '', /Não foi possível alterar o e-mail/);
  assert.doesNotMatch(result.error ?? '', /private fixture detail/);
  assert.equal(calls.filter((call) => call === 'auth:update').length, 1);
  assert.equal(calls.some((call) => call.startsWith('refresh:')), false);
});