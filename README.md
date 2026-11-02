# Pedidos de Queijo Fresco

Aplicação para estabelecimentos solicitarem queijo fresco e a família acompanhar a produção necessária por data de entrega. Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL/RLS e autenticação SSR com `@supabase/ssr`.

O produto custa **R$ 20,00 por unidade**. O PostgreSQL fixa o preço de cada pedido e calcula o total. Um pedido nasce confirmado e pode ser cancelado pelo administrador, mantendo o histórico. As datas de entrega são `DATE`; regras de data e apresentação usam `America/Sao_Paulo`.

## Endereço, previsão e resumo

Cada pedido guarda seu endereço de entrega, preenchido inicialmente pelo cadastro do cliente. A família informa a previsão com um período ou horário curto; o cliente consulta tudo em um resumo. Mudanças na data ou no local retiram a previsão anterior.

**Atualização de um sistema já instalado:** aplique somente a [nova migration de entrega](supabase/migrations/20261102000100_delivery_details.sql) antes do deploy. Não reaplique a migration inicial. Veja o [guia de implantação](docs/implantacao.md).
## Recursos

- Login por e-mail e senha e saída segura, com rotas protegidas por perfil.
- Cliente: pedido com quantidade e entrega, confirmação, histórico, detalhes e repetição com revisão dos dados.
- Administração: pedidos por dia, totais sem cancelados, filtros por período/estabelecimento, pedidos manuais, edição e cancelamento.
- Cadastro, edição, ativação/desativação de estabelecimentos e administração dos acessos.
- Dados reais no Supabase, sem dados demonstrativos ou armazenamento de senhas em tabelas próprias.
- Interface em português, responsiva e preparada para uso no celular.

## Executar localmente

Requisitos: Node.js **24 LTS**, npm e um projeto Supabase. Não é necessário instalar PostgreSQL localmente.

No PowerShell do Windows, se `npm` for bloqueado pela política de scripts, use `npm.cmd` nos comandos abaixo (por exemplo, `npm.cmd ci` e `npm.cmd run dev`). Não é preciso alterar a política do computador. As tarefas **dev** e **build** do VS Code já usam essa alternativa.

```powershell
npm ci
Copy-Item -LiteralPath .env.example -Destination .env.local
```

Preencha `.env.local` com as credenciais do projeto:

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL da API do projeto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública publishable; permite acesso limitado pelas políticas RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave `service_role`, exclusiva do servidor e do bootstrap administrativo. |

**Nunca coloque a chave `service_role` em uma variável `NEXT_PUBLIC_*`, no navegador ou no Git.** A senha do banco é outra credencial e não entra nessas variáveis.

Antes de usar o sistema, aplique a migration e desabilite novos cadastros públicos no Supabase, conforme o [guia de implantação](docs/implantacao.md). Em seguida:

```powershell
npm run admin:bootstrap
npm run dev
```

O bootstrap solicita nome, e-mail e senha em um terminal interativo. A senha permanece oculta e não é recebida por argumento nem gravada no ambiente. Ele usa a API administrativa do Supabase para criar a conta já confirmada e registra seu perfil. Se houver administrador, termina sem alterar contas. Se a criação do perfil falhar, tenta remover somente a conta recém-criada. Execute uma única instância, a partir de uma máquina confiável, após conferir o projeto de destino.

Acesse `http://localhost:3000`, entre com o administrador e abra **Estabelecimentos → Cadastrar estabelecimento**. Cadastre os dados e o acesso do primeiro cliente. Entre em outra janela privada para conferir o uso como estabelecimento. Não existe cadastro público nem aprovação manual de pedidos.

## Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento. |
| `npm run build` | Build de produção. |
| `npm start` | Executa o build localmente. |
| `npm run lint` | Verificação ESLint. |
| `npm run typecheck` | Verificação TypeScript. |
| `npm test` | Testes automatizados das regras de negócio. |
| `npm run admin:bootstrap` | Provisiona o primeiro administrador com `.env.local`. |

O build pode ser verificado sem credenciais. Login, consultas e gravações exigem um Supabase configurado; a ausência de configuração não habilita dados fictícios.

## Organização

- `src/app`: páginas, layouts e ações no servidor.
- `src/components`: componentes de interface reutilizáveis.
- `src/lib`: regras, validações, autorização e clientes Supabase.
- `supabase/migrations`: estrutura versionada, índices, permissões, funções e RLS.
- `supabase/tests/security.sql`: integração SQL de isolamento e regras de persistência.
- `scripts/bootstrap-admin.mjs`: provisionamento seguro do primeiro administrador.
- `tests`: verificações locais das regras de negócio.
- `.github/workflows/ci.yml`: lint, tipos, testes e build no GitHub Actions, sem segredos de produção.

Os pedidos são gravados por funções SQL que identificam o usuário da sessão. O cliente não escolhe autoria, preço ou estabelecimento de terceiros. A chave de servidor é usada nas operações administrativas de contas e seu provisionamento, após autorização administrativa no servidor, e no bootstrap. A desativação bloqueia as operações do cliente inclusive nas políticas/funções SQL. Não há exclusão permanente no fluxo normal.

## Publicação e validação

- [Implantação no Supabase, GitHub e Vercel](docs/implantacao.md)
- [Conexão oficial do Supabase no pgAdmin com SSL](docs/pgadmin.md)
- [Testes, 15 cenários obrigatórios e aceite](docs/validacao.md)

O código e as migrations preparam a integração real. A publicação e os testes contra um projeto remoto precisam das credenciais e do acesso às contas Supabase/GitHub/Vercel. Não considere o sistema publicado nem os cenários remotos aprovados antes de aplicar o banco, configurar Auth, provisionar os usuários e executar o roteiro de aceite no ambiente de destino.
