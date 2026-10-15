# Entrega 02 — Autenticação e permissões no servidor

Data: 15/10/2026.

## Solicitação do aluno

Implementar autenticação no servidor do FORMA usando a estrutura local existente
(API em `server/`), preservando as telas aprovadas. Substituir a autenticação
baseada em `localStorage` por cadastro, login, logout e sessão validada no
servidor; hash seguro de senha, validações, e-mail único e consentimento
promocional inicialmente desmarcado; funções de cliente/administrador com
autorização reutilizável no back-end e comando para criar administrador sem
senha fixa no código; adaptação de `AuthProvider`, serviços e proteção de
rotas; preservar os dados antigos do navegador e documentar a transição, sem
importar privilégios ou credenciais locais como dados confiáveis; testar
cadastro, sessão, logout e bloqueio administrativo para clientes; atualizar o
registro de entrega. Sem hospedagem, deploy ou commit/push automático.

## Alterações feitas

- **Papéis no banco (`0002_papeis.sql`)**: coluna `users.role`
  (`cliente`/`administrador`, padrão `cliente`, com `CHECK` de valores). Toda
  conta criada pela API nasce cliente — o corpo da requisição nunca define
  papel; `administrador` só é concedido pelo comando local.
- **Autorização reutilizável no back-end**: `server/src/middleware/authorize.js`
  com `requireRole(...papeis)` (403 `acesso_negado`), usado sempre depois de
  `requireAuth`. O usuário público (`/auth/eu`, registro, login) passou a
  incluir `role`; senhas continuam em scrypt com salt aleatório no servidor.
- **Módulo administrativo mínimo** (`server/src/modules/admin/`):
  `GET /api/admin/visao-geral` (totais) e `GET /api/admin/usuarios`, ambos com
  `requireAuth + requireRole('administrador')`. O gerenciamento operacional
  (produtos, preços, pedidos) continua para o bloco de catálogo.
- **Comando para criar administrador** (`server/src/scripts/criar-admin.js`,
  `npm run admin` em `server/` ou `npm run api:admin` na raiz): e-mail e nome
  por flags, senha informada no terminal com eco oculto (ou `ADMIN_PASSWORD`
  para uso não interativo) — **nenhuma senha no código**. Valida e-mail e
  tamanho mínimo, recusa e-mail duplicado (use `--promover` para conceder o
  papel a uma conta existente preservando a senha) e funciona a partir de
  qualquer diretório (`carregar-env.js` localiza o `server/.env`).
- **Front na API, telas preservadas**:
  - `src/services/auth.js` reescrito: registro, login, logout, sessão
    (`GET /auth/eu`) e perfil via `src/services/api.js`; token opaco em
    `forma:apiToken`. Nenhuma criptografia de senha no navegador.
  - `src/services/account.js` reescrito: endereços e listas via API
    (`/conta/...`), com as mesmas validações e mensagens das telas aprovadas.
  - `src/services/storage.js` removido (sem mais leitura/escrita local).
  - `AuthProvider` valida a sessão no servidor ao abrir o app (estado
    `ready`), mantém a sincronização entre abas pelo evento `storage` do
    token, expõe `isAdmin` derivado de `user.role` e não lança no logout.
  - `RequireAuth` espera a validação da sessão antes de redirecionar;
    novo `RequireRole` protege `/administracao` (visitante → `/login`,
    cliente → `/minha-conta`), e `App.jsx` aplica o guard.
  - Telas de login/cadastro usam os erros do servidor (e-mail duplicado vira
    erro de campo, como antes); dados pessoais, endereços e listas ficaram
    assíncronos com os mesmos textos, botões e estados visuais.
  - `scripts/check-browser.mjs` atualizado para o token e o carregamento
    assíncrono dos dados.
- **Transição documentada** (`docs/forma/API_CONTRATOS.md`, README): as chaves
  antigas do navegador (`forma:users`, `forma:session`, `forma:account:*`)
  permanecem intactas — não são lidas, migradas nem apagadas. Os hashes PBKDF2
  locais não podem ser verificados pelo servidor e **não foram importados**;
  cada pessoa cadastra novamente. Privilégio local algum é importado: papel
  inicial é sempre `cliente`.

