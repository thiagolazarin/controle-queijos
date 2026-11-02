# Conectar o pgAdmin ao Supabase

Use o banco PostgreSQL existente no Supabase. Não crie um segundo banco no pgAdmin. As credenciais de acesso PostgreSQL são diferentes do e-mail/senha dos usuários do sistema e da chave `service_role`.

Abra o projeto no Supabase e clique em **Connect**. Copie os parâmetros de **Direct connection** ou **Session pooler** exibidos para esse projeto. O painel é a fonte dos hosts, da região e das opções de conexão atuais.

| Campo no pgAdmin | Conexão direta | Pooler em modo Session |
| --- | --- | --- |
| Host name/address | `db.<project-ref>.supabase.co`, exatamente como no painel. | Host do **Session pooler**, copiado integralmente do painel. |
| Port | `5432`. | `5432`, conforme a seção Session do painel. |
| Maintenance database | `postgres`. | `postgres`. |
| Username | `postgres`. | `postgres.<project-ref>`, conforme o painel. |
| Password | Senha do banco definida na criação do projeto. | A mesma senha do banco. |
| SSL mode | `verify-full`. | `verify-full`. |
| Root certificate | Certificado CA indicado/disponibilizado pelo Supabase. | Certificado CA indicado para essa conexão. |

O host direto normalmente exige conectividade **IPv6**, salvo disponibilidade de uma opção IPv4 contratada. Em uma rede somente IPv4, use o **Session pooler**. Não invente um hostname de pooler: ele depende da região e do projeto. O modo **Transaction**, geralmente na porta `6543`, é voltado a conexões curtas e não é a escolha para a sessão administrativa do pgAdmin.

## Configuração

1. Instale uma versão atual do [pgAdmin](https://www.pgadmin.org/download/).
2. No projeto Supabase, localize a configuração SSL e obtenha o certificado CA oficial indicado pelo painel/documentação da conexão. Guarde o arquivo no computador, fora do repositório. A localização da opção pode aparecer em **Project Settings → Database → SSL Configuration**.
3. No pgAdmin, escolha **Register → Server**, dê um nome claro ao servidor, como `Queijos — homologação`, e preencha a aba **Connection** com os valores do painel.
4. Na aba **SSL** ou nos parâmetros de conexão, conforme a versão, escolha `verify-full` e selecione o arquivo CA em **Root certificate**. Esse modo valida a cadeia e o hostname. Use o hostname DNS do painel para preservar a validação.
5. Informe a senha do banco. Salve-a no pgAdmin apenas se o computador e o armazenamento de credenciais forem protegidos. Conecte-se e abra **Databases → postgres → Schemas → public → Tables**.

Após as migrations, devem existir `establishments`, `profiles` e `orders`. A tabela `auth.users` pertence ao Supabase Auth: não insira senhas nem usuários nela manualmente para provisionar contas da aplicação.

Se a conexão falhar, confira se o projeto está pausado, se o host corresponde ao modo escolhido, a capacidade IPv6 da rede, senha, regras de rede e o certificado oficial correto. Não resolva falhas SSL desabilitando a validação. A senha pode ser redefinida no painel Supabase, atualizando em seguida os clientes administrativos que a utilizam.

O usuário `postgres` tem privilégios elevados. Consultas feitas com ele no pgAdmin não comprovam o isolamento RLS visto pelos clientes. Use o [teste de RLS com JWTs simulados](validacao.md) e o roteiro com contas distintas.

Referências oficiais: [conexão ao Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres), [pgAdmin](https://supabase.com/docs/guides/database/pgadmin) e [SSL](https://supabase.com/docs/guides/platform/ssl-enforcement).
