# FORMA — Contratos da API local

Este documento define os contratos da API local do FORMA (Express + PostgreSQL).
Implementação atual: **bloco de conta** (autenticação, perfil, endereços e
listas). Os demais módulos estão especificados para as próximas etapas e **não
estão implementados**. Nada aqui roda em hospedagem externa: a API, o banco e o
front executam localmente na máquina do aluno.

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
- Senhas com **scrypt** (salt aleatório por usuário); nunca em texto puro (RNF06).
- Sem token: `401 sessao_ausente`. Token inválido/expirado: `401 sessao_invalida`.
- O front guarda o token em `localStorage` (`forma:apiToken`) — função do
  `src/services/api.js`. Autenticação de produção exigiria cookies `HttpOnly`
  e HTTPS; aqui o escopo é local e acadêmico.

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
  "user": { "id": "ecae70e5-...", "name": "Maria Silva", "email": "maria@exemplo.com", "promo": true, "createdAt": "..." }
}
```

Erros: `409 email_ja_cadastrado`; `400 validacao`.

### POST /auth/entrar — login (RF03)

Corpo: `email`, `password`. `200 OK` com `token`, `expiresAt`, `user`.
Erros: `401 credenciais_invalidas` (mensagem única para e-mail inexistente ou senha errada).

### POST /auth/sair — logout (RF03)

Exige sessão. Encerra a sessão atual no banco. `204 No Content`.

### GET /auth/eu — usuário autenticado (RF04)

Exige sessão. `200 OK`: `{ "user": { ... } }` (mesma forma pública do registro).

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

- Papel `admin` em `users` (ou tabela `admin_users`), rotas `PUT/POST /admin/*`
  para produtos, preços, tamanhos e promoções, com controle de acesso (RNF08).
- A prévia visual pública em `/administracao` continua sendo demonstração até
  este bloco existir.

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
├── db/migrations/             # SQLs + executor (run.js)
├── middleware/                # cors, auth (Bearer), erros padronizados
├── modules/health/            # GET /api/health
├── modules/auth/              # schemas, service, routes de autenticação
├── modules/conta/             # enderecos.* e listas.* (schemas, service)
└── utils/                     # httpError, validate, password, token, money, units
```

Convenção por módulo: `*.schemas.js` valida e normaliza a entrada (lança
`HttpError 400` com `fields`); `*.service.js` contém regras e acesso ao banco
(linhas mapeadas para camelCase); `*.routes.js` só liga rota → schema → service.

Front: `src/services/api.js` é o único ponto de acesso HTTP (token automático,
`ApiError` com `code`/`fields`). Nenhuma tela consome a API ainda — a troca do
localStorage pela API acontece em etapas próprias, preservando o front aprovado.
