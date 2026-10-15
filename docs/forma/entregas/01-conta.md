# Entrega 01 — Estrutura do back-end local e bloco de conta

Data: 14/10/2026.

## Solicitação do aluno

Implementar somente a estrutura do back-end local do FORMA: `server/` com
Node.js/Express e PostgreSQL local, migrações, validação e tratamento de erros,
`.env.example` sem segredos; cliente HTTP reutilizável no React; documentação de
execução local (front, API e banco); atualização do contexto da nova etapa
(back-end e banco locais, catálogo funcional e integrações autorizados; sem
hospedagem, Supabase, Vercel ou deploy); `docs/forma/API_CONTRATOS.md` com
rotas, campos, erros, autenticação e divisão dos módulos; padronização de
valores monetários em centavos e de unidades de peso/dimensões; verificação de
conexão e funcionamento da API; registro desta entrega. Os demais blocos
(catálogo, carrinho, checkout, pagamento, frete, e-mail, administração
operacional) não devem ser implementados, e não houve commit/push automático.

## Alterações feitas

- **API local (`server/`)**: Express 5 + `pg` + `dotenv`. Configuração central
  com falha cedo quando falta `DATABASE_URL`; pool único do PostgreSQL;
  middlewares de CORS restrito à origem do Vite, autenticação Bearer e erros
  padronizados; encerramento gentil (SIGINT/SIGTERM fecham o pool).
- **Migrações**: executor transacional e idempotente com registro em
  `schema_migrations` (`up`/`status`) e a migração `0001_conta.sql` (tabelas
  `users`, `sessions`, `addresses`, `lists`, com índices únicos de e-mail e de
  nome de lista por conta, case-insensitive).
- **Bloco de conta implementado** (único bloco desta entrega):
  `POST /api/auth/registrar`, `POST /api/auth/entrar`, `POST /api/auth/sair`,
  `GET /api/auth/eu`, `PATCH /api/auth/eu`; CRUD de endereços e listas em
  `/api/conta/...`; `GET /api/health`. Sessão por token opaco (o banco guarda
  só o SHA-256), senhas com scrypt e salt aleatório, dados de conta sempre
  filtrados por `user_id`.
- **Padrões**: valores monetários em centavos (inteiros) e peso em gramas /
  dimensões em centímetros, com utilitários e testes
  (`server/src/utils/money.js`, `units.js`), aplicáveis aos blocos futuros.
- **Front**: `src/services/api.js`, cliente HTTP reutilizável (token automático
  em `forma:apiToken`, `ApiError` com `status`/`code`/`fields`, 204 → `null`).
  Nenhuma tela foi alterada; o front aprovado permanece intacto.
- **Documentação**: `docs/forma/API_CONTRATOS.md` (contratos, erros,
  autenticação, módulos futuros, migrações, execução local); CONTEXTO_FORMA.md
  e README atualizados; `.env.example` somente com valores locais.

## Arquivos principais

- `server/` completo: `package.json`, `.env.example`, `.gitignore`,
  `src/{config,app,index}.js`, `src/db/pool.js`,
  `src/db/migrations/{run.js,0001_conta.sql}`, `src/middleware/{cors,auth,errors}.js`,
  `src/modules/{health,auth,conta}/`, `src/utils/`, `tests/`.
- `src/services/api.js`; `package.json` da raiz (scripts `api`, `api:migrate`).
- `docs/forma/API_CONTRATOS.md`, `docs/forma/entregas/01-conta.md`,
  `CONTEXTO_FORMA.md`, `README.md`, `docs/forma/ANDAMENTO.md`.

## Verificações executadas e resultados

- Testes unitários do servidor (`node --test`): **21/21 passam** (money, units,
  password/token, schemas). Testes da raiz continuam passando: **28/28**.
- Lint (`oxlint`) sem avisos; build de produção do front passou.
- API executada e testada com **PostgreSQL real** (instância efêmera de
  teste em `/tmp`, fora do repositório, descartada após a verificação):
  - Migração `0001_conta.sql` aplicada; `status` idempotente; health passou de
    `503/ECONNREFUSED` (banco desligado) para `200/ok` (banco ligado).
  - Fluxo completo via HTTP: registro (201 com token), `GET/PATCH /auth/eu`,
    login correto (200) e senha errada (401), e-mail duplicado
    case-insensitive (409), CRUD de endereço (201/200/204, CEP e UF
    normalizados, inválidos rejeitados 400 por campo), CRUD de listas
    (201/200/204, nome repetido 409), exclusões de terceiros bloqueadas com
    404 (isolamento por conta), logout 204 e token invalidado (401).
  - JSON inválido → 400 `json_invalido`; rota inexistente → 404; requisições
    sem token → 401 `sessao_ausente`; banco desligado → 503
    `banco_indisponivel`; SIGTERM encerra a API sem erros no log.
