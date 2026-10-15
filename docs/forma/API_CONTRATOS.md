# FORMA — Contratos da API local

Este documento define os contratos da API local do FORMA (Express + PostgreSQL).
Implementação atual: **bloco de conta** (autenticação com sessão no servidor,
perfil, endereços e listas) e a **base de autorização por papel**
(cliente/administrador) usada pelo painel administrativo. Os demais módulos
estão especificados para as próximas etapas e **não estão implementados**. Nada
aqui roda em hospedagem externa: a API, o banco e o front executam localmente
na máquina do aluno.

## Como executar localmente

Pré-requisitos: Node.js 20+ e PostgreSQL 14+ instalados na máquina.

```bash
# 1. Criar o usuário e o banco local (uma única vez)
sudo -u postgres psql -c "CREATE USER forma WITH PASSWORD 'forma';"
sudo -u postgres psql -c "CREATE DATABASE forma OWNER forma;"

# 2. Configurar a API
cd server
cp .env.example .env   # ajuste se suas credenciais locais forem outras

# 3. Aplicar as migrações
npm run migrate        # ou, da raiz: npm run api:migrate

# 4. Subir a API (porta 3333)
npm run dev            # ou, da raiz: npm run api

# 5. Subir o front (outro terminal, na raiz do projeto)
cd .. && npm run dev   # http://localhost:5173
```

Conferência rápida: `GET http://localhost:3333/api/health` deve devolver
`{"status":"ok","database":{"status":"ok"},...}`. Com o PostgreSQL desligado, a
mesma rota responde `503` com `status: "degradado"` e o motivo (`ECONNREFUSED`
etc.).

O front lê a URL da API em `VITE_API_URL` (padrão `http://localhost:3333/api`).

## Convenções

| Tema | Padrão |
|---|---|
| URL base | `http://localhost:3333/api` |
| Corpo e resposta | JSON UTF-8 |
| Datas | ISO-8601 UTC (`2026-10-14T22:42:24.935Z`), campos `*At` |
| Identificadores | UUID v4, campo `id` |
| Dinheiro | **Centavos, inteiro** (`price_centavos: 4990` = R$ 49,90). Nunca ponto flutuante. Helpers em `server/src/utils/money.js` |
| Peso | **Gramas, inteiro ≥ 0** (`weight_g: 450`) |
| Dimensões | **Centímetros, inteiro ≥ 0** (`height_cm`, `width_cm`, `length_cm`) |
| Idioma | Rotas e mensagens em português; campos JSON em inglês, iguais aos modelos do front (`name`, `email`, `promo`...) |
| Erros | Envelope único, ver seção seguinte |

Códigos de erro são `snake_case` em português e estáveis; o front deve tratar o
código, não a mensagem.

## Autenticação

- Sessão por **token opaco**: `POST /auth/registrar` e `POST /auth/entrar`
  devolvem `token` e `expiresAt`.
- Requisições autenticadas enviam `Authorization: Bearer <token>`.
- O banco guarda apenas o SHA-256 do token (`sessions.token_hash`); validade
  padrão de 7 dias (`SESSION_TTL_DAYS`).
- Senhas com **scrypt** (salt aleatório por usuário), verificadas sempre no
  servidor; nunca em texto puro e nunca no navegador (RNF06).
- Sem token: `401 sessao_ausente`. Token inválido/expirado: `401 sessao_invalida`.
  Autenticado sem papel necessário: `403 acesso_negado`.
- O front guarda o token em `localStorage` (`forma:apiToken`) — função do
  `src/services/api.js`. A cada abertura o `AuthProvider` valida a sessão com
  `GET /auth/eu`: só existe usuário logado se o servidor confirmar o token.
  Autenticação de produção exigiria cookies `HttpOnly` e HTTPS; aqui o escopo
  é local e acadêmico.

### Papéis de acesso (cliente/administrador)

- `users.role` aceita `cliente` (padrão de **toda** conta criada pela API) ou
  `administrador`. O corpo de registro/perfil **nunca** define papel.
