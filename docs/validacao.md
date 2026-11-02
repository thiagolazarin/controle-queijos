# Validação e aceite

## Verificações locais

Na raiz, com as dependências instaladas:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

O GitHub Actions executa os mesmos comandos com `npm ci` no Node.js 24. Eles não precisam de chaves Supabase e não substituem os testes de integração em um banco configurado.

## Resultado das verificações executadas

- **Aprovados:** lint, TypeScript, build de produção e os **7 testes unitários**.
- **Aprovadas:** **56 asserções SQL**, executadas em PostgreSQL 17 local isolado, com resultado `PASS`. O ambiente reproduziu `auth.users`, `auth.uid()` e os papéis do banco necessários para exercitar a migration e as políticas.
- Esse ambiente SQL usa uma camada mínima de compatibilidade de autenticação. Ele não executa GoTrue/Supabase Auth nem os demais serviços completos do Supabase; portanto, não comprova login por senha, cookies SSR ou chamadas reais da aplicação à API hospedada.
## Integração SQL e RLS

Use **somente um projeto separado de homologação**, com a migration já aplicada e sem dados reais. O arquivo [`supabase/tests/security.sql`](../supabase/tests/security.sql) usa privilégios administrativos para preparar suas contas de teste e muda para o papel `authenticated` para exercer as políticas e funções. Uma conexão `postgres` sem essa mudança de papel ignora RLS e não é suficiente para testar isolamento.

Para executar com `psql`, copie host, porta, usuário e certificado da seção **Session pooler** do painel Supabase. Configure os parâmetros não secretos no PowerShell; substitua os textos de exemplo pelos valores oficiais do seu projeto de homologação:

```powershell
$env:PGHOST = 'HOST_SESSION_COPIADO_DO_PAINEL'
$env:PGPORT = '5432'
$env:PGDATABASE = 'postgres'
$env:PGUSER = 'postgres.SEU_PROJECT_REF'
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = 'C:/caminho/para/certificado-ca.crt'
psql --password --set ON_ERROR_STOP=1 --file supabase/tests/security.sql
```

O `psql` solicita a senha do banco sem mostrá-la; não a coloque na linha de comando, no arquivo ou em capturas de tela. Não use as credenciais de produção neste roteiro. O teste contém metacomandos `psql` e termina em `ROLLBACK`; execute o arquivo completo com essa ferramenta, após conferir o destino. No Windows, se `psql` não estiver no PATH, use o executável da pasta `bin` da instalação PostgreSQL (por exemplo, `& 'C:/Program Files/PostgreSQL/17/bin/psql.exe'`, seguido dos mesmos argumentos).

Falha de permissão esperada deve ser capturada como uma asserção pelo script; erro não tratado representa falha do teste. Não marque como aprovado apenas porque a execução começou. O script não valida a interface nem a autenticação por senha.

## Quinze cenários obrigatórios

Prepare um administrador e dois estabelecimentos ativos, A e B, cada um com e-mail próprio. Use sessões privadas separadas para não misturar cookies. Escolha hoje ou uma data futura em `America/Sao_Paulo`. Execute a tabela em um ambiente de homologação e registre a evidência/resultado.

| # | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | Entrar com o administrador. | Redireciona para `/admin`; dados e ações administrativos disponíveis. |
| 2 | Criar o estabelecimento A com seus dados e credenciais. | Aparece na listagem; há usuário Auth e perfil vinculado ao estabelecimento correto. |
| 3 | Sair e entrar como A. | Redireciona para `/pedidos`; não apresenta funções administrativas. |
| 4 | Como A, pedir 10 queijos para uma data válida. | Mensagem de sucesso com número; botão não permite envio duplicado enquanto processa. |
| 5 | Atualizar a página e abrir o pedido pelo histórico. | O pedido persiste no Supabase, vinculado a A, com autoria e criação registradas. |
| 6 | Conferir o pedido de 10 queijos no banco e na interface. | `quantity = 10`, `unit_price = 20.00` e `total_price = 200.00`; exibição R$ 200,00. |
| 7 | Entrar como administrador e abrir a data da entrega. | O pedido de A aparece no painel. |
| 8 | Criar para B um segundo pedido de 5 na mesma data. | Total do dia: 15 queijos e R$ 300,00, considerando apenas esses dois pedidos. |
| 9 | Como administrador, registrar manualmente 3 queijos para A. | Aparece no painel e no histórico de A; `created_by` identifica o administrador. |
| 10 | Editar quantidade/data de um pedido e cancelar outro. | Alteração persiste; cancelamento registra autor e horário sem mudar criação. |
| 11 | Reabrir a data do pedido cancelado. | A quantidade e o valor desse pedido não compõem o total do dia. |
| 12 | Como A, tentar consultar o UUID de um pedido de B e consultar pedidos pela API com o JWT de A. | A página não revela o pedido; a API/RLS não retorna linhas de B. A função de criação rejeita estabelecimento B. |
| 13 | Como A, acessar `/admin` e subrotas/ações diretamente. | Sem acesso nem alterações; servidor exige administrador, mesmo sem usar a navegação. |
| 14 | Desativar A e tentar um pedido com sua sessão já aberta. | A criação falha inclusive por chamada direta à função SQL; o histórico permanece armazenado. |
| 15 | Reativar A e consultar o pedido cancelado. | Histórico e detalhes continuam acessíveis, com indicação Cancelado e dados originais preservados. |

Verifique também quantidade zero/negativa/fracionária, data passada, dia inválido, repetição com revisão antes de confirmar, filtros por período/estabelecimento, troca de senha, logout, sessão expirada e uso em tela de 360 px. Uma senha antiga deve falhar em um novo login depois da troca. Supabase pode manter tokens já emitidos até sua expiração; a desativação no banco deve bloquear imediatamente as operações do estabelecimento.

Tentativas de enviar `unit_price`, `created_by` ou `total_price` arbitrários por escrita direta não podem alterar os valores. O total é uma coluna calculada; a criação aceita apenas os dados previstos pela função. Um usuário comum também não pode promover o próprio perfil. Estes pontos são exercitados pelo teste de integração SQL.

## Estado de validação remota

Uma consulta somente de leitura ao Supabase hospedado recebeu HTTP 200 nos serviços Auth e nas tabelas da aplicação. Foram encontrados **0 perfis administrativos** e **0 perfis de estabelecimento**. O cadastro público de usuários ainda estava habilitado e deve ser desativado antes de liberar o sistema.

Essas consultas confirmam conectividade e existência das tabelas; não substituem o aceite com contas reais. **Login válido, criação de acesso, pedido real e publicação na Vercel continuam pendentes.** Primeiro execute o bootstrap administrativo, conforme o [guia de implantação](implantacao.md), e depois realize os quinze cenários com contas próprias de homologação.

Os testes SQL foram aprovados no banco local isolado, sem alterações de dados no projeto remoto. Não registre senhas, tokens, chaves ou dados pessoais nas evidências de teste.