- Nenhum commit, push ou implantação. Nenhuma dependência de hospedagem.

## Pendências e limites

- O PostgreSQL **não está instalado** na máquina do aluno; a verificação com
  banco real usou uma instância efêmera em `/tmp`. Para uso permanente, seguir
  o passo 1 de `docs/forma/API_CONTRATOS.md` (criar usuário/banco locais) —
  sem essa etapa, a API responde, porém com `503 banco_indisponivel`.
- Apenas o bloco de conta existe na API; `productIds` das listas retorna vazio
  até a migração do catálogo. Front ainda não consome a API (as telas seguem
  com localStorage); a troca será feita por etapas próprias.
- Pagamento, frete, e-mail, cupons, administração operacional e privilégios de
  administrador permanecem fora do escopo. Integrações (Mercado Pago, frete,
  e-mail) estão autorizadas na etapa, mas não implementadas.

## Próximo passo autorizado

Definido pelo aluno em nova solicitação (por exemplo: bloco de catálogo com
migração `0002_catalogo.sql` ou conexão das telas de conta à API).

---

# Atualização — 15/10/2026 — recursos de conta persistentes

Data: 15/10/2026.

## Solicitação do aluno

Completar os recursos de conta do FORMA com persistência no PostgreSQL local,
reutilizando as telas existentes. Conectar edição de perfil e preferência
promocional à API. Implementar cadastro, edição e remoção de endereços, com
seleção explícita do principal. Completar favoritos e listas: adicionar/remover
produtos, consultar itens, criar, renomear e excluir listas, usando o contrato
de produtos disponibilizado por Gabriel. Garantir isolamento entre usuários e
contadores reais. Preservar os mockups. Testar persistência após reiniciar a
API e bloqueio de acesso aos dados de outra conta. Deixar pedidos e cartões
para Lucas. Registrar o resultado neste arquivo. Sem hospedagem ou
commit/push automático.

## Alterações feitas

- **Migração `0003_favoritos_listas_principal.sql`**: coluna
  `addresses.principal` (boolean); tabelas `favorites` (RF19) e `list_items`
  (RF20), ambas com unicidade por par e exclusão em cascata pelas tabelas de
  conta. Produtos são referenciados pelo **id do contrato do catálogo** (UUID)
  **sem chave estrangeira** — a tabela `products` pertence ao bloco de
  produtos (Gabriel) e nascerá em migração própria.
- **Endereço principal explícito (RF05)**: o primeiro endereço da conta nasce
  principal; a troca é sempre `PUT /api/conta/enderecos/:id/principal`,
  executada em transação (o anterior perde a marcação no mesmo passo).
  Removendo o principal, o endereço mais antigo restante assume. Listagem
  ordena o principal primeiro; todas as respostas incluem `principal`.
- **Favoritos (RF19)**: `GET/POST/DELETE /api/conta/favoritos` com
  unicidade por produto (`409 favorito_duplicado`).
- **Listas com itens (RF20)**: `GET /api/conta/listas` e
  `GET /api/conta/listas/:id` retornam `productIds` reais;
  `POST /api/conta/listas/:id/itens` e
  `DELETE /api/conta/listas/:id/itens/:productId` gerenciam itens
  (`409 produto_na_lista` em duplicidade). Isolamento por `user_id` em todas
  as consultas — lista ou endereço de outra conta responde `404`.
- **Perfil**: edição de nome e preferência promocional já conectada à API
  (`PATCH /api/auth/eu`) desde a entrega de autenticação; conferida nesta
  etapa com persistência.
- **Front, telas preservadas**: `src/services/products.js` resolve dados de
  produto pelo contrato (`id`, `name`, `description`, `price_centavos`,
  `promo_price_centavos`, `color`...) a partir de `src/data/products.js` —
  ponto único de integração com o catálogo de Gabriel; id desconhecido exibe
  "Produto indisponível", o mesmo estado aprovado da tela de produto.
  Favoritos (nas duas telas) e detalhe de lista passam a listar itens reais
  com remoção; endereços ganham o botão "Definir como principal"; a visão
  geral mostra o endereço principal eleito e contadores reais de favoritos e
  listas (pedidos seguem `00` — bloco de Lucas). A tela de produto ganha as
  ações de favoritar e salvar em lista, exibidas quando houver peça com o id
  informado. Recarregar ao trocar de seção da conta mantém contadores e itens
  sempre atuais.