## Arquivos principais

- `server/src/db/migrations/0002_papeis.sql`;
  `server/src/middleware/{auth,authorize}.js`;
  `server/src/modules/admin/{admin.routes,admin.service}.js`;
  `server/src/scripts/{criar-admin,carregar-env}.js`;
  `server/src/app.js`; `server/package.json`; `package.json` (raiz);
  `server/tests/authz.test.js`.
- `src/services/{auth,api,account}.js`; `src/context/{AuthProvider,useAuth}.jsx*`;
  `src/components/{RequireAuth,RequireRole}.jsx`; `src/App.jsx`;
  `src/pages/Auth.jsx`, `src/pages/Account.jsx`;
  `src/context/useAccountData.js`; `src/pages/account/{AccountLayout,Addresses,Lists}.jsx`;
  `scripts/check-browser.mjs`.
- `docs/forma/API_CONTRATOS.md`, `README.md`, `CONTEXTO_FORMA.md`,
  `docs/forma/ANDAMENTO.md` e este registro.

## Verificações executadas e resultados

- Testes: **24/24 do servidor** (`node --test` em `server/`, inclui os novos
  testes de `requireRole`) e **11/11 da raiz** (serviços de auth/conta com
  `fetch` simulado) — **35/35 no total** via `npm test` da raiz. Lint
  (`oxlint`) sem avisos; build de produção passou.
- API com **PostgreSQL real efêmero** (binários portáveis em `/tmp/opencode`,
  fora do repositório, descartados após a verificação): migração `0002` aplicada
  e `status` idempotente; health `200`.
  - Cadastro: `201` com `role: "cliente"` e `promo: false` por padrão;
    `promo: true` respeitado quando marcado; senha nunca retorna.
  - E-mail duplicado case-insensitive → `409 email_ja_cadastrado`;
    validações por campo → `400 validacao`.
  - Login correto `200`; senha errada `401 credenciais_invalidas`;
    `GET /auth/eu` `200`; `PATCH /auth/eu` `200`; endereço e lista `201`.
  - **Bloqueio administrativo**: cliente em `/api/admin/visao-geral` →
    `403 acesso_negado`; visitante sem token → `401 sessao_ausente`;
    administrador → `200`.
  - Logout `204` e token invalidado (`401 sessao_invalida`).
  - `criar-admin`: cria administrador (login com `role administrador`);
    rejeita senha curta, e-mail inválido e duplicado; `--promover` concede o
    papel preservando a senha. Cadastro com `"role": "administrador"` no corpo
    continua criando `cliente` (papel não é injetável).
- Interface (Playwright + Firefox headless contra a API de teste): cadastro com
  promo desmarcada e token salvo; sessão restaurada após recarregar; endereço e
  lista criados pela tela; cliente redirecionado ao abrir `/administracao`;
  edição de perfil e logout limpando o token; e-mail duplicado como erro de
  campo e login inválido como alerta; retorno ao destino protegido
  (`/favoritos`) após entrar; administrador visualiza o painel aprovado sem
  alterações visuais. Nenhuma exceção JavaScript; captura do painel conferida.

## Pendências e limites

- O PostgreSQL continua não instalado na máquina do aluno; para uso permanente,
  seguir o passo 1 de `docs/forma/API_CONTRATOS.md`. A verificação usou
  instância efêmera em `/tmp`.
- Contas criadas na demonstração local antiga **não existem no servidor**:
  é preciso cadastrar novamente (transição documentada; nada foi apagado do
  navegador). Dados de endereços/listas antigos no navegador não migram — os
  novos ficam no banco, por conta.
- O painel `/administracao` segue prévia visual (agora restrita a
  administradores); gerenciamento operacional chega com o bloco de catálogo.
- Sem commit, push, hospedagem ou deploy.

## Próximo passo autorizado

Definido pelo aluno em nova solicitação (por exemplo: bloco de catálogo com
migração `0002_catalogo.sql`, reaproveitando `requireRole` para as rotas de
administração de produtos).
