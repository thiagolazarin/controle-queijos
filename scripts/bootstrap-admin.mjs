import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { createClient } from "@supabase/supabase-js";

class BootstrapError extends Error {}

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new BootstrapError(`Preencha ${name} em .env.local antes de continuar.`);
  return value;
}

async function promptAdministrator() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new BootstrapError("Execute em um terminal interativo; a senha será solicitada sem aparecer na tela.");
  }

  let hidden = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!hidden) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  output.isTTY = true;
  output.columns = process.stdout.columns;
  const controller = new AbortController();
  const readline = createInterface({
    input: process.stdin,
    output,
    terminal: true,
    historySize: 0,
  });
  readline.on("SIGINT", () => controller.abort());

  async function question(label, secret = false) {
    if (secret) {
      process.stdout.write(label);
      hidden = true;
    }
    try {
      return await readline.question(secret ? "" : label, { signal: controller.signal });
    } finally {
      if (secret) {
        hidden = false;
        process.stdout.write("\n");
      }
    }
  }

  try {
    const email = (await question("E-mail do administrador: ")).trim().toLowerCase();
    const fullName = (await question("Nome do administrador: ")).trim();
    const password = await question("Senha (mínimo 12 caracteres; entrada oculta): ", true);
    const confirmation = await question("Repita a senha (entrada oculta): ", true);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw new BootstrapError("Informe um e-mail válido.");
    }
    if (!fullName || fullName.length > 150) {
      throw new BootstrapError("Informe um nome entre 1 e 150 caracteres.");
    }
    if (password.length < 12 || password.length > 128) {
      throw new BootstrapError("A senha deve ter entre 12 e 128 caracteres.");
    }
    if (password !== confirmation) throw new BootstrapError("As senhas não coincidem.");
    return { email, fullName, password };
  } finally {
    hidden = false;
    readline.close();
  }
}

async function bootstrap() {
  if (process.argv.length > 2) {
    throw new BootstrapError("Não passe credenciais por argumentos. Use apenas npm run admin:bootstrap.");
  }
  const url = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: admins, error: lookupError } = await client
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1);

  if (lookupError) {
    throw new BootstrapError("Não foi possível consultar os perfis. Confira o projeto, a chave de servidor e a aplicação da migration.");
  }
  if (admins.length) {
    process.stdout.write("Já existe um administrador. Nenhuma conta ou senha foi alterada.\n");
    return;
  }

  const { email, fullName, password } = await promptAdministrator();
  const { data, error: createError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !data.user) {
    throw new BootstrapError("Não foi possível criar a conta. Confira a conexão, a política de senha do Supabase e se esse e-mail já está cadastrado. Nenhuma conta existente foi alterada.");
  }

  let profileFailed = false;
  try {
    const { error } = await client.from("profiles").insert({
      id: data.user.id,
      full_name: fullName,
      role: "admin",
      establishment_id: null,
    });
    profileFailed = Boolean(error);
  } catch {
    profileFailed = true;
  }
  if (profileFailed) {
    let rollbackFailed = false;
    try {
      const { error } = await client.auth.admin.deleteUser(data.user.id);
      rollbackFailed = Boolean(error);
    } catch {
      rollbackFailed = true;
    }
    if (rollbackFailed) {
      throw new BootstrapError("O perfil não pôde ser confirmado e a remoção da nova conta falhou. Confira essa conta em Authentication > Users e o perfil correspondente no projeto correto. Remova somente a conta incompleta, caso esteja sem perfil, antes de tentar novamente.");
    }
    throw new BootstrapError("Não foi possível criar o perfil. A nova conta de autenticação foi removida. Confira a migration antes de tentar novamente.");
  }

  process.stdout.write("Administrador criado. Entre no sistema com o e-mail e a senha informados.\n");
}

bootstrap().catch((error) => {
  const message = error instanceof BootstrapError
    ? error.message
    : error instanceof Error && error.name === "AbortError"
      ? "Operação cancelada."
      : "Não foi possível concluir a operação. Confira a configuração e a conexão com o Supabase.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