- **Nota sobre o contrato**: o contrato de produtos citado pelo aluno não
  estava no repositório; foi adotado o formato já especificado em
  `docs/forma/API_CONTRATOS.md` (bloco Catálogo). Como favoritos e itens
  guardam apenas o `id` do produto, ajustes futuros no contrato não afetam as
  rotas de conta.

## Arquivos principais

- `server/src/db/migrations/0003_favoritos_listas_principal.sql`;
  `server/src/db/pool.js` (helper `inTransaction`);
  `server/src/modules/conta/{enderecos,favoritos,listas,produto}.*`;
  `server/src/modules/conta/conta.routes.js`; `server/tests/schemas.test.js`.
- `src/services/{products,account}.js`; `src/context/useAccountData.js`;
  `src/pages/account/{Overview,Addresses,Lists,Collections}.jsx`;
  `src/pages/Product.jsx`; `tests/account.test.js`.
- `docs/forma/API_CONTRATOS.md`, `docs/forma/ANDAMENTO.md`, `README.md` e esta
  atualização.

## Verificações executadas e resultados

- Testes automatizados: **40/40** passam (27 do servidor — incluindo o novo
  schema de produto; 13 da raiz — incluindo favoritos, itens de lista e
  principal com `fetch` simulado). Lint (`oxlint`) sem avisos; build passou.
- API com **PostgreSQL real efêmero** (binários portáveis em `/tmp/opencode`,
  fora do repositório, descartados após a verificação): migração 0003
  aplicada e idempotente; health `200`.
  - Endereços: primeiro nasce principal; `PUT /:id/principal` elege o segundo
    e desmarca o primeiro (verificado na listagem); remoção do principal
    promove o mais antigo restante; validações por campo continuam (`400`).
  - Favoritos: inclusão `201`, duplicado `409 favorito_duplicado`, listagem
    ordenada, remoção `204`.
  - Listas: criação/renomeação, item incluído (`201` com `productIds` atual),
    duplicado `409 produto_na_lista`, remoção do item `204`.
  - **Isolamento entre contas**: segundo usuário recebe `404` ao tentar ler,
    editar, eleir principal, adicionar item ou remover dados da primeira;
    favoritos/listas do segundo começam vazios.
  - **Persistência após reiniciar a API**: processo encerrado (SIGTERM) e
    reerguido com o mesmo banco — sessão ainda válida, endereço principal,
    item da lista e favorito exatamente como estavam.
- Interface (Playwright + Firefox headless contra a API de teste): cadastro
  pela tela aprovada; primeiro endereço nasce principal; eleição do segundo
  refletida nos rótulos e na visão geral após recarregar; contadores reais de
  listas e favoritos (`00` → `01` → `00`); item adicionado via API aparece no
  detalhe da lista e sai pela tela; renomear lista; favorito removido pela
  tela; perfil (nome e promo) persistido; **dados e sessão intactos após
  reiniciar a API**. Nenhuma exceção JavaScript; captura da tela de endereços
  conferida visualmente (marcação de principal e botão de eleição no sistema
  visual aprovado).
- Ações de adicionar produto (favoritar/salvar em lista na tela de produto)
  ficam visíveis quando o catálogo existir; enquanto isso, inclusão e remoção
  foram verificadas direto na API e os itens salvos aparecem nas telas como
  "Produto indisponível", sem dados fictícios.

## Pendências e limites

- O PostgreSQL continua não instalado na máquina do aluno; a verificação usou
  instância efêmera em `/tmp`. Para uso permanente, passo 1 de
  `docs/forma/API_CONTRATOS.md`.
- O catálogo segue vazio (bloco de Gabriel): não há peças para favoritar a
  partir das telas ainda; favoritos/itens aceitam qualquer id no formato do
  contrato e exibem "Produto indisponível" até a tabela `products` existir.
- Pedidos e cartões permanecem fora do escopo (bloco de Lucas); os contadores
  de pedidos seguem `00`.
- Sem commit, push, hospedagem ou deploy.

## Próximo passo autorizado

Definido pelo aluno em nova solicitação (por exemplo: bloco de catálogo de
Gabriel — tabela `products` e rotas `GET /produtos` —, que alimenta
favoritos/listas com peças reais).
