# FORMA

Loja de camisas oversized masculinas. Este repositório contém o front-end do
projeto, desenvolvido como atividade acadêmica e construído por etapas durante
as aulas.

## Objetivo

Criar a base de um e-commerce simples, com navegação entre páginas e a
estrutura inicial de catálogo, carrinho e autenticação. A interface é
desenvolvida em etapas durante as aulas; desde 14/10/2026 o projeto também tem
**API local** (`server/`, Node.js/Express) com **PostgreSQL local**, conforme
documentado em `docs/forma/API_CONTRATOS.md`.

## Tecnologias utilizadas

- [React](https://react.dev/) 19
- [Vite](https://vite.dev/) 8
- [React Router](https://reactrouter.com/) 7 (`react-router-dom`)
- [Oxlint](https://oxc.rs/) para lint

## Funcionalidades desta entrega

### Organização visual

- Cabeçalho com o nome **FORMA**, navegação alinhada, indicação da página ativa
  e menu responsivo (botão no celular).
- Largura de conteúdo, margens, espaçamentos, fontes, botões e campos
  padronizados em `src/styles/global.css`.
- Hover uniforme: ações comuns com fundo azul escuro e texto branco; ações de
  sair com fundo vermelho suave, texto e borda vermelhos. Botões desabilitados
  não mudam ao passar o mouse; ícones e menu mobile seguem o padrão comum.
- Home com hero dividido: texto à esquerda (46%) e foto editorial original à
  direita (54%), com recorte responsivo sem distorção. Destaques com mensagem
  discreta de catálogo vazio, sem cards de produtos.
- No mobile, o texto e a foto são empilhados; a imagem continua visível e mantém
  o modelo e a camisa enquadrados.
- Catálogo com filtros laterais e ordenação conectados à API; permanece vazio
  quando não houver produtos reais cadastrados.
- Carrinho compartilhado entre produto, carrinho e checkout, com quantidades,
  remoção e subtotais/validação de cupom recalculados pelo servidor.
- Minha Conta com visão geral conforme o mockup e rotas para pedidos, favoritos,
  listas de compras, endereços, cartões e dados pessoais.
- Favoritos em página própria pelo coração do cabeçalho, com estado vazio;
  o ícone de usuário abre Minha Conta.
- Endereços: criar, editar, remover com confirmação e **definir o endereço
  principal explicitamente** (a visão geral exibe o escolhido).
- Favoritos com itens reais por conta: salvar peças (quando o catálogo
  existir), consultar e remover; contador real na visão geral.
- Listas: criar, renomear, abrir detalhes, adicionar/remover peças e remover
  com confirmação; itens referenciados pelo contrato do catálogo.
- Produto carregado do catálogo da API; adição ao carrinho usa o estado comum do navegador.
- Checkout com identificação, endereço salvo, cotação Melhor Envio Sandbox,
  serviços/preços/prazos retornados e resumo atualizado.
- Pedido autenticado guarda snapshot e reserva estoque; só muda para `pago`
  depois de consulta validada ao gateway.
- Mercado Pago Checkout Pro hospedado para pagamento de teste; cartões salvos
  continuam na conta Mercado Pago e não são guardados pela FORMA. Webhooks
  assinados reconciliam pagamentos consultando o gateway.
- Administração com prévia visual da visão geral, produtos, promoções e pedidos,
  **restrita a contas administradoras**: cliente é redirecionado para a conta e
  a API nega as rotas administrativas (403).
- Sobre Nós, login e cadastro com o mesmo sistema visual.
- Estados vazios organizados do catálogo e do carrinho, com mensagem e ação.
- Formulários de login e cadastro com rótulos claros e mensagens de validação.
- Rodapé com marca, links de navegação e aviso de direitos.
- Layout responsivo para desktop e celular.

### Cadastro, login e sessão no servidor

- Cadastro com nome, e-mail, senha e confirmação de senha, gravado no
  **PostgreSQL local** pela API (`POST /api/auth/registrar`).
- Opção "Quero receber promoções por e-mail", **desmarcada por padrão**.
- Validações no cliente e repetidas no servidor: campos obrigatórios, formato
  de e-mail, tamanho mínimo de senha, senhas diferentes e **e-mail único**
  (case-insensitive → `409 email_ja_cadastrado`).
- Senhas com **scrypt e salt aleatório no servidor**; nunca em texto puro,
  nunca no navegador.
- Sessão por token opaco (`forma:apiToken`), validada no servidor a cada
  abertura do app (`GET /api/auth/eu`); válida por 7 dias (`SESSION_TTL_DAYS`).
- Logout encerra a sessão no servidor e limpa o token; funciona mesmo com a
  API desligada (o lado local é limpo de qualquer forma).
- Página **Minha Conta** para consultar e editar nome e preferência
  promocional; endereços e listas gravados no banco, por conta
  (`/api/conta/...`).
- Cabeçalho com acesso à conta pelo ícone de usuário e nome + Sair quando
  logado. O nome fica oculto em desktops estreitos, mantendo o rótulo
  acessível da conta.
- Proteção das rotas `/minha-conta` e `/favoritos`: visitantes são
  redirecionados para `/login` e voltam ao destino após entrar.
- Papéis **cliente** e **administrador**: toda conta nasce cliente;
  administrador só pelo comando local (`npm run api:admin`). O front usa o
  papel apenas para esconder rotas — a autorização real é do servidor.
- Entrar/sair em outra aba da mesma origem atualiza o estado React pelo evento
  `storage` do token.

### Limites desta etapa

- Catálogo permanece **vazio** (sem imagens ou produtos fictícios).
- Imagens em banners e áreas institucionais autorizadas. Nesta entrega, somente
  o banner principal recebeu a foto aprovada; as demais páginas não receberam
  banners ou fotografias extras. Favoritos abre sua tela vazia pelo coração;
  o ícone de busca dá acesso ao catálogo.
- CSS simples, reaproveitando os componentes existentes.
- Somente credenciais e checkout Mercado Pago de teste. Não há cobrança real,
  compra de etiquetas ou envio; e-mail de confirmação continua pendente.
- Cotação depende de credenciais OAuth do Melhor Envio Sandbox, CEP de origem,
  produtos com peso/dimensões e endereços com CEP válidos. Sem credenciais, não
  são exibidas cotações estimadas.
- Autenticação, perfil, endereços (com principal explícito), favoritos,
  listas, catálogo, resumo/cupom, frete e pedidos consomem módulos da API local.
  O carrinho fica no navegador; o servidor refaz preços e descontos. O painel
  de administração segue prévia visual, restrita a administradores. Com o catálogo vazio, peças
  salvas em favoritos/listas aparecem como "Produto indisponível" até a
  tabela de produtos existir.

## Aviso importante sobre a autenticação

> A autenticação roda no **servidor local** do projeto (Express + PostgreSQL na
> sua máquina) para fins acadêmicos. Ela **não** tem a infraestrutura de uma
> autenticação de produção (cookies `HttpOnly`, HTTPS, limitação de tentativas,
> recuperação de senha): o token fica no `localStorage` do navegador e qualquer
> pessoa com acesso ao dispositivo pode inspecioná-lo.

Mesmo assim, as senhas **não são salvas em texto puro**: cada senha recebe hash
**scrypt** com salt aleatório por usuário, verificado apenas no servidor com
comparação em tempo constante. O banco guarda somente o SHA-256 do token de
sessão, nunca o token em si. Use somente **dados fictícios** e nunca uma senha
real nesta demonstração.

### Transição do localStorage (demonstração antiga)

Até 14/10/2026 usuários, sessão e dados de conta viviam no navegador
(`forma:users`, `forma:session`, `forma:account:*`). Essas chaves **continuam
no navegador, intactas**: o código novo não as lê, não as altera e não as
apaga. Nada foi migrado automaticamente — hashes de senha feitos no navegador
não podem ser verificados pelo servidor, e credenciais/privilégios criados no
cliente não são dados confiáveis. **Cadastre novamente** sua conta no servidor
e crie o administrador com o comando abaixo; o papel inicial é sempre
`cliente`.

### Comando para criar administrador

```bash
# na raiz do projeto (pede a senha no terminal, com eco oculto)
npm run api:admin -- --email admin@forma.local --nome "Administrador FORMA"

# conceder o papel a uma conta existente, preservando a senha
npm run api:admin -- --email conta@forma.local --promover
```

A senha nunca fica no código. Em scripts sem terminal, use
`ADMIN_PASSWORD='...'` antes do comando. Veja detalhes em
`docs/forma/API_CONTRATOS.md`.

## Instalação e execução

Pré-requisito: Node.js e npm instalados.

```bash
# instalar as dependências
npm install

# rodar o servidor de desenvolvimento
npm run dev

# gerar a build de produção
npm run build

# pré-visualizar a build de produção
npm run preview

# rodar o lint
npm run lint

# verificar os serviços locais e as validações
npm test
```

Após `npm run dev`, o site fica disponível no endereço exibido no terminal
(por padrão, `http://localhost:5173`).

## API local e banco de dados (server/)

Desde 14/10/2026 o projeto tem uma API local em `server/` (Node.js/Express +
PostgreSQL local), sem hospedagem, Supabase, Vercel ou deploy. Os contratos
completos (rotas, campos, erros, autenticação e módulos) estão em
`docs/forma/API_CONTRATOS.md`. A API cobre conta, leitura do catálogo,
  carrinho/cupom, cotações do Melhor Envio Sandbox, pedidos/reservas de estoque
  e pagamentos de teste pelo Mercado Pago Checkout Pro. O guia de frete está em
  `docs/forma/entregas/03-compra.md` e
  `docs/forma/entregas/04-pagamento.md`.

### Executando banco, API e front localmente

Pré-requisitos: Node.js 20+ e PostgreSQL 14+ instalados na máquina.

```bash
# 1. Uma única vez: criar usuário e banco PostgreSQL locais
sudo -u postgres psql -c "CREATE USER forma WITH PASSWORD 'forma';"
sudo -u postgres psql -c "CREATE DATABASE forma OWNER forma;"

# 2. Uma única vez: configurar a API (valores locais, sem segredos)
cd server
cp .env.example .env
cd ..

# 3. Aplicar as migrações (inclui produtos, cupons e pedidos)
npm run api:migrate

# 4. Uma única vez: criar o administrador (senha pedida no terminal)
npm run api:admin -- --email admin@forma.local --nome "Administrador FORMA"

# 5. Em um terminal: subir a API em http://localhost:3333
npm run api

```

Com a API iniciada, autorize o aplicativo sandbox em outro terminal com
`npm run api:melhor-envio:autorizar`. Em mais um terminal, inicie o front com
`npm run dev`. Configure o aplicativo e as variáveis conforme
`docs/forma/entregas/03-compra.md`.

Para Mercado Pago, use somente `MERCADOPAGO_TEST_ACCESS_TOKEN` e
`MERCADOPAGO_MODE=sandbox`. Inicie um túnel HTTPS temporário (`ngrok http 3333`),
configure `MERCADOPAGO_PUBLIC_URL` e a assinatura de webhook em
`server/.env`, e siga `docs/forma/entregas/04-pagamento.md`. Não use token de
produção.

Conferência rápida: `GET http://localhost:3333/api/health` responde
`{"status":"ok","database":{"status":"ok"}}` quando o PostgreSQL está em
execução; com o banco desligado responde `503` indicando o motivo. Testes
unitários da API: `npm test` dentro de `server/`.

### Cliente HTTP no React

`src/services/api.js` centraliza o acesso à API: anexa automaticamente o token
salvo em `localStorage` (`forma:apiToken`), lança `ApiError` (com `status`,
`code` e `fields` para erros de validação) e trata 204 como `null`.

```js
import { api, ApiError, setToken, clearToken } from '../services/api'

// login e guarda da sessão
const { token, user } = await api.post('/auth/entrar', { email, password })
setToken(token)

// área autenticada (token vai no cabeçalho automaticamente)
const { addresses } = await api.get('/conta/enderecos')

try {
  await api.post('/conta/listas', { name })
} catch (error) {
  if (error instanceof ApiError) setError(error.fields?.name ?? error.message)
}

clearToken() // logout
```

A URL da API pode ser ajustada com `VITE_API_URL` no front (padrão
`http://localhost:3333/api`).

## Como testar os fluxos

1. Abra `/login`.
2. Em **Criar conta**, preencha nome, e-mail, senha e confirmação.
3. Teste as validações (campos vazios, e-mail inválido, senhas diferentes e
   e-mail já cadastrado tentando cadastrar o mesmo e-mail novamente).
4. Ao cadastrar, você entra automaticamente e é levado para `/minha-conta`.
5. Abra **Dados pessoais**, edite nome e preferência e clique em **Salvar alterações**.
6. Recarregue a página: a sessão e os dados continuam salvos.
7. Clique em **Sair** e entre novamente em **Entrar** com as mesmas
   credenciais para confirmar a verificação.
8. Com a sessão encerrada, acesse `/minha-conta` diretamente: você será
   redirecionado para o login.
9. Clique no coração: abre **Favoritos**, sem o menu lateral de Minha Conta.
10. Em **Endereços**, adicione um endereço fictício, edite e recarregue a página.
    Confira o endereço principal na visão geral; teste remover e cancelar a remoção.
11. Em **Lista de compras**, crie uma lista, renomeie, abra os detalhes e remova.
12. Com produtos ativos no banco, adicione uma peça ao carrinho e teste quantidade,
  remoção e o cupom `FORMA10`.
13. Entre, selecione um endereço e consulte as opções reais do Melhor Envio Sandbox.
  Confirme o pedido e confira a reserva de estoque.
14. Com credenciais/test users do Mercado Pago, abra Checkout Pro, complete um
  teste com cartão de teste e confira que só webhook/consulta atualiza o status.
  Nenhuma cobrança real ou etiqueta é criada.
15. Com uma conta comum, abra `/administracao`: você volta para `/minha-conta`.
    Promova a conta (`npm run api:admin -- --email conta@forma.local --promover`),
    entre novamente e o painel aprovado abre, com as abas de produtos,
    promoções e pedidos (prévia visual, sem gerenciamento).

As rotas `/login` e `/cadastro` exibem os dois formulários. As demais rotas são
`/`, `/catalogo`, `/sobre`, `/carrinho` e `/minha-conta`. Um endereço desconhecido
mostra uma mensagem de página não encontrada. Novas rotas: `/favoritos`,
`/produto`, `/produto/:id`, `/checkout`, `/minha-conta/{pedidos,favoritos,listas,
enderecos,cartoes,dados}`, `/minha-conta/listas/:id`, `/minha-conta/pedidos/:id`
e `/administracao/{produtos,promocoes,pedidos}`. A raiz de cada área abre sua
visão geral; pedidos inexistentes e listas inexistentes exibem estados próprios.

Para repetir a verificação automatizada no navegador, mantenha a API
(`npm run api`) e o front (`npm run dev -- --host 127.0.0.1`) ativos e execute
em outro terminal:

```bash
node scripts/check-browser.mjs
```

Esse script opcional utiliza Node.js 24 e o Microsoft Edge instalado no caminho
padrão do Windows, em modo headless. Para outro Chromium, configure a variável
`FORMA_BROWSER` com o caminho do executável. A URL de teste é
`http://127.0.0.1:5173`, com a porta de depuração 9229. Ele usa um perfil isolado
em `.tmp/browser-check/profile`, sem alterar os dados do navegador usado em aula.
Capturas desktop e mobile ficam em `.tmp/browser-check/`, ignorado pelo Git.

## Estrutura do projeto

```
.
├── index.html
├── package.json
├── vite.config.js
├── docs/forma                   # contexto, guia, andamento, contratos e referências
├── server                       # API local: Express + PostgreSQL (conta, papéis, admin)
│   ├── package.json             # scripts: dev, migrate, admin, test
│   ├── .env.example             # variáveis locais, sem segredos
│   ├── src/config.js            # variáveis de ambiente com falha cedo
│   ├── src/app.js               # fábrica do Express e rotas
│   ├── src/index.js             # escuta e encerramento gentil
│   ├── src/db                   # pool do PostgreSQL e migrações (0001_conta, 0002_papeis, 0003_favoritos_listas_principal)
│   ├── src/middleware           # CORS, sessão Bearer, requireRole (papéis) e erros
│   ├── src/modules              # health, auth, conta (endereços, listas) e admin
│   ├── src/scripts              # criar-admin.js (comando local de administrador)
│   ├── src/utils                # validate, password (scrypt), token, money, units
│   └── tests                    # testes unitários da API
├── tests/auth.test.js           # serviços de autenticação e validações (fetch simulado)
├── tests/account.test.js        # serviços de endereços/listas (fetch simulado)
├── scripts/check-browser.mjs    # checagem opcional no Edge headless
└── src
    ├── assets
    │   └── hero-editorial.png     # cópia local da foto original aprovada
    ├── App.jsx                    # definição das rotas (áreas protegidas por sessão e papel)
    ├── main.jsx                   # ponto de entrada, BrowserRouter e AuthProvider
    ├── components
    │   ├── Button.jsx
    │   ├── EmptyState.jsx
    │   ├── Footer.jsx
    │   ├── FormField.jsx
    │   ├── Header.jsx             # exibe estado de login e acesso à conta
    │   ├── Icon.jsx               # ícones SVG de conta e sacola
    │   ├── NavMenu.jsx
    │   ├── RequireAuth.jsx        # exige sessão validada no servidor
    │   └── RequireRole.jsx        # exige papel administrador (/administracao)
    ├── context
    │   ├── AuthProvider.jsx       # sessão validada no servidor, sincroniza abas
    │   ├── authContext.js
    │   ├── useAccountData.js      # endereços e listas da API
    │   └── useAuth.js
    ├── data
    │   └── products.js            # array vazio nesta etapa
    ├── pages
    │   ├── About.jsx
    │   ├── Account.jsx            # formulário de dados pessoais
    │   ├── account/               # layout e subseções de Minha Conta
    │   ├── Administration.jsx     # prévia visual do painel (administradores)
    │   ├── Checkout.jsx           # endereços, cotação e Checkout Pro de teste
    │   ├── Product.jsx            # produto da API e inclusão no carrinho
    │   ├── Auth.jsx               # formulários de login e cadastro
    │   ├── Cart.jsx
    │   ├── Catalog.jsx
    │   └── Home.jsx
    ├── services
    │   ├── api.js                 # cliente HTTP da API local (token, ApiError)
    │   ├── cart.js                # itens e cupom em forma:cart
    │   ├── shipping.js            # cotação via API
    │   ├── payments.js            # idempotência e reconciliação pós-retorno
    │   ├── account.js             # endereços, favoritos e listas via API
    │   ├── auth.js                # cadastro, login, sessão e perfil via API
    │   └── products.js            # resolução de produto pelo contrato do catálogo
    ├── styles
    │   └── global.css
    └── utils
        └── validation.js          # regras de validação dos formulários
```

## Onde ficam a persistência e o estado

- **Persistência (PostgreSQL):** conta, produtos/cupons (`0004`/`0005`),
  cotações/pedidos (`0006`) e pagamentos/reservas/eventos (`0007`)
  (executor em `server/src/db/migrations/run.js`). Senhas viram hash scrypt com
  salt; sessões guardam apenas o SHA-256 do token; endereços e listas são
  sempre filtrados por `user_id`.
- **Sessão no front:** `src/services/api.js` guarda o token em
  `forma:apiToken` e o envia em `Authorization: Bearer`. `src/services/auth.js`
  cria/encerra a sessão no servidor; `src/context/AuthProvider.jsx` valida a
  sessão (`GET /auth/eu`) a cada abertura e atualiza o estado React em
  cadastro, login, edição e logout. Outras abas da mesma origem acompanham
  entrar/sair pelo evento `storage` do token.
- **Carrinho:** `src/services/cart.js` guarda IDs/tamanhos/quantidades/cupom em
  `forma:cart`; os preços são recalculados pela API. Produtos e dados de frete
  não são tratados como valores confiáveis vindos do navegador.
- **Dados de conta:** `src/services/account.js` lê e grava endereços e listas
  em `/api/conta/...`; `src/context/useAccountData.js` carrega os dois
  conjuntos e expõe `reload` para as telas após salvar/remover.
- **Papéis:** `users.role` (`cliente`/`administrador`) definido no banco. Toda
  conta da API nasce `cliente`; `administrador` é concedido apenas por
  `npm run api:admin`. O front (`isAdmin`) só esconde rotas — a autorização
  real está em `requireAuth + requireRole` no servidor.
- **Dados antigos do navegador:** as chaves `forma:users`, `forma:session` e
  `forma:account:*` permanecem no navegador da demonstração anterior, intactas.
  O código novo não as lê nem as apaga, e nada delas é importado como
  confiável (ver "Transição do localStorage" acima).

## Identidade visual

Paleta aplicada de forma gradual no layout:

- `#E9F1FA` — hero e áreas de destaque (`--color-light`)
- `#00ABE4` — cor de destaque (`--color-primary`)
- `#FFFFFF` — superfícies (`--color-white`)

Complementos dos mockups: `#102430`, `#062D3D`, `#73828A`, `#F6F8F9` e
`#E4EBEE`. Tipografia: Helvetica, Arial, sans-serif. A fonte visual é o PDF em
`docs/forma/referencias/` e suas sete renderizações em `mockups/`. Moldura de
navegador e legendas externas não fazem parte do site. Somente a foto original
`hero-editorial.png` foi copiada para `src/assets/` e importada no banner; os
mockups completos nunca são usados como imagens da interface. O arquivo original
tem 1536 × 1024 px, aproximadamente 1,9 MB, e sua cópia mantém o mesmo SHA-256.

## Verificações desta etapa — 05/10/2026

- Build de produção executado com sucesso.
- Lint executado sem avisos; `git diff --check` sem erros de whitespace.
- Cinco testes automatizados dos serviços e das validações passaram.
- Verificação no Edge headless: cadastro, confirmação, e-mail duplicado, senha
  inválida, sessão após recarregar, perfil, logout, novo login, links do banner
  e menu mobile.
- Home, catálogo, carrinho, Sobre Nós, conta e login medidos em 1440, 1280,
  1024, 901, 768, 390 e 320 px, sem overflow horizontal, sobreposição da
  navegação no cabeçalho ou exceções JavaScript.
- Foto local carregada somente no hero; proporção desktop, `object-fit` e texto
  alternativo conferidos. Catálogo continua sem imagens e sem produtos.
- Capturas da interface desktop e mobile comparadas visualmente às referências.
- Ampliação das telas: sete testes de serviços passaram. Edge verificou criar,
  editar e recarregar endereço, criar/renomear/abrir/remover lista, separação do
  coração e da conta, e 21 telas em sete larguras (incluindo login).

Os testes automatizados usam contas fictícias e armazenamento isolado. A
verificação de responsividade desta entrega foi feita no Edge; outros
navegadores não foram testados. O consentimento promocional apenas salva a
preferência, sem enviar e-mails. Dados e sessão pertencem ao navegador e à
origem, sem sincronização entre PCs; use sempre a mesma URL durante a aula.

## Próximas etapas (planejadas)

Os itens abaixo ainda **não** estão implementados e serão adicionados nas
próximas entregas:

- Gestão completa de produtos, preços, tamanhos e promoções.
- Salvar produtos em favoritos e listas (telas e gerenciamento de listas prontos).
- Confirmação por e-mail e liberação do checkout em produção.
- Painel administrativo operacional e restrito (a prévia visual está disponível).

A partir de 14/10/2026 esta etapa autoriza back-end e banco locais, catálogo
funcional e integrações (Mercado Pago, frete, e-mail), sempre por blocos
específicos. **Não haverá hospedagem, Supabase, Vercel ou deploy.**
