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
