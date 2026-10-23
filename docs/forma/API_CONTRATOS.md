# FORMA — Contratos da API local

## Demonstração local explícita — 23/10/2026

**DEMONSTRAÇÃO — sem cobrança ou envio real.** O modo é opcional e desativado por
padrão. Exige `FORMA_DEMO_MODE=true`, `NODE_ENV=development/test`, API em IP
loopback (`FORMA_API_HOST`) e PostgreSQL local confirmado. Produção, host remoto,
overrides `PG*` e SMTP externo são recusados; a API valida o banco antes de abrir
a porta. Veja a [ativação no README](../../README.md#modo-de-demonstração-local-compra-completa-sem-credenciais-externas).

- `GET /api/health` acrescenta `demonstration: true|false`; não expõe credenciais.
- `POST /api/frete/cotacoes` mantém sessão/endereço/carrinho validados. Na demo,
  retorna `transactionMode: "demo"` e serviço `forma-demo`, com aviso explícito,
  `priceCentavos: 1000` e prazo fictício `deliveryDays: 3`, sem chamar Melhor Envio.
- `POST /api/checkout` mantém o contrato; o modo vem da cotação persistida,
  nunca do body. Retorna `order.transactionMode` (`demo` ou `gateway`) e
  `demoPaymentAvailable`. Cotação de outro modo é recusada com 400
  `modo_cotacao_incompativel`. Valores/status do cliente não são autoridade.
- `POST /api/demonstracao/pedidos/:id/pagar`: somente na demo, sessão obrigatória,
  pedido do dono, corpo **`{}`**. Não aceita status, valor nem dados de cartão.
  Retorna `{orderId, status, provider: "forma_demo", paymentId: "demo:…"}`.
  Status é o da tentativa (`aprovada` no fluxo normal). Reenvio/concorrência
  reutilizam a tentativa. Usa as reservas, cupom e outbox transacionais existentes.
- Sem sessão: 401; pedido alheio/inexistente: 404; body não vazio/ID inválido:
  400; pedido gateway, expirado ou não pendente: 409. Demo desligada: rota 404.
- Listagem/detalhe do histórico e consulta administrativa incluem
  `transactionMode`; o detalhe também informa `demoPaymentAvailable`.
  Desligar a demo preserva os registros e impede novos pagamentos demonstrativos.
- Mercado Pago não aceita pedidos demo; notificações MP não alteram tentativas
  `forma_demo`. Tentativas demo têm `payment_kind=demo`, sem preferência nem URL
  de checkout, e ficam associadas apenas a pedidos demo por restrição do banco.
- O e-mail traz o aviso no assunto/texto e `transactionMode` no payload.
  Processamento pela API na inicialização e a cada 60 segundos. Mock armazena
  prévia; SMTP demo somente por IP loopback, mesmo após desabilitar o modo.

Esse fluxo é uma demonstração funcional local e **não comprova homologação das
integrações externas**. As seções históricas abaixo descrevem o fluxo de gateway.

Atualização do catálogo em 16/10/2026: `GET /api/produtos` preserva
`{ products: [...] }` e acrescenta `filters.colors`, com todas as cores dos
produtos ativos, independentemente da combinação de filtros corrente.
Ordenações: `name_asc`, `price_asc`, `price_desc`, `newest`, `oldest`, com
desempate por UUID. A–Z normaliza acentos portugueses. Filtro de tamanho só
inclui variantes com estoque positivo, mas mantém a grade completa no retorno.
O detalhe com UUID inválido retorna 400; UUID inexistente/inativo retorna 404.
O seed opcional é `npm run api:seed`, sem nova migração ou tabela.

Este documento define os contratos da API local do FORMA (Express + PostgreSQL).
Implementação atual: bloco de conta, leitura do catálogo, resumo/cupom do
carrinho, cotação do Melhor Envio Sandbox, pedidos com reserva de estoque,
pagamento de teste por Checkout Pro ou cartão salvo, carteira tokenizada e outbox
com transporte SMTP ou prévias mock. SMTP de captura local validado; entrega externa não homologada. Nada roda em hospedagem externa: API, PostgreSQL e front
executam localmente.

## Como executar localmente

Pré-requisitos: Node.js 20.19+ ou 22.12+ e PostgreSQL 14+ instalados na máquina.

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
- As chaves novas são `forma:apiToken` (sessão) e `forma:cart` (IDs, tamanhos,
  quantidades, cupom e preço da última revisão aceita). Esse preço serve apenas
  para avisar alterações; o carrinho local não é fonte confiável de preço. A API
  consulta novamente produtos/cupom no banco. Papel de administrador não existe
  fora do banco; o comando local é o único caminho.

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

`fields` aparece somente em erros de validação. Principais códigos (lista não exaustiva):

| HTTP | `code` | Quando ocorre |
|---|---|---|
| 400 | `validacao` | Campos inválidos (ver `fields`) |
| 400 | `identificador_invalido` | UUID malformado nas rotas de conta |
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
| 409 | `favorito_duplicado` | Produto já está nos favoritos da conta |
| 409 | `produto_na_lista` | Produto já está na mesma lista da conta |
| 409 | `conflito` | Duplicidade genérica |
| 409 | `produto_alterado` / `estoque_alterado` | Versão ou revisão administrativa desatualizada |
| 409 | `pedido_nao_pendente` | Pedido não está aguardando pagamento |
| 409 | `pedido_expirado` | Reserva de estoque venceu antes de iniciar pagamento |
| 409 | `pedido_pendente` | Já existe um pedido pendente para o mesmo carrinho |
| 409 | `chave_checkout_reutilizada` | Chave idempotente enviada com conteúdo diferente |
| 400 | `cep_invalido` | CEP do endereço sem oito dígitos |
| 400 | `produto_indisponivel` | Produto inexistente ou inativo no carrinho |
| 400 | `cupom_invalido` | Cupom inexistente, inativo ou configurado incorretamente |
| 400 | `cotacao_expirada` | Cotação expirada ou divergente do endereço/carrinho |
| 400 | `frete_invalido` | Serviço não pertence à cotação selecionada |
| 400 | `pagamento_inconsistente` | ID/referência/valor/moeda do gateway não corresponde ao pedido |
| 400 | `status_pagamento_desconhecido` | Status externo não reconhecido |
| 401 | `webhook_assinatura_invalida` | Assinatura HMAC de notificação inválida |
| 413 | `corpo_muito_grande` | Corpo acima de 100 kB |
| 500 | `erro_interno` | Falha inesperada (detalhes só no log do servidor) |
| 503 | `banco_indisponivel` | PostgreSQL inacessível (verificar `npm run api` e o banco) |
| 503 | `frete_nao_configurado` | Token sandbox ainda não autorizado |
| 503 | `melhor_envio_indisponivel` | Timeout ou indisponibilidade do provedor |
| 503 | `mercado_pago_nao_configurado` | Access Token de teste não configurado |
| 503 | `mercado_pago_callback_nao_configurado` | URL HTTPS pública temporária do túnel não configurada |
| 503 | `webhook_nao_configurado` | Segredo de assinatura ausente |
| 503 | `email_mode_nao_suportado` | Somente o modo mock de e-mail é permitido |

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

Corpo: `name` (texto 1–120), `promo` (booleano). Exige sessão.
`200 OK`: `{ user: {...} }`. Erro: `400 validacao` com `fields`.
E-mail/senha não são aceitos nesse PATCH: use as operações protegidas abaixo.
IDs e papéis enviados no corpo não mudam a identidade/papel da sessão.

### PUT /auth/eu/email — alterar e-mail (RF04)

Corpo: `{ email, currentPassword }`. E-mail é texto válido de até 254 caracteres,
normalizado para minúsculas e sem espaços externos. Exige sessão e **senha atual**.
Resposta 200 `{ user: {...} }`; duplicidade case-insensitive → 409
`email_ja_cadastrado`; senha atual incorreta/ausente ou formato inválido → 400
`validacao` com erro por campo. Falhas não alteram conta nem revogam sessões.

### PUT /auth/eu/senha — alterar senha (RF04)

Corpo: `{ currentPassword, newPassword, confirmPassword }`. Exige sessão e senha
atual correta. Nova senha: 6–128 caracteres, diferente da atual e confirmação
idêntica; espaços da senha não são removidos. Senha atual: até 1024 caracteres.
Resposta 200 `{ user: {...} }`; validação/senha atual incorreta → 400 com `fields`.
Hashes scrypt e senhas nunca são retornados ao cliente.

As duas operações alteram **somente `req.user.id`**, sem aceitar usuário-alvo.
A alteração e revogação das outras sessões são atômicas; a sessão atual é
preservada. Login e atualização bloqueiam o mesmo usuário em transação para não
criar sessão com credencial antiga depois da troca. Atualizações revalidam a
sessão após aguardar o lock; requisição já autenticada mas revogada durante a
espera recebe 401. Nenhuma migração nova foi necessária.

A interface em `/minha-conta/dados` preserva nome/opt-in e oferece formulários
separados para e-mail/senha, erros por campo e limpeza das senhas após sucesso.
Não grava senhas no navegador. Não há recuperação de senha nem confirmação de
posse do novo endereço por e-mail: o transporte de e-mail permanece mock.

### Endereços — RF05 (todos exigem sessão)

| Rota | Corpo / retorno | Status |
|---|---|---|
| `GET /conta/enderecos` | `{ "addresses": [...] }` (principal primeiro) | 200 |
| `POST /conta/enderecos` | campos abaixo | 201 `{ "address": {...} }` |
| `PUT /conta/enderecos/:id` | mesmos campos | 200 `{ "address": {...} }` |
| `PUT /conta/enderecos/:id/principal` | — | 200 `{ "address": {...} }` |
| `DELETE /conta/enderecos/:id` | — | 204 |

Campos de endereço (mesmos nomes do front, `src/services/account.js`):
`label`, `recipient`, `street`, `number`, `complement` (opcional), `district`,
`city`, `state` (UF válida, 2 letras) e `cep` (8 dígitos, normalizado sem hífen)
— todos obrigatórios exceto `complement`, somente textos, até 500 caracteres por
campo. Resposta acrescenta `id`,
`principal`, `createdAt`, `updatedAt`.

**Endereço principal (seleção explícita)**: exatamente um por conta quando
houver endereços. O primeiro endereço cadastrado nasce principal; a troca é
sempre `PUT /enderecos/:id/principal` (transação: o anterior perde a marcação).
Criação, escolha e remoção de principal serializam operações pela conta para
impedir dois principais em requisições concorrentes. Removendo o principal, o mais antigo restante assume. Endereço de outra conta
→ `404 nao_encontrado`.

Erros: `400 validacao` (por campo), `404 nao_encontrado` (inexistente ou de
outra conta — a API nunca revela IDs de terceiros).

### Favoritos — RF19 (todos exigem sessão)

Produtos são referenciados pelo **id do contrato do catálogo** (UUID;
`docs/forma/API_CONTRATOS.md`, bloco de produtos). A tabela `favorites` não tem
chave estrangeira para produtos — a tabela `products` nasce com o catálogo.

| Rota | Corpo / retorno | Status |
|---|---|---|
| `GET /conta/favoritos` | `{ "productIds": [...] }` (ordem de inclusão) | 200 |
| `POST /conta/favoritos` | `{ "productId": "<uuid>" }` | 201 `{ "productIds": [...] }` |
| `DELETE /conta/favoritos/:productId` | — | 204 |

Erros: `409 favorito_duplicado`; `400 validacao` (id fora do formato);
`404 nao_encontrado` (remoção de favorito inexistente).

### Listas de compras — RF20 (todos exigem sessão)

| Rota | Corpo / retorno | Status |
|---|---|---|
| `GET /conta/listas` | `{ "lists": [...] }` (cada uma com `productIds`) | 200 |
| `GET /conta/listas/:id` | `{ "list": {...} }` | 200 |
| `POST /conta/listas` | `{ "name": "Presentes" }` | 201 `{ "list": {...} }` |
| `PUT /conta/listas/:id` | `{ "name": "Aniversário" }` | 200 `{ "list": {...} }` |
| `POST /conta/listas/:id/itens` | `{ "productId": "<uuid>" }` | 201 `{ "list": {...} }` |
| `DELETE /conta/listas/:id/itens/:productId` | — | 204 |
| `DELETE /conta/listas/:id` | — | 204 |

`name` é obrigatório, até 80 caracteres e **único por conta**
(case-insensitive → `409 nome_em_uso`). Cada lista retorna `productIds` reais
(tabela `list_items`, migração 0003). Erros: `409 produto_na_lista`
(produto repetido na mesma lista), `404 nao_encontrado` (lista/item inexistente
**ou de outra conta**).

### GET /health — saúde do serviço

`200 {"status":"ok","database":{"status":"ok"},"timestamp":"..."}` ou
`503 {"status":"degradado","database":{"status":"indisponivel","motivo":"..."},...}`.

## Administração — catálogo operacional (RF22–RF26)

Código em `server/src/modules/admin/`; interface em `/administracao/produtos`,
`/administracao/produtos/novo` e `/administracao/produtos/:id/editar`.
Todas as rotas abaixo exigem `requireAuth + requireRole('administrador')`
**antes de processar uploads**: anônimo → 401, cliente → 403. A sessão consulta
novamente o papel no banco. O formulário público de cadastro não concede papel.

| Rota | Resposta | Status |
|---|---|---|
| `GET /admin/visao-geral` | `{ overview: { users, addresses, lists, products, orders } }`, contagens reais | 200 |
| `GET /admin/usuarios` | `{ users: [...] }`, sem hashes/tokens | 200 |
| `GET /admin/produtos` | `{ products: [...] }`, inclui inativos | 200 |
| `GET /admin/produtos/:id` | `{ product: {...} }`, inclusive inativo | 200 |
| `POST /admin/produtos` | `{ product: {...} }` persistido | 201 |
| `PUT /admin/produtos/:id` | `{ product: {...} }` atualizado | 200 |

O DTO administrativo mantém os nomes do banco: `id`, `name`, `description`,
`color`, `is_printed`, `is_active`, `price_cents`, `promo_price_cents`, `weight_g`,
`length_cm`, `width_cm`, `height_cm`, `created_at`, `admin_version`,
`sizes: [{ id, size, stock, revision, is_active, reserved }]` e
`images: [{ id, url, main }]`. Não confundir `price_cents` administrativo com o
alias público `price_centavos`. Cada produto representa **uma cor**; diferentes
cores seguem como produtos separados, preservando a arquitetura atual.

POST/PUT aceitam JSON sem novos arquivos ou `multipart/form-data` com os mesmos
campos; no multipart, arrays são strings JSON. PUT envia o formulário completo:

- `name` obrigatório (1–255), `description` (até 10000), `color` obrigatório
  (1–50, normalizada para minúsculas); booleanos reais ou strings `true/false`.
- `price_cents` inteiro positivo; `promo_price_cents` vazio/null remove a promoção,
  ou inteiro positivo **menor** que o preço normal. Peso/dimensões inteiros
  positivos. Inteiros limitados a 2147483647; preço nunca é recebido como float.
- `sizes`: 1–4 tamanhos únicos P/M/G/GG, `stock` inteiro ≥ 0. No PUT, cada tamanho
  existente enviado inclui `expected_revision` recebido na consulta (inclusive
  ao reativar tamanho retirado). Novos tamanhos não precisam dessa revisão.
- PUT exige `version` igual ao `admin_version` consultado. A resposta devolve
  nova versão e revisões; use-as na próxima gravação.
- `retained_images`: IDs das imagens desta peça que devem permanecer (padrão `[]`).
  Imagens omitidas saem da galeria; o arquivo físico permanece disponível aos
  snapshots de pedidos. POST não aceita imagens de outros produtos.
- `images`: até cinco arquivos PNG/JPEG/WebP de até 5 MB cada. O total de imagens
  mantidas + novas também é limitado a cinco. MIME e assinatura inicial são
  conferidos; SVG novo é recusado. Nomes UUID gerados pelo servidor; sem URLs
  externas no formulário. `main_image`: ID mantido, `new:0`/`new:1` etc. para
  arquivo novo, ou vazio para escolher a primeira imagem. Sem imagens, a loja
  mostra o fallback identificado. Os SVGs demonstrativos existentes continuam.

Erros: 400 `validacao` com `fields` ou imagem inválida; 413 arquivo muito grande;
404 produto inexistente; 409 `produto_alterado` (outro editor), `estoque_alterado`
(checkout/liberação/edição mudou variante) ou `produto_com_reservas`. O formulário
mantém o rascunho no erro e permite reabrir os dados atuais antes de tentar salvar.

A migração `0009_admin_produtos.sql` acrescenta versão de produto, revisão e
status de variante, trigger de revisão e CHECK de estoque não negativo.
Transações bloqueiam produto com `FOR NO KEY UPDATE` e tamanhos em ordem estável,
compatíveis com as FKs do checkout. Não se apagam tamanhos: os omitidos ficam
inativos com ID/estoque preservados. Catálogo, filtro por tamanho e carrinho só
consideram tamanhos ativos; reativar reutiliza o ID original.

Estoque é **disponível**, já descontadas reservas. Revisões também mudam com
reserva/liberação, inclusive se o saldo voltar ao valor anterior. Enquanto houver
reservas pendentes, preços, promoção, cor/estampa, peso/dimensões, status do produto
e retirada de tamanho reservado ficam bloqueados; descrição/nome/imagens e saldo
atual disponível podem ser editados com revisão válida. O worker existente deve
liberar reservas expiradas. Pedidos concluídos preservam snapshots, totais,
preços e IDs de reserva; nenhuma edição reescreve compras anteriores.

O painel `/administracao/pedidos` consulta os últimos 200 pedidos, com filtro de
estado, itens, valores e identificação da demonstração. Exige administrador na
API e não oferece aprovação manual de pagamento.

## Catálogo e compra — IMPLEMENTAÇÃO PARCIAL

### Catálogo (RF07–RF12)

Migração `0004_criar_produtos.sql` define `products`, `product_sizes` e
`product_images`. `GET /produtos` e `GET /produtos/:id` são públicos e retornam
preços em centavos, peso em gramas e dimensões em centímetros. Os filtros
suportados são `color`, `is_printed`, `size`, `promo` e `sort`. O administrador
consulta e edita peças, tamanhos, estoque e preços pelas rotas protegidas
descritas na seção de administração.

### Carrinho, cupom, frete e checkout (RF13–RF16)

O navegador guarda IDs, tamanhos, quantidades, cupom, nome/imagens para exibição
durante indisponibilidade da API e `priceCentavos` da última
revisão aceita em `forma:cart`. Esse preço é referência visual para detectar
mudanças, nunca entrada de cálculo no servidor. Carrinhos antigos sem referência
adotam o primeiro preço atual consultado; não se inventa um histórico anterior.

| Rota | Acesso | Corpo / retorno |
|---|---|---|
| `POST /cart/resumo` | Público | `{ items: [{ productId, size, quantity }], couponCode? }`; revisão detalhada abaixo |
| `POST /cart/cupom` | Público | `{ items, code }`; exige estoque disponível, valida cupom ativo e calcula desconto/total no servidor |
| `POST /frete/cotacoes` | Sessão | `{ addressId, items }`; retorna `{ quoteId, services, expiresAt }` do Melhor Envio |
| `POST /checkout` | Sessão | `{ addressId, items, quoteId, serviceId, couponCode, checkoutKey }`; revalida/baixa estoque, snapshots e cria pedido `aguardando_pagamento` |
| `GET /conta/pedidos` | Sessão | `{ orders: [...] }` da própria conta |
| `GET /conta/pedidos/:id` | Sessão | Pedido, itens/endereço/frete em snapshot e status do pagamento |

O resumo retorna `cart`, `subtotalCentavos`, `discountCentavos`, `totalCentavos`,
`coupon` (ou null), `couponError`, `canCheckout` e `fingerprint` comercial dos
itens (preço/quantidade/peso/dimensões, mesmo critério das cotações). Cada linha
inclui `available`, `stock`, `issue`, imagem/preço atual e grade. Produto inativo,
removido ou tamanho retirado continua como linha corrigível; não derruba os
outros itens. Peça inexistente tem fallback identificado. Itens sem disponibilidade
não entram no total. Excesso de quantidade também bloqueia `canCheckout`.

Cupom que deixa de existir/ficar ativo tem erro explícito, desconto zero e bloqueia
avanço até remover/substituir; os itens continuam visíveis. Os endpoints validam
1–20 unidades e não aceitam booleanos/arrays como quantidade; até 50 linhas únicas.

O front limita alterações ao estoque consultado, mantém cupom ao alterar quantidade
e recalcula os totais. Perda de estoque/disponibilidade bloqueia avanço e mantém
remoção/correção. Alterações de preço exigem **Aceitar preços atualizados** no
carrinho. Recarga, retorno à aba e atualização manual consultam novamente a API.
Resumo em carregamento/erro não autoriza avançar nem conserva totais como válidos.
Antes de navegar ao checkout, cotar e confirmar, há nova consulta; mudanças
comerciais invalidam a cotação exibida. Respostas antigas não sobrescrevem outro
estado do carrinho. Falhas de rede preservam a opção de remover e tentar de novo.
Essas revisões não reservam estoque e não substituem locks/fingerprints e
validações finais do servidor em frete/checkout.

Frete e checkout exigem endereço pertencente à sessão. A cotação vale 20
minutos e guarda fingerprints do endereço e dos itens, inclusive preço,
quantidade, peso e dimensões. A confirmação revalida endereço, carrinho,
serviço e cupom; a mesma cotação é consumida na transação do pedido.

O payload externo usa `POST /api/v2/me/shipment/calculate` no host fixo
`https://sandbox.melhorenvio.com.br`. Envia CEP de origem
(`MELHOR_ENVIO_ORIGIN_CEP`) e destino, produtos, dimensões em cm, peso
convertido de gramas para kg, valor segurado em reais e quantidade. A resposta
prioriza `custom_price` e `custom_delivery_time`. Serviços ausentes ou com erro
não são substituídos por estimativas. OAuth e renovação de token ficam somente
no servidor; detalhes em `docs/forma/entregas/03-compra.md`.

Migração `0005_criar_cupons.sql` cria o cupom inicial `FORMA10`.
`0006_frete_checkout.sql` cria cotações, pedidos e itens. `0007_pagamento_estoque_idempotencia.sql`
adiciona snapshots completos, chave/fingerprint idempotentes, reserva de estoque,
tentativa única do Mercado Pago, eventos de webhook e registro único de resgate
de cupom por pedido. `0008_email_outbox.sql` cria a fila idempotente de prévias
transacionais em modo mock.

### Mercado Pago Checkout Pro (RF06, RF17)

| Rota | Acesso | Função |
|---|---|---|
| `POST /pagamentos/pedidos/:orderId/preferencia` | Sessão | Revalida preço/cupom/estoque; cria ou retorna a preferência de teste vinculada ao pedido |
| `GET /pagamentos/pedidos/:orderId` | Sessão | Estado da tentativa de pagamento da conta |
| `POST /pagamentos/pedidos/:orderId/verificar` | Sessão | Consulta `GET /v1/payments/{id}` no SDK e reconcilia sem confiar no browser |
| `POST /pagamentos/webhook` | Assinatura HMAC | Valida `x-signature`/`x-request-id`/`data.id`, consulta o pagamento no gateway e processa evento idempotente |
| `GET /pagamentos/retorno` | Público | Apenas redireciona ao checkout local; aceita `payment_id` ou alias `collection_id`; parâmetros de status não confirmam pagamento |

O modo de produção é recusado: requer `MERCADOPAGO_MODE=sandbox`,
`MERCADOPAGO_TEST_ACCESS_TOKEN`, segredo de webhook e URL HTTPS do túnel
temporário. O link retornado e exposto ao navegador deve ser
`sandbox_init_point` HTTPS em host sandbox. A confirmação exige ID do pagamento,
pedido (`external_reference`), valor total exato, `BRL` e `live_mode=false`
conferidos com a consulta oficial. A tentativa local também permanece vinculada
ao ID da preferência criada. O ID de pagamento deve ser o mesmo recebido no
webhook/retorno. A assinatura HMAC é
validada pelo SDK oficial; eventos repetidos, tentativa repetida, uso de cupom
e baixa de estoque são protegidos por chaves únicas e transações.

Checkout Pro permanece como alternativa. O caminho híbrido RF06 foi implementado
em 22/10/2026 com `Customer`/`CustomerCard`/`CardToken`/`Payment` do SDK 3.6.1
instalado e Secure Fields do SDK JS v2. Usa **Payments API**, compatível com
as tentativas e webhooks `payment` existentes; não migra pedidos para Orders API.
A [documentação oficial de migração](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/migrate-payments-to-orders)
confirma o contrato Payments `payer.type=customer`, `payer.id` e token;
os [Secure Fields oficiais](https://github.com/mercadopago/sdk-js/blob/main/docs/fields.md)
definem os campos isolados e a tokenização. O exemplo atual de Orders tem corpo
diferente e não foi copiado para o endpoint Payments.

A migração `0011` mantém clientes/cartões e distingue `checkout_pro`/`card_saved`.
A `0012_vinculo_pagamento_cartao.sql` acrescenta `expected_customer_id` e
`expected_card_id` às tentativas: só IDs seguros, para validar reconciliação após
timeout e após excluir um cartão da carteira. Tentativas `card_saved` sintéticas
anteriores sem vínculo permanecem conservadas e não são aprovadas por inferência.
Reservas duram 30 minutos; vencimento/recusa libera estoque; aprovação tardia ou
contestação exige revisão manual. Uma tentativa define um único método por pedido.

### Carteira autenticada e pagamento com cartão salvo

Base `/api`, todas as rotas abaixo exigem Bearer e filtram pela conta da sessão.
Não aceitam `userId`/`customerId`/ID remoto como substituto do proprietário.
As respostas de carteira têm `Cache-Control: no-store`.

| Método/rota | Entrada | Retorno/comportamento |
|---|---|---|
| `GET /conta/cartoes` | — | `{ cards, publicKey }`; key pública apenas com sandbox, credenciais, callback HTTPS e segredo válidos |
| `POST /conta/cartoes` | `{ token }`, somente token temporário do SDK | 201 `{ cards }`; cria/reutiliza cliente e anexa cartão no provedor |
| `DELETE /conta/cartoes/:id` | UUID local do cartão | 204; remove do provedor e da carteira local, preservando pedidos/tentativas |
| `POST /conta/cartoes/:id/pagar` | `{ orderId, token }` | Pagamento em uma parcela; total vem do pedido, método/cliente vêm da carteira |
| `POST /pagamentos/pedidos/:orderId/reconciliar` | `{}` | Consulta o ID de pagamento já vinculado, sem iniciar cobrança |

`cards[]`: `id` UUID local, `providerCardId`, `paymentMethodId`, `lastFourDigits`,
`cardholderName`, `expirationMonth`, `expirationYear`. Não retorna cliente de
outra conta, PAN, CVV, token nem resposta bruta do provedor.
`publicKey=null` informa que adicionar/pagar aguardam configuração;
consultar cartões locais continua possível. `MERCADOPAGO_PUBLIC_KEY` é pública;
Access Token permanece exclusivamente no servidor.

Inclusão envia número/validade/CVV diretamente aos iframes do Mercado Pago;
o token existe só em memória durante a requisição. Após criar cliente remoto,
o vínculo é commitado antes de anexar o cartão: uma falha do token não elimina
o cliente e não força sua recriação. Nenhuma falha do SDK é registrada com corpo
bruto. Payload com campos extras é recusado com 400; cartão/pedido alheio dá 404.

Antes de cobrar, a API revalida pedido/reserva/preço/cupom e consulta o token
no provedor, exigindo cartão esperado, `active` e `live_mode=false`. Um lock no
pedido e `UNIQUE(order_id)` impedem cobranças concorrentes. A tentativa guarda
somente IDs esperados e chave idempotente derivada do UUID da tentativa.
O retorno oficial precisa corresponder a pedido, total, BRL, ambiente e carteira.
A mesma `applyVerifiedPayment` atende resposta direta, webhook assinado e
reconciliação: consumo de estoque, cupom e confirmação de compra são os mesmos.

Reenvio após uma tentativa já criada retorna 409, sem repetir cobrança. Em timeout,
a tentativa fica `em_processamento`; aguarde o webhook ou consulte o ID seguro.
Se a resposta não trouxe ID e não chegou webhook, obtenha o ID no painel de teste
do provedor e use `POST /pagamentos/pedidos/:orderId/verificar` com `{ paymentId }`.
A validade de cliente/cartão esperados permite reconciliação segura sem token.
Recusa cancela/libera; aprovação depois de liberação vai para `revisao_manual`.

**Validação externa pendente:** rotas/SQL/ciclo testados com gateway injetado de
fixture. SDK JS e respostas reais Customer/Card/Payment ainda exigem credenciais
sandbox, incluindo confirmação dos identificadores no retorno e cenários de erro.
Não há homologação externa nem RF06 completo apenas por esses testes.

### Administração de demonstração e consulta de pedidos

`npm run api:admin:demo` cria `admin@forma.local` / `FormaDemo2026!`, usando scrypt,
sem rota de promoção/autenticação especial. Só permite `development`/`test` e
banco loopback. `ON CONFLICT DO NOTHING` preserva senha/nome/papel existentes.

`GET /admin/pedidos`, restrito a administrador, retorna `{ orders }`: últimos
200, mais recentes primeiro. Campos: `id`, `status`, `totalCentavos`, `createdAt`,
`customerName`, `paymentStatus`, `paymentKind`, `shippingService`, `items[]`
(`name`, `size`, `quantity`, `unitPriceCentavos`). Itens vêm do snapshot do pedido.
Não há endpoint administrativo para marcar pago ou modificar o histórico.

Configuração do token de teste, tunnel HTTPS e limitações: `docs/forma/entregas/04-pagamento.md`.

Os status locais são `criada`, `pendente`, `em_processamento`, `aprovada`,
`recusada`, `cancelada`, `reembolsada` ou `revisao_manual`. Pedido só muda para
`pago` após consulta válida. Um pagamento aprovado depois de o pedido ser
cancelado/liberado vai para revisão manual e não autoriza entrega automática.

## E-mail transacional (RF18) — outbox + SMTP configurável

A migração `0008_email_outbox.sql` cria `email_outbox`; a
`0010_email_entrega_smtp.sql` adiciona os estados `sending`/`sent`/`failed`,
o template `purchase_confirmation` e as colunas `next_attempt_at`,
`sent_at` e `last_error`. A confirmação do pedido (`order_confirmation`) e os
avisos de transição (`order_status`) continuam gravados com `event_key` única
na mesma transação do evento.

A confirmação de compra (`purchase_confirmation`, com número do pedido, itens,
valores, frete e endereço do snapshot) é enfileirada apenas na transição
efetiva para `pago` dentro de `applyVerifiedPayment`. Webhook repetido
(eventos distintos), reconciliação repetida e qualquer reprocessamento são
absorvidos pela `event_key` única: nenhuma confirmação é enviada duas vezes.

`FORMA_EMAIL_MODE=smtp` entrega por SMTP real (`smtp.client.js`: texto puro
UTF-8, STARTTLS/SSL e AUTH PLAIN/LOGIN). O worker reivindica linhas com
`FOR UPDATE SKIP LOCKED` em transação curta (status `sending` com lease em
`next_attempt_at`), envia fora da transação e finaliza com guarda por
`attempts`. Falha fica registrada em `last_error` com nova tentativa em
backoff exponencial limitado por `FORMA_EMAIL_MAX_ATTEMPTS`; o pedido nunca é
afetado pelo envio. O opt-in promocional (`users.promo`) não é consultado no
fluxo transacional — desmarcar promoções não impede a confirmação da compra.

`FORMA_EMAIL_MODE=mock` permanece como modo explícito de
desenvolvimento/teste: prévia em `mock_message`, status `mocked` e aviso no
próprio texto de que nenhuma mensagem foi entregue. Sem a variável, o padrão
é mock e a inicialização registra o aviso. Nenhum dado de pagamento/cartão
entra no payload. Variáveis de SMTP: `FORMA_SMTP_HOST`, `FORMA_SMTP_PORT`,
`FORMA_SMTP_SECURE`, `FORMA_SMTP_USER`, `FORMA_SMTP_PASS`, `FORMA_EMAIL_FROM`,
`FORMA_EMAIL_MAX_ATTEMPTS` (veja `server/.env.example`).

## Demonstração com Mercado Pago sandbox (0014)

`FORMA_DEMO_MODE=true` mantém API/banco em loopback, frete de R$ 10 e e-mail
local. `FORMA_DEMO_PAYMENT_PROVIDER=mercadopago` seleciona pagamento sandbox;
o valor padrão `forma_demo` mantém aprovação simulada. O comando
`npm run api:demo:mercadopago` inicia a primeira opção explicitamente.

`GET /api/pagamentos/configuracao` exige sessão e retorna `provider`,
`checkoutProAvailable`, `savedCardsAvailable` e `message`, sem segredos.
`GET /api/health` acrescenta `paymentProvider`. Listagens/detalhes de pedidos e
resposta do checkout expõem `paymentProvider`; `transactionMode: "demo"`
continua identificando entrega demonstrativa, independentemente do provedor.

A migração 0014 adiciona `payment_provider` a `orders` e `shipping_quotes`.
Pedidos anteriores preservam a escolha original. O provedor do pedido é
imutável e o trigger de tentativas exige que o provedor corresponda ao pedido.
Checkout rejeita uma cotação de outro provedor após mudança de configuração.
A rota de aprovação local não aprova pedidos Mercado Pago. Retorno do navegador
não aprova pagamento; webhook assinado/consulta verificada continuam necessários.

O cartão novo pode ser cadastrado nos campos seguros na confirmação do pedido
ou em Cartões salvos; o servidor recebe só token. Em credenciais `APP_USR`, a
demo verifica o vendedor como conta `test_user` antes das operações de criação
no gateway. Os testes usam respostas controladas e banco descartável; não
comprovam homologação externa.

## Organização das migrações

Diretório `server/src/db/migrations/`, executadas por
`node src/db/migrations/run.js` (`up` aplica pendentes, `status` lista):

- Um arquivo SQL por migração, nomeado `NNNN_descricao.sql`, atualmente de
  `0001_conta.sql` a `0014_provedor_pagamento_demo.sql`.
- Numeração sequencial, **não reutilizada**; migrações já aplicadas nunca são
  editadas — correções viram migrações novas.
- Cada migração roda em **transação** e é registrada em `schema_migrations`
  (`name`, `applied_at`), tornando a execução idempotente.
- Uma migração por bloco funcional (conta, papéis, recursos de conta,
  catálogo...), com os índices de unicidade junto das tabelas.

## Divisão dos módulos no código

```
server/src/
├── config.js                  # variáveis de ambiente (falha cedo sem DATABASE_URL)
├── app.js                     # fábrica do Express (rotas + middlewares)
├── index.js                   # escuta, encerramento gentil
├── db/pool.js                 # pool único PostgreSQL (pg) + inTransaction
├── db/migrations/             # executor e migrações 0001–0009
├── middleware/                # cors, auth (Bearer), authorize (requireRole), erros
├── modules/health/            # GET /api/health
├── modules/auth/              # schemas, service, routes de autenticação
├── modules/conta/             # enderecos.*, favoritos.*, listas.*, pedidos.*
├── modules/cart/              # resumo do carrinho e cupons
├── modules/shipping/          # Melhor Envio Sandbox e cotações
├── modules/checkout/          # criação transacional de pedidos
├── modules/payments/          # Mercado Pago Checkout Pro, HMAC e reservas
├── modules/notifications/     # outbox e renderização mock de e-mails
├── modules/admin/             # catálogo operacional, visão-geral e usuários (papel administrador)
├── scripts/criar-admin.js     # comando local de administrador (sem senha no código)
└── utils/                     # httpError, validate, password, token, money, units
```

Convenção por módulo: `*.schemas.js` valida e normaliza a entrada (lança
`HttpError 400` com `fields`); `*.service.js` contém regras e acesso ao banco
(linhas mapeadas para camelCase); `*.routes.js` só liga rota → schema → service.

Front: `src/services/api.js` é o único ponto HTTP (token automático, `ApiError`);
`src/services/cart.js` persiste a seleção local, `shipping.js` conecta cotação
e checkout e `payments.js` gera chave idempotente e retoma pagamento. Catálogo,
conta, frete, pedidos e pagamento de teste consomem a API; o outbox transacional
é processado localmente em modo mock, sem entrega externa.


## Fronteira de segurança e configuração — 22/10/2026

- Todo JSON com campos conhecidos `pan`, `cardNumber/card_number`, `cvv/cvc` ou
  `securityCode/security_code` (inclusive aninhados) recebe 400
  `dados_cartao_proibidos`; use somente o token opaco gerado pelo SDK.
- Rotas de carteira aceitam exclusivamente `{token}` ou `{orderId,token}` no
  pagamento, com autenticação e vínculo de dono. Nunca persistem token temporário.
  `GET /conta/cartoes` usa `Cache-Control: no-store`; `publicKey` é a única
  credencial pública do MP e retorna null se ausente/fictícia/formato incorreto.
- Assinatura do webhook usa ID/request-id/timestamp oficiais e tolerância de
  **300 segundos**, antes da consulta server-to-server. O ID consultado deve
  coincidir com o ID devolvido pelo gateway; corpo/status do navegador não aprova.
- URLs configuradas de callback/retorno recusam credenciais, query e fragmento;
  callback exige HTTPS externo. Mensagens de configuração nunca refletem o valor.
- 404 não reflete URL/query; health indisponível retorna razão genérica
  `conexao_indisponivel`. Erros inesperados e respostas SMTP não registram
  objetos/requisições/credenciais; erros SMTP preservam comando/código apenas.
- Administrador demo: development/test, URLs PostgreSQL loopback sem overrides
  e `host(inet_server_addr())` loopback, produção sempre recusada. Hash e sessão
  normais, sem promoção/reset de conta preexistente.

Evidências e homologações pendentes: [AUDITORIA_SEGURANCA.md](AUDITORIA_SEGURANCA.md).


### Correção da configuração de cartão salvo e do ambiente de teste

`POST /conta/cartoes/:id/pagar` exige configuração completa antes de criar
`payment_attempts` ou chamar o gateway. Ausência de callback/segredo ou valor
inválido resulta em 503 acionável, sem alterar pedido/reserva/estoque/outbox.
Callback requer endereço HTTPS público, sem credenciais, query ou fragmento;
IPs privados/reservados e nomes locais são recusados. `GET /conta/cartoes` retorna
`publicKey=null` enquanto a configuração estiver incompleta. Checkout Pro conserva
seu fluxo independente; a UI nunca usa configuração como confirmação de pagamento.

A política de banco local é única em `db/local-database.js`: rejeita queries,
fragmentos e configurações indiretas PG* antes da conexão; verifica host/peer TCP
e servidor/banco antes de liberar SQL de teste ou provisionamento demonstrativo.
