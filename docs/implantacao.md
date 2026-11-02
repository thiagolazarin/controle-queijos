# Implantação

## Atualização: endereço, previsão e resumo

No projeto Supabase existente, aplique **somente a nova migration** [20261102000100_delivery_details.sql](../supabase/migrations/20261102000100_delivery_details.sql) pelo SQL Editor, uma única vez. Não reaplique a migration inicial. A nova migration precisa estar aplicada **antes de publicar esta versão na Vercel**.

Depois do SQL, publique o código atualizado. Na administração, preencha o endereço de entrega padrão no cadastro de cada cliente. O próximo pedido já virá com esse endereço, e o cliente poderá ajustar o local apenas para aquela entrega.

O endereço fica gravado no pedido. Alterar o cadastro do cliente não muda pedidos já registrados. Pedidos antigos ativos com entrega para hoje ou uma data futura recebem o endereço atual quando ele é conhecido e válido; históricos cancelados e endereços desconhecidos são preservados. Os registros antigos sem endereço exibem essa ausência e podem ser completados pela administração quando o pedido ainda estiver ativo.

A família informa a previsão no próprio painel de entregas ou nos detalhes do pedido: escolha um período, como **Pela manhã**, ou escreva algo como **entre 9h e 11h**, e clique em **Salvar previsão**. O cliente verá a informação no resumo e no histórico. **A combinar** retira a previsão após salvar. Alterar a data ou o endereço do pedido limpa a previsão anterior, para que a família possa informar uma nova. Uma tela antiga que tente salvar após uma alteração recebe um aviso para atualizar a página.

O resumo reúne quantidade, valor, data, endereço e previsão. Antes da confirmação ele permite conferir os dados; depois de salvar, os detalhes usam os valores persistidos no banco.

Verificações desta atualização: 19 testes locais, TypeScript e lint; a migration passou em PostgreSQL 17 isolado com 104 verificações SQL, 6 verificações de upgrade e 5 verificações adicionais entre transações. Esses testes não substituem o aceite no Supabase hospedado. A nova migration não foi aplicada remotamente por esta implementação.

Para uma instalação nova, siga as etapas abaixo e aplique as duas migrations em ordem.

## 1. Criar o projeto Supabase

