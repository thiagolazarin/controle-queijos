# Implantação

## Estado atual

Lint, TypeScript, os 7 testes unitários e o build de produção passaram. As 56 asserções SQL passaram em PostgreSQL 17 local isolado, com compatibilidade mínima para `auth.users`, `auth.uid()` e papéis do banco; esse teste não executa o serviço completo de autenticação Supabase.

O Supabase hospedado respondeu às consultas somente de leitura de Auth e das tabelas da aplicação. As tabelas já existem, mas ainda não há perfis de administrador nem de estabelecimento. O cadastro público está habilitado e precisa ser desativado. Login válido, pedido real e publicação ainda precisam ser verificados após criar o administrador.

As configurações restauradas estão no commit `038a791`, sincronizado com o GitHub. Não é necessário reinicializar o repositório nem refazer o commit do código para importar esse estado na Vercel. As novas alterações desta documentação podem ser commitadas quando desejar.

## 1. Criar o projeto Supabase

1. Entre em [supabase.com/dashboard](https://supabase.com/dashboard), crie uma organização/projeto e guarde a senha do banco em um gerenciador de senhas.
2. Aguarde a criação do projeto. No painel, obtenha a URL do projeto e a chave **publishable** em **Project Settings → API / API Keys**. Obtenha a chave **service_role** na seção de chaves legadas, exclusivamente para o servidor.
3. Em uma instalação nova, copie [`.env.example`](../.env.example) para `.env.local` na raiz e preencha os três valores. A instalação atual também aceita o arquivo `.env` existente; não o sobrescreva com o exemplo. O bootstrap lê `.env` e depois `.env.local`, dando prioridade ao último. Variáveis já exportadas no terminal têm prioridade sobre os arquivos. Nunca envie arquivos de ambiente com credenciais ao GitHub.

O banco usado pela aplicação é o PostgreSQL do próprio Supabase. O pgAdmin é somente uma ferramenta de administração desse banco; [veja a conexão](pgadmin.md).

## 2. Aplicar as migrations

As tabelas já foram encontradas no projeto hospedado atual. **Não execute novamente a migration inicial nesse banco.** As opções abaixo são para um projeto novo; para atualizações de um projeto existente, aplique somente migrations novas e pendentes, após conferir o histórico.

**Supabase CLI**, a partir da raiz do repositório:

```powershell
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

`SEU_PROJECT_REF` é o identificador do seu projeto, disponível na URL do painel. Os comandos pedem a autenticação e a senha do banco quando necessário; não passe senhas por argumentos nem as registre em arquivos versionados. Confira o destino apresentado antes de aceitar a aplicação da migration. A CLI mantém o histórico e aplica as migrations pendentes.

**SQL Editor do Supabase**: abra [a migration inicial](../supabase/migrations/20261101000000_initial_schema.sql), copie seu conteúdo completo para **SQL Editor**, confira o projeto e execute. A migration inclui uma transação e deve ser aplicada uma única vez em um banco novo. Se usar essa alternativa, registre a versão aplicada antes de adotar posteriormente a CLI, seguindo a documentação de [migration repair](https://supabase.com/docs/reference/cli/supabase-migration-repair); não reaplique uma migration que já criou as tabelas.

A migration cria `establishments`, `profiles` e `orders`, seus índices e restrições, habilita RLS e concede apenas as permissões necessárias. Também cria as funções de criar, editar e cancelar pedidos. Não há uma etapa separada para liberar as tabelas ao público. Não desabilite RLS nem acrescente políticas permissivas para contornar erros.

No SQL Editor, confira:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('establishments', 'profiles', 'orders');

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

As três tabelas devem retornar `rowsecurity = true`. Pedidos não aceitam escrita direta pelo papel `authenticated`: a aplicação chama as funções restritas que validam usuário, preço, datas e estabelecimento.

## 3. Configurar autenticação

A consulta atual identificou cadastro público habilitado. **Esta configuração precisa ser corrigida antes de liberar o uso.** Em **Authentication → Sign In / Providers**, mantenha e-mail/senha habilitado e desabilite **Allow new users to sign up**. Desabilite provedores externos e login anônimo se estiverem habilitados. Não disponibilize cadastro público. A configuração local em [`supabase/config.toml`](../supabase/config.toml) também desabilita cadastros; ela não altera automaticamente as opções de um projeto hospedado já criado.

Em **Authentication → URL Configuration**:

- Em desenvolvimento, use `http://localhost:3000` como **Site URL**.
- Em produção, troque pela URL HTTPS final da Vercel ou pelo domínio próprio.
- Cadastre apenas URLs de redirecionamento efetivamente necessárias e sob seu controle; use URLs exatas, incluindo o ambiente de homologação quando aplicável.

As contas são criadas pelo servidor com e-mail confirmado, após a verificação do administrador. Não dependem de envio de e-mail para o primeiro acesso. Para trocar a senha de um cliente, use a administração de acesso do estabelecimento e entregue a nova senha ao responsável por um canal privado. A aplicação não implementa cadastro nem recuperação pública por e-mail.

## 4. Provisionar o administrador e o primeiro cliente

A consulta atual encontrou zero administradores. Com o banco preparado e as variáveis preenchidas em `.env` ou `.env.local`, execute no PowerShell da raiz do projeto:

```powershell
npm.cmd run admin:bootstrap
```

Execute em terminal interativo. O comando carrega primeiro `.env` e depois `.env.local`, caso existam; `.env.local` prevalece para valores repetidos. Informe um e-mail válido, um nome e uma senha exclusiva de 12 a 128 caracteres. A entrada de senha fica oculta. O script não redefine uma conta existente e recusa provisionar outro administrador quando já existe um. Não execute instâncias simultâneas. Se já houver uma conta com esse e-mail sem perfil, resolva essa conta no painel Auth antes de repetir; o script não promove contas arbitrárias.

Se houver falha ao inserir o perfil, o script tenta remover a conta recém-criada. Se o próprio rollback falhar, confira **Authentication → Users** e `public.profiles` no projeto correto. Remova somente a conta recém-criada que esteja sem perfil antes de tentar de novo; uma falha de conexão pode ocultar uma gravação concluída. Nenhuma senha é salva em tabela de aplicação.

Inicie `npm run dev`, entre no sistema e abra **Estabelecimentos → Cadastrar estabelecimento**. Preencha nome, responsável, telefone, endereço, e-mail de acesso e senha. Guarde a senha fora do código e entregue-a ao responsável. A desativação do estabelecimento preserva seus pedidos e impede novas operações; a reativação devolve o acesso.

O bootstrap não é uma rota da aplicação e não concede permissões a usuários anônimos. Proteja a chave de servidor: ela ignora RLS. Se vazar, revogue/rotacione a chave no Supabase e atualize o ambiente correspondente.

## 5. Validar antes de publicar

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

As verificações locais acima já passaram. O [relatório de validação](validacao.md) registra também o resultado das 56 asserções SQL locais. Execute os 15 cenários de aceite em homologação após provisionar as contas: o build e os testes locais não comprovam login e persistência pela API do Supabase hospedado.

## 6. Enviar ao GitHub

O repositório atual já está sincronizado com o GitHub no commit `038a791`. Para ele, pule a inicialização abaixo. As mudanças desta documentação podem ser revisadas e commitadas quando desejar. Somente para uma instalação sem repositório, crie um no GitHub e execute:

```powershell
git init
git add .
git diff --cached --name-only
git commit -m "Implementa sistema de pedidos de queijo fresco"
git branch -M main
git remote add origin URL_DO_SEU_REPOSITORIO
git push -u origin main
```

Um arquivo de ambiente com credenciais já esteve versionado. A remoção do índice preserva o arquivo local, mas **não apaga o histórico do Git**. Antes de publicar, rotacione as credenciais privilegiadas anteriormente versionadas e atualize os ambientes local e Vercel. Não basta excluir o arquivo do último commit. Antes de novos commits, confira que arquivos de ambiente com credenciais, chaves, senhas, `.next` e `node_modules` não estão entre os arquivos preparados. Se o repositório já existir, mantenha seu histórico e remote. O workflow [CI](../.github/workflows/ci.yml) executa instalação reproduzível, lint, tipos, testes e build no Node.js 24. O workflow não recebe credenciais de produção.

## 7. Publicar na Vercel

1. Entre na Vercel, escolha **Add New → Project**, conecte o GitHub e importe o repositório.
2. Mantenha o framework **Next.js**, a raiz do projeto e o build padrão `npm run build`. Selecione Node.js **24.x**.
3. Em **Settings → Environment Variables**, configure as três variáveis de [`.env.example`](../.env.example). Use as credenciais do projeto Supabase de produção somente no ambiente **Production**. Para **Preview**, use um projeto de homologação separado.
4. Marque a chave de servidor como sensível quando a opção estiver disponível. Seu nome deve continuar `SUPABASE_SERVICE_ROLE_KEY`; nunca acrescente `NEXT_PUBLIC_`.
5. Confira as migrations do projeto correto antes do deploy. No projeto atual, as tabelas existem: não reaplique a migration inicial. Desabilite o cadastro público e execute o bootstrap uma vez, em máquina confiável, com as credenciais atualizadas desse projeto.
6. Faça o deploy e ajuste a **Site URL** do Auth para o endereço HTTPS final. Mudanças em variáveis da Vercel exigem um novo deploy para valerem.
7. Confira login dos dois perfis, pedido real de teste, persistência, totais e isolamento pelo [roteiro de aceite](validacao.md).

Não configure senha de PostgreSQL, conexão pgAdmin ou token pessoal da CLI no frontend. O runtime usa a API Supabase via HTTPS; não abre conexões PostgreSQL por função serverless.

## Operação

Se uma criação de acesso falhar, confira se o estabelecimento ficou inativo e conclua pelo botão **Criar acesso** em seu cadastro. Se a mensagem informar falha ao remover uma conta incompleta, um responsável técnico deve conferir **Authentication → Users** e `public.profiles`: remova somente a conta recém-criada que esteja sem perfil. Uma falha de rede pode ocultar uma gravação concluída; contas vinculadas e registros históricos devem ser preservados.

Mantenha as migrations no Git e nunca edite uma migration já aplicada: crie a próxima versão. Antes de alterações de banco, confira backup/restauração disponíveis no plano Supabase e valide primeiro em homologação. Cancelamentos preservam os pedidos; não apague registros de pedidos, estabelecimentos ou perfis durante o uso normal.

Uma entrega só está publicada após verificar o deploy e o Supabase configurado. No estado atual, faltam: rotacionar credenciais privilegiadas anteriormente versionadas, desabilitar cadastro público, provisionar o primeiro administrador, configurar/importar o projeto na Vercel e executar o aceite com login e pedido real no endereço publicado. A existência das tabelas e o acesso somente de leitura ao Supabase já foram verificados.
