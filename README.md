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
- Catálogo com filtros laterais e ordenação visíveis e desabilitados enquanto
  não houver produtos, sem simular resultados.
- Carrinho com estado vazio à esquerda e resumo sem valores à direita.
- Minha Conta com visão geral conforme o mockup e rotas para pedidos, favoritos,
  listas de compras, endereços, cartões e dados pessoais.
- Favoritos em página própria pelo coração do cabeçalho, com estado vazio;
  o ícone de usuário abre Minha Conta.
- Endereços: criar, editar, remover com confirmação e consultar endereço principal.
- Listas: criar, renomear, abrir detalhes e remover com confirmação; sem produtos.
- Produto com estado indisponível e divisão visual da referência, sem fotos ou preços.
- Checkout com identificação, endereço, pagamento e resumo vazio; sem finalização.
- Administração com prévia visual da visão geral, produtos, promoções e pedidos.
  A prévia é pública e não permite operações administrativas.
- Sobre Nós, login e cadastro com o mesmo sistema visual.
- Estados vazios organizados do catálogo e do carrinho, com mensagem e ação.
- Formulários de login e cadastro com rótulos claros e mensagens de validação.
- Rodapé com marca, links de navegação e aviso de direitos.
- Layout responsivo para desktop e celular.

### Cadastro e login locais (demonstração)

- Cadastro com nome, e-mail, senha e confirmação de senha.
- Opção "Quero receber promoções por e-mail", **desmarcada por padrão**.
- Validações: campos obrigatórios, formato de e-mail, senhas diferentes e
  e-mail já cadastrado.
- Login com verificação das credenciais cadastradas.
- Usuários e sessão persistem no `localStorage` após atualizar ou reabrir a
  página.
- Logout e página **Minha Conta**, onde é possível consultar e editar nome e
  preferência promocional.
- Cabeçalho com acesso à conta pelo ícone de usuário e nome + Sair quando logado.
  O nome fica oculto em desktops estreitos, mantendo o rótulo acessível da conta.
- Proteção demonstrativa da rota `/minha-conta`: visitantes são redirecionados
  para `/login` e voltam à conta após entrar.
- Alterações de usuário, perfil e sessão em outra aba da mesma origem atualizam
  o estado React pelo evento `storage`. Logout leva ao login.
- Falhas ao gravar cadastro, sessão ou perfil e ao encerrar a sessão exibem erro,
  sem simular sucesso com um armazenamento temporário em memória.

### Limites desta etapa

- Catálogo permanece **vazio** (sem imagens ou produtos fictícios).
- Imagens em banners e áreas institucionais autorizadas. Nesta entrega, somente
  o banner principal recebeu a foto aprovada; as demais páginas não receberam
  banners ou fotografias extras. Favoritos abre sua tela vazia pelo coração;
  o ícone de busca dá acesso ao catálogo.
- CSS simples, reaproveitando os componentes existentes.
- Sem pagamento, frete ou checkout funcional. A tela de checkout é uma prévia
  com carrinho vazio e finalização desabilitada. Cartões não são cadastrados.
- As telas continuam usando `localStorage`; a conexão gradual delas com a API
  local acontece em etapas próprias. Nenhuma tela foi alterada na entrega da
  API (14/10/2026).

## Aviso importante sobre a autenticação

> A autenticação implementada aqui é **apenas para fins acadêmicos** e roda
> inteiramente no navegador do usuário. Ela **não** oferece a segurança de uma
> autenticação feita no servidor: qualquer pessoa com acesso ao dispositivo
> pode inspecionar ou apagar os dados salvos.

Para reduzir o risco didático, as senhas **não são salvas em texto puro**: cada
senha é transformada em um hash usando a **Web Crypto API** com **PBKDF2**
(SHA-256, salt aleatório por usuário e 100.000 iterações). Ainda assim, use
somente **dados fictícios** e nunca uma senha real nesta demonstração.

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
`docs/forma/API_CONTRATOS.md`. Nesta entrega, o bloco implementado é o de
**conta** (cadastro, sessão, perfil, endereços e listas).

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

# 3. Aplicar as migrações (cria as tabelas do bloco de conta)
npm run api:migrate

# 4. Em um terminal: subir a API em http://localhost:3333
npm run api