1. Entre em [supabase.com/dashboard](https://supabase.com/dashboard), crie uma organização/projeto e guarde a senha do banco em um gerenciador de senhas.
2. Aguarde a criação do projeto. No painel, obtenha a URL do projeto e a chave **publishable** em **Project Settings → API / API Keys**. Obtenha a chave **service_role** na seção de chaves legadas, exclusivamente para o servidor.
3. Em uma instalação nova, copie [`.env.example`](../.env.example) para `.env.local` na raiz e preencha os três valores. A instalação atual também aceita o arquivo `.env` existente; não o sobrescreva com o exemplo. O bootstrap lê `.env` e depois `.env.local`, dando prioridade ao último. Variáveis já exportadas no terminal têm prioridade sobre os arquivos. Nunca envie arquivos de ambiente com credenciais ao GitHub.

O banco usado pela aplicação é o PostgreSQL do próprio Supabase. O pgAdmin é somente uma ferramenta de administração desse banco; [veja a conexão](pgadmin.md).

## 2. Aplicar as migrations

Em um projeto existente, **não execute novamente a migration inicial**. As opções abaixo são para um projeto novo; para atualizações de um projeto existente, aplique somente migrations novas e pendentes, após conferir o histórico.

**Supabase CLI**, a partir da raiz do repositório:

```powershell
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

`SEU_PROJECT_REF` é o identificador do seu projeto, disponível na URL do painel. Os comandos pedem a autenticação e a senha do banco quando necessário; não passe senhas por argumentos nem as registre em arquivos versionados. Confira o destino apresentado antes de aceitar a aplicação da migration. A CLI mantém o histórico e aplica as migrations pendentes.

**SQL Editor do Supabase**: abra [a migration inicial](../supabase/migrations/20261101000000_initial_schema.sql), copie seu conteúdo completo para **SQL Editor**, confira o projeto e execute. A migration inclui uma transação e deve ser aplicada uma única vez em um banco novo. Em uma instalação nova, execute depois a [migration de endereço e previsão](../supabase/migrations/20261102000100_delivery_details.sql), também uma única vez. Se usar essa alternativa, registre a versão aplicada antes de adotar posteriormente a CLI, seguindo a documentação de [migration repair](https://supabase.com/docs/reference/cli/supabase-migration-repair); não reaplique uma migration que já criou as tabelas.

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

Antes de liberar o uso, confira a configuração de autenticação do projeto. Em **Authentication → Sign In / Providers**, mantenha e-mail/senha habilitado e desabilite **Allow new users to sign up**. Desabilite provedores externos e login anônimo se estiverem habilitados. Não disponibilize cadastro público. A configuração local em [`supabase/config.toml`](../supabase/config.toml) também desabilita cadastros; ela não altera automaticamente as opções de um projeto hospedado já criado.

Em **Authentication → URL Configuration**:

- Em desenvolvimento, use `http://localhost:3000` como **Site URL**.
- Em produção, troque pela URL HTTPS final da Vercel ou pelo domínio próprio.
- Cadastre apenas URLs de redirecionamento efetivamente necessárias e sob seu controle; use URLs exatas, incluindo o ambiente de homologação quando aplicável.

As contas são criadas pelo servidor com e-mail confirmado, após a verificação do administrador. Não dependem de envio de e-mail para o primeiro acesso. Para trocar a senha de um cliente, use a administração de acesso do estabelecimento e entregue a nova senha ao responsável por um canal privado. A aplicação não implementa cadastro nem recuperação pública por e-mail.

## 4. Provisionar o administrador e o primeiro cliente

Se ainda não existir um administrador, com o banco preparado e as variáveis preenchidas em `.env` ou `.env.local`, execute no PowerShell da raiz do projeto:

```powershell
npm.cmd run admin:bootstrap
```

Execute em terminal interativo. O comando carrega primeiro `.env` e depois `.env.local`, caso existam; `.env.local` prevalece para valores repetidos. Informe um e-mail válido, um nome e uma senha exclusiva de 12 a 128 caracteres. A entrada de senha fica oculta. O script não redefine uma conta existente e recusa provisionar outro administrador quando já existe um. Não execute instâncias simultâneas. Se já houver uma conta com esse e-mail sem perfil, resolva essa conta no painel Auth antes de repetir; o script não promove contas arbitrárias.

Se houver falha ao inserir o perfil, o script tenta remover a conta recém-criada. Se o próprio rollback falhar, confira **Authentication → Users** e `public.profiles` no projeto correto. Remova somente a conta recém-criada que esteja sem perfil antes de tentar de novo; uma falha de conexão pode ocultar uma gravação concluída. Nenhuma senha é salva em tabela de aplicação.

Inicie `npm run dev`, entre no sistema e abra **Clientes → Cadastrar cliente**. Preencha nome, responsável, telefone, endereço, e-mail de acesso e senha. Guarde a senha fora do código e entregue-a ao responsável. A desativação do estabelecimento preserva seus pedidos e impede novas operações; a reativação devolve o acesso.

O bootstrap não é uma rota da aplicação e não concede permissões a usuários anônimos. Proteja a chave de servidor: ela ignora RLS. Se vazar, revogue/rotacione a chave no Supabase e atualize o ambiente correspondente.

## 5. Validar antes de publicar

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Execute as verificações locais acima. As suítes SQL `security.sql` e `delivery_details.sql`, em `supabase/tests`, verificam as permissões, os cálculos, os endereços e as previsões; veja o [relatório de validação](validacao.md). Execute os 15 cenários de aceite em homologação após provisionar as contas: o build e os testes locais não comprovam login e persistência pela API do Supabase hospedado.

## 6. Enviar ao GitHub

O repositório do projeto já está criado. Revise e envie as alterações ao GitHub para publicar a versão atualizada. Somente para uma instalação sem repositório, crie um no GitHub e execute:

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

Uma versão só está publicada após verificar o deploy e o Supabase configurado. Para esta atualização, aplique a nova migration antes do deploy e confira no site: criação com endereço, resumo salvo, previsão informada pela família e isolamento entre clientes.