- `administrador` é concedido apenas pelo comando local
  [`npm run admin`](#comando-para-criar-administrador), executado na máquina do
  responsável.
- Autorização reutilizável no servidor: `requireAuth` (sessão) +
  `requireRole('administrador')` (`server/src/middleware/authorize.js`). O
  papel no front (`user.role`, `isAdmin`) apenas esconde rotas; a decisão de
  autorizar é sempre do back-end (RNF08).

### Transição do localStorage (14/10 → 15/10/2026)

- Até 14/10/2026 o front guardava usuários, sessão e dados de conta no
  navegador (`forma:users`, `forma:session`, `forma:account:*`, com PBKDF2).
  Essas chaves **permanecem no navegador, intactas**: o código novo não as lê,
  não as altera e não as apaga.
- **Nada foi migrado como dado confiável.** Os hashes PBKDF2 do navegador não
  podem ser verificados pelo servidor, e credenciais/privilégios criados no
  cliente não são fontes confiáveis (RNF06/RNF08). Contas da demonstração
  antiga precisam ser cadastradas novamente; endereços e listas antigos não
  migram.
- A única chave nova é `forma:apiToken` (token de sessão). Papel de
  administrador não existe fora do banco; o comando local é o único caminho.

## Comando para criar administrador

```bash
# na raiz do projeto (ou: cd server && npm run admin -- ...)
npm run api:admin -- --email admin@forma.local --nome "Administrador FORMA"
# senha solicitada no terminal com eco oculto (pedida duas vezes)

# conceder o papel a uma conta existente, preservando a senha
npm run api:admin -- --email conta@forma.local --promover

# uso não interativo (scripts): senha por variável de ambiente
ADMIN_PASSWORD='...' npm run api:admin -- --email admin@forma.local --nome "Admin"
```

- A senha **nunca fica no código**; é digitada no terminal ou lida de
  `ADMIN_PASSWORD`. Validações: e-mail válido e senha com pelo menos 6
  caracteres; e-mail duplicado sem `--promover` é recusado.
- O hash é gerado pelo mesmo `scrypt` da API e gravado com `role =
  'administrador'`. Nenhuma rota HTTP cria ou altera papéis.

## Formato de erro

```json
{
  "error": {
    "code": "validacao",
    "message": "Verifique os campos informados.",
    "fields": { "email": "Informe um e-mail válido." }
  }
}
```

`fields` aparece somente em erros de validação. Códigos:

| HTTP | `code` | Quando ocorre |
|---|---|---|
| 400 | `validacao` | Campos inválidos (ver `fields`) |
| 400 | `json_invalido` | Corpo não é JSON válido |
| 400 | `dados_invalidos` | Violação de integridade do banco |
| 401 | `sessao_ausente` | Requisição autenticada sem `Authorization` |
| 401 | `sessao_invalida` | Token inexistente, expirado ou sessão encerrada |
| 401 | `credenciais_invalidas` | Login com e-mail ou senha incorretos |
| 403 | `acesso_negado` | Autenticado sem o papel necessário (área administrativa) |
| 404 | `nao_encontrado` | Recurso (endereço/lista) inexistente ou de outra conta |
| 404 | `rota_nao_encontrada` | Rota inexistente |
| 409 | `email_ja_cadastrado` | Cadastro com e-mail já existente (case-insensitive) |
| 409 | `nome_em_uso` | Lista com nome já usado pela mesma conta |
| 409 | `conflito` | Duplicidade genérica |
| 413 | `corpo_muito_grande` | Corpo acima de 100 kB |
| 500 | `erro_interno` | Falha inesperada (detalhes só no log do servidor) |
| 503 | `banco_indisponivel` | PostgreSQL inacessível (verificar `npm run api` e o banco) |

## Módulo conta — IMPLEMENTADO

Código em `server/src/modules/auth/` e `server/src/modules/conta/`.

### POST /auth/registrar — criar conta (RF01, RF02)

Corpo: `name` (1–120), `email`, `password` (≥ 6), `promo` (boolean, opcional).

```json
{ "name": "Maria Silva", "email": "maria@exemplo.com", "password": "abc123", "promo": true }
```

`201 Created` — já inicia a sessão:

```json
{
  "token": "l954L6bV...",
  "expiresAt": "2026-10-21T22:42:24.951Z",
  "user": { "id": "ecae70e5-...", "name": "Maria Silva", "email": "maria@exemplo.com", "promo": true, "role": "cliente", "createdAt": "..." }
}
```

`role` é sempre `cliente` no registro — mesmo que o corpo envie outro valor.
Erros: `409 email_ja_cadastrado`; `400 validacao`.

### POST /auth/entrar — login (RF03)

Corpo: `email`, `password`. `200 OK` com `token`, `expiresAt`, `user` (mesma
forma pública do registro, com `role`).
Erros: `401 credenciais_invalidas` (mensagem única para e-mail inexistente ou senha errada).

### POST /auth/sair — logout (RF03)

Exige sessão. Encerra a sessão atual no banco. `204 No Content`.

### GET /auth/eu — usuário autenticado (RF04)

Exige sessão. `200 OK`: `{ "user": { ... } }` (mesma forma pública do registro,
incluindo `role`). É a validação de sessão usada pelo `AuthProvider` a cada
abertura do app.

### PATCH /auth/eu — editar perfil (RF02, RF04)

Corpo: `name`, `promo`. Exige sessão. `200 OK`: `{ "user": { ... } }`. Erro: `400 validacao`.

### Endereços — RF05 (todos exigem sessão)

| Rota | Corpo / retorno | Status |
|---|---|---|
| `GET /conta/enderecos` | `{ "addresses": [...] }` | 200 |
| `POST /conta/enderecos` | campos abaixo | 201 `{ "address": {...} }` |
| `PUT /conta/enderecos/:id` | mesmos campos | 200 `{ "address": {...} }` |
| `DELETE /conta/enderecos/:id` | — | 204 |

Campos de endereço (mesmos nomes do front, `src/services/account.js`):
`label`, `recipient`, `street`, `number`, `complement` (opcional), `district`,
`city` — todos obrigatórios exceto `complement`; `state` (UF, 2 letras);
`cep` (8 dígitos, normalizado sem hífen). Resposta acrescenta `id`,
`createdAt`, `updatedAt`.

Erros: `400 validacao` (por campo), `404 nao_encontrado` (inexistente ou de
outra conta — a API nunca revela IDs de terceiros).

### Listas de compras — RF20 (todos exigem sessão)

| Rota | Corpo / retorno | Status |
|---|---|---|
| `GET /conta/listas` | `{ "lists": [...] }` | 200 |
| `POST /conta/listas` | `{ "name": "Presentes" }` | 201 `{ "list": {...} }` |
| `PUT /conta/listas/:id` | `{ "name": "Aniversário" }` | 200 `{ "list": {...} }` |
| `DELETE /conta/listas/:id` | — | 204 |

`name` é obrigatório, até 80 caracteres e **único por conta**
(case-insensitive → `409 nome_em_uso`). Cada lista retorna
`productIds: []` — os itens serão geridos pela migração do bloco de catálogo.

### GET /health — saúde do serviço

`200 {"status":"ok","database":{"status":"ok"},"timestamp":"..."}` ou
`503 {"status":"degradado","database":{"status":"indisponivel","motivo":"..."},...}`.

## Módulo administração — autorização mínima (IMPLEMENTADO)

Código em `server/src/modules/admin/`. Base de acesso do painel (RNF08); o
gerenciamento operacional chega com o bloco de catálogo.

| Rota | Retorno | Status |
|---|---|---|
| `GET /admin/visao-geral` | `{ "overview": { users, addresses, lists, products, orders } }` | 200 |
| `GET /admin/usuarios` | `{ "users": [ ...forma pública com role... ] }` | 200 |

Ambas exigem `requireAuth + requireRole('administrador')`: visitante →
`401 sessao_ausente`; cliente → `403 acesso_negado`. `products` e `orders`
valerão 0 até as migrações de catálogo/pedidos existirem.

## Módulos futuros — NÃO IMPLEMENTADOS

Especificados para as próximas etapas, seguindo as convenções acima. Os
detalhes finais serão fixados quando cada bloco for implementado.

### Catálogo (RF07–RF12) — migração planejada `0002_catalogo.sql`

- `products`: `id`, `name`, `slug`, `description`, `price_centavos` (inteiro),
  `promo_price_centavos` (inteiro, anulável), `pattern` (`lisa`/`estampada`),
  `color`, `weight_g`, `height_cm`, `width_cm`, `length_cm`, `active`,
  `created_at`, `updated_at`; `sizes` em tabela própria (`product_sizes`).
- `GET /produtos` com filtros `cor`, `estampa`, `tamanho`, `promocao` e
  ordenação `nome`, `preco`, `novidades` (RF08–RF12); `GET /produtos/:id`.
- `list_items` (lista ↔ produto, RF20) substitui o `productIds` provisório.

### Carrinho e pedidos (RF13–RF18) — migrações futuras

- `carts` + `cart_items` por conta; cupons (`coupons`, RF14); cálculo de frete
  via integração (RF15); `orders` + `order_items` com valores **em centavos**,
  consistência garantida em transação (RNF13); pagamento Mercado Pago (RF17) e
  e-mail de confirmação (RF18) como integrações autorizadas, ainda sem
  implementação.

### Administração (RF22–RF26) — migrações futuras

- A coluna `users.role` e a autorização reutilizável (`requireRole`) já existem
  (bloco de 15/10/2026); faltam as rotas `PUT/POST /admin/*` para produtos,
  preços, tamanhos e promoções, que devem reutilizar o mesmo par
  `requireAuth + requireRole('administrador')`.
- O painel visual em `/administracao` é a prévia aprovada, agora restrita a
  administradores no roteamento do front.

## Organização das migrações

Diretório `server/src/db/migrations/`, executadas por
`node src/db/migrations/run.js` (`up` aplica pendentes, `status` lista):

- Um arquivo SQL por migração, nomeado `NNNN_descricao.sql`
  (`0001_conta.sql`, `0002_catalogo.sql`, ...).
- Numeração sequencial, **não reutilizada**; migrações já aplicadas nunca são
  editadas — correções viram migrações novas.
- Cada migração roda em **transação** e é registrada em `schema_migrations`
  (`name`, `applied_at`), tornando a execução idempotente.
- Uma migração por bloco funcional (conta, catálogo, pedidos...), com os
  índices de unicidade junto das tabelas.

## Divisão dos módulos no código

```
server/src/
├── config.js                  # variáveis de ambiente (falha cedo sem DATABASE_URL)
├── app.js                     # fábrica do Express (rotas + middlewares)
├── index.js                   # escuta, encerramento gentil
├── db/pool.js                 # pool único PostgreSQL (pg)
├── db/migrations/             # SQLs + executor (run.js): 0001_conta, 0002_papeis
├── middleware/                # cors, auth (Bearer), authorize (requireRole), erros
├── modules/health/            # GET /api/health
├── modules/auth/              # schemas, service, routes de autenticação
├── modules/conta/             # enderecos.* e listas.* (schemas, service)
├── modules/admin/             # visão-geral e usuarios (exigem papel administrador)
├── scripts/criar-admin.js     # comando local de administrador (sem senha no código)
└── utils/                     # httpError, validate, password, token, money, units
```

Convenção por módulo: `*.schemas.js` valida e normaliza a entrada (lança
`HttpError 400` com `fields`); `*.service.js` contém regras e acesso ao banco
(linhas mapeadas para camelCase); `*.routes.js` só liga rota → schema → service.

Front: `src/services/api.js` é o único ponto de acesso HTTP (token automático,
`ApiError` com `code`/`fields`). As telas de autenticação, conta (dados
pessoais, endereços e listas) e a proteção de rotas consomem a API desde
15/10/2026; catálogo, carrinho, pedidos e o gerenciamento administrativo serão
conectados nos blocos próprios, preservando o visual aprovado.