# 5. Em outro terminal: subir o front em http://localhost:5173
npm run dev
```

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
12. Abra `/checkout` e `/produto`: estados vazios, sem simular compra ou produto.
13. Abra `/administracao` e navegue por produtos, promoções e pedidos; trata-se
    somente de uma prévia visual, sem gerenciamento habilitado.

As rotas `/login` e `/cadastro` exibem os dois formulários. As demais rotas são
`/`, `/catalogo`, `/sobre`, `/carrinho` e `/minha-conta`. Um endereço desconhecido
mostra uma mensagem de página não encontrada. Novas rotas: `/favoritos`,
`/produto`, `/produto/:id`, `/checkout`, `/minha-conta/{pedidos,favoritos,listas,
enderecos,cartoes,dados}`, `/minha-conta/listas/:id`, `/minha-conta/pedidos/:id`
e `/administracao/{produtos,promocoes,pedidos}`. A raiz de cada área abre sua
visão geral; pedidos inexistentes e listas inexistentes exibem estados próprios.

Para repetir a verificação automatizada no navegador, mantenha
`npm run dev -- --host 127.0.0.1` ativo e execute em outro terminal:

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
├── server                       # API local: Express + PostgreSQL (bloco de conta)
│   ├── package.json             # scripts: dev, migrate, test
│   ├── .env.example             # variáveis locais, sem segredos
│   ├── src/config.js            # variáveis de ambiente com falha cedo
│   ├── src/app.js               # fábrica do Express e rotas
│   ├── src/index.js             # escuta e encerramento gentil
│   ├── src/db                   # pool do PostgreSQL e migrações (0001_conta.sql)
│   ├── src/middleware           # CORS, autenticação Bearer e erros padronizados
│   ├── src/modules              # health, auth e conta (endereços, listas)
│   ├── src/utils                # validate, password (scrypt), token, money, units
│   └── tests                    # testes unitários da API
├── tests/auth.test.js           # serviços locais e validações
├── scripts/check-browser.mjs    # checagem opcional no Edge headless
└── src
    ├── assets
    │   └── hero-editorial.png     # cópia local da foto original aprovada
    ├── App.jsx                    # definição das rotas (inclui rota protegida)
    ├── main.jsx                   # ponto de entrada, BrowserRouter e AuthProvider
    ├── components
    │   ├── Button.jsx
    │   ├── EmptyState.jsx
    │   ├── Footer.jsx
    │   ├── FormField.jsx
    │   ├── Header.jsx             # exibe estado de login e acesso à conta
    │   ├── Icon.jsx               # ícones SVG de conta e sacola
    │   ├── NavMenu.jsx
    │   └── RequireAuth.jsx        # proteção demonstrativa de rota
    ├── context
    │   ├── AuthProvider.jsx       # mantém o estado do React sincronizado
    │   ├── authContext.js
    │   └── useAuth.js
    ├── data
    │   └── products.js            # array vazio nesta etapa
    ├── pages
    │   ├── About.jsx
    │   ├── Account.jsx            # formulário de dados pessoais
    │   ├── account/               # layout e subseções de Minha Conta
    │   ├── Administration.jsx     # prévia visual do painel
    │   ├── Checkout.jsx           # etapas com carrinho vazio
    │   ├── Product.jsx            # produto indisponível nesta etapa
    │   ├── Auth.jsx               # formulários de login e cadastro
    │   ├── Cart.jsx
    │   ├── Catalog.jsx
    │   └── Home.jsx
    ├── services
    │   ├── api.js                 # cliente HTTP da API local (token, ApiError)
    │   ├── account.js             # endereços e listas por usuário
    │   ├── auth.js                # cadastro, login, sessão e PBKDF2
    │   └── storage.js             # leitura/escrita centralizada no localStorage
    ├── styles
    │   └── global.css
    └── utils
        └── validation.js          # regras de validação dos formulários
```

## Onde ficam a persistência e o estado

- **Persistência (localStorage):** `src/services/storage.js` centraliza toda a
  leitura e escrita (`readJSON`, `writeJSON`, `removeItem`) e trata dados
  ausentes ou corrompidos sem apagar o conteúdo original. Operações de escrita
  interrompem a atualização se a lista de usuários for ilegível, evitando
  substituir dados existentes por uma lista vazia. Registros desconhecidos da
  lista também são preservados ao cadastrar ou editar usuários válidos.
- **Regras de autenticação:** `src/services/auth.js` usa as chaves
  `forma:users` (lista de usuários) e `forma:session` (sessão ativa). É nele que
  ficam o hash PBKDF2, o salt, o cadastro, o login, o logout e a edição do
  perfil.
- **Compatibilidade dos dados:** chaves, estrutura, salt e parâmetros do PBKDF2
  existentes foram mantidos. Não foi necessária migração; contas já cadastradas
  continuam usando o mesmo formato. O cadastro relê a lista após gerar o hash
  para preservar registros adicionados durante essa espera. Não existe garantia
  transacional entre gravações simultâneas em abas diferentes.
- **Estado do React:** `src/context/AuthProvider.jsx` (com `useAuth`) é quem
  atualiza o usuário em memória após cadastro, login, edição e logout. Os
  componentes consomem esse estado através de `useAuth()`.
- **Dados adicionais da conta:** `src/services/account.js` salva endereços e
  listas em `forma:account:<userId>`, versão 1. Não modifica as credenciais nem
  exige migração dos usuários existentes. Campos desconhecidos são preservados;
  JSON inválido e versões desconhecidas bloqueiam gravação. `useAccountData`
  acompanha alterações da mesma conta em outra aba pelo evento `storage`.

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

- Cadastro de produtos e suas imagens (a foto do banner já está disponível).
- Filtros e ordenação do catálogo.
- Salvar produtos em favoritos e listas (telas e gerenciamento de listas prontos).
- Utilizar endereços no fluxo de compra (gerenciamento local já disponível).
- Cupons de desconto.
- Checkout com cadastro obrigatório.
- Integração com Mercado Pago e cálculo de frete.
- Envio de e-mails.
- Painel administrativo operacional e restrito (a prévia visual está disponível).

A partir de 14/10/2026 esta etapa autoriza back-end e banco locais, catálogo
funcional e integrações (Mercado Pago, frete, e-mail), sempre por blocos
específicos. **Não haverá hospedagem, Supabase, Vercel ou deploy.**
