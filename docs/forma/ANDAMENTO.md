# FORMA — andamento verificado

Atualização inicial do pacote: 05/10/2026.

Na preparação inicial das referências, o repositório não havia sido inspecionado.
A etapa abaixo registra a inspeção e as verificações feitas no projeto em 05/10/2026.

## Estado informado pelo aluno

- Base do front-end iniciada em 30/09/2026.
- Estilização básica com IA e início do repositório na aula de 02/10/2026.
- Próxima evolução: organização visual conforme os mockups e cadastro/login com persistência local.

## Itens inspecionados em 05/10/2026

- React/Vite, rotas, componentes, contexto e serviços de persistência existentes.
- Catálogo vazio (`src/data/products.js`), sem produtos e fotos na interface.
- Cadastro/login já usavam PBKDF2, salt e as chaves `forma:users` e `forma:session`.
- PDF original de 11 páginas consultado e sete mockups analisados visualmente.

### 05/10/2026 — refinamento visual e persistência local

- Solicitação do aluno: aproximar a interface dos mockups aprovados e conferir os
  fluxos de conta, mantendo catálogo vazio e persistência somente no navegador.
- Alterações feitas: Helvetica/Arial, paleta principal e tons complementares,
  cabeçalho com marca sublinhada e ícones SVG, hero dividido sem foto, estados
  vazios, filtros laterais e ordenação desabilitados, carrinho em duas colunas,
  conta com navegação lateral, Sobre Nós e autenticação com a mesma identidade.
- Rotas preservadas: `/`, `/catalogo`, `/sobre`, `/carrinho`, `/login` e
  `/minha-conta`. Adicionado `/cadastro` como acesso aos formulários existentes e
  mensagem para rotas desconhecidas.
- Persistência: erros de escrita/remoção agora impedem falsas confirmações;
  dados corrompidos não são apagados nem sobrescritos; registros desconhecidos
  são preservados; salt vem somente de Web Crypto. A sessão React acompanha
  mudanças locais e eventos de armazenamento de outras abas. Resumo do perfil
  exibe os valores salvos. Logout direciona ao login.
- Compatibilidade: estrutura e chaves dos dados locais, PBKDF2/SHA-256, 100.000
  iterações e salts existentes mantidos. Não foi necessária migração.
- Arquivos principais: `src/styles/global.css`, `src/pages/`,
  `src/components/Header.jsx`, `NavMenu.jsx`, `Icon.jsx`, `FormField.jsx`,
  `src/App.jsx`, `src/services/auth.js`, `storage.js`,
  `src/context/AuthProvider.jsx`, `tests/auth.test.js`,
  `scripts/check-browser.mjs`, `package.json` e README.
- Verificações executadas: build de produção passou; lint sem avisos e
  `git diff --check` sem erros de whitespace; cinco testes dos serviços
  e validações passaram. Script no Edge headless confirmou cadastro, confirmação
  de senha, duplicação de e-mail, login inválido, sessão após recarregar, edição
  de nome/preferência, atualização do cabeçalho, logout, novo login e menu mobile.
- Responsividade medida: seis telas em 1440, 1024, 768, 390 e 320 px; nenhum
  overflow horizontal, elemento de imagem ou exceção JavaScript. Capturas desktop
  e mobile analisadas visualmente; arquivos temporários em `.tmp/browser-check/`
  ficam fora do Git.
- Diferenças intencionais: hero sem fotografia; produtos substituídos por estados
  vazios; carrinho sem preços, cupons, frete ou checkout; conta limitada ao perfil
  real, sem pedidos, favoritos, endereços ou indicadores fictícios. Login,
  cadastro e Sobre Nós usam a identidade comum, sem mockups individuais.
- Pendências: produtos e imagens para etapa futura autorizada; funcionalidades
  completas do PDF, integrações e validação em outros navegadores. Autenticação
  local segue demonstrativa; não há proteção de produção nem sincronização entre
  computadores. Gravações simultâneas entre abas não têm garantia transacional.
- Não houve commit, push ou implantação. Nenhuma integração externa foi adicionada.
- Próximo passo: definido pelo aluno em uma nova solicitação.

### 05/10/2026 — banner editorial e maior fidelidade aos mockups

- Solicitação: autorizar imagens em banners e áreas institucionais, usando a foto
  original no hero e mantendo catálogo vazio, React e autenticação local.
- Referências consultadas: contexto, guia visual, sete mockups abertos visualmente
  e PDF original; conferidos no PDF os textos, a disposição dos elementos e o
  posicionamento da fotografia da Home.
- Imagem utilizada: `hero-editorial.png`, copiada para `src/assets/`, sem alteração
  do arquivo (SHA-256 igual ao original). Dimensões 1536 × 1024 px. Importação
  local pelo Vite, sem usar a página completa do mockup como banner.
- Home: divisão desktop de aproximadamente 46% texto / 54% fotografia, proporção
  externa 3,25:1, fundo azul claro, selo e texto do mockup, título em duas linhas,
  botões reais para catálogo e Sobre Nós. `object-fit: cover` e posição central
  no desktop; no mobile, blocos empilhados e imagem 4:3 com posição 65% / 50%.
  Texto alternativo e dimensões intrínsecas definidos; prioridade de carregamento
  para a imagem principal. Destaques com mensagem discreta, sem cards de produtos.
- Sistema visual: conteúdo mais largo, margens diferentes para banner e páginas,
  marca e barra azul proporcionais à referência, navegação reposicionada, ícones
  SVG de catálogo, favoritos, conta e sacola, botões e espaçamentos refinados.
  Favoritos desabilitados; ícone de busca abre o catálogo. Sem contadores fictícios.
  Removidas sombras dos estados vazios e deslocamentos dos botões no hover.
- Demais páginas: filtros e coluna lateral da conta ajustados às proporções das
  referências, títulos e espaços refinados; login, cadastro e Sobre Nós mantêm
  o sistema comum, sem novas imagens ou banners sem referência individual.
- Persistência: serviços, formato dos dados e chaves locais preservados. Nenhuma
  migração ou integração externa foi necessária.
- Arquivos principais: `src/pages/Home.jsx`, `src/assets/hero-editorial.png`,
  `src/styles/global.css`, `src/components/Header.jsx`, `Icon.jsx`,
  `scripts/check-browser.mjs`, contexto, guia visual e README.
- Verificações: build passou, lint sem avisos, cinco testes de serviços/validação
  passaram. Edge headless confirmou cadastro, login inválido, duplicação de
  e-mail, sessão após recarregar, edição de perfil, logout, novo login, links do
  banner e menu mobile. Foto local carregada, alt e `object-fit` conferidos.
- Responsividade: seis telas medidas em 1440, 1280, 1024, 901, 768, 390 e 320 px,
  sem overflow horizontal, sobreposição da navegação no cabeçalho ou exceções JS.
  Foto somente na Home; catálogo e outras páginas sem fotografias.
- Comparação visual realizada: capturas desktop e mobile abertas e comparadas com
  os mockups; corrigidos divisão do banner, recorte, posição da navegação,
  tamanho do título do catálogo, títulos de seção e espaços acima dos filtros.
  Capturas em `.tmp/browser-check/`, incluindo a Home com visitante sem sessão;
  arquivos temporários ignorados pelo Git.
- Limites: estados vazios substituem os produtos ilustrativos. Conta contém os
  dados reais do cadastro local, sem pedidos ou favoritos fictícios. Não há
  mockup mobile; adaptação verificada no Edge, sem teste em outros navegadores.
- Contexto e guia atualizados: banners e áreas institucionais com imagens estão
  autorizados; fotos/cards de produtos continuam fora desta etapa.
- Sem back-end, Supabase, Vercel, integrações, commit ou push.

### 05/10/2026 — padronização dos hovers

- Botões comuns e controles do cabeçalho usam o mesmo hover: fundo azul escuro,
  texto branco e transição de 150 ms. O clique também tem estilo compartilhado.
- As três ações de sair (cabeçalho e conta) usam a variante `logout`, com fundo
  vermelho suave, texto e borda vermelhos no hover e no clique.
- Botões desabilitados não recebem hover. As barras do menu mobile acompanham
  a cor do controle, mantendo o contraste. Foco por teclado preservado.
- Arquivos principais: `src/styles/global.css`, `src/components/Header.jsx`,
  `src/pages/Account.jsx` e README. Fluxos e persistência não foram alterados.
- Verificações: build e lint passaram; `git diff --check` sem erros. No Edge
  headless, conferidas as cores de hover na conta, Home, carrinho e catálogo,
  incluindo as três ações de logout, controles desabilitados e menu em 390 px.
- Sem commit ou push.

### 05/10/2026 — telas internas e Favoritos independente

- Solicitação: completar as telas dos mockups e as opções do perfil; o coração
  deve abrir Favoritos, e não Minha Conta.
- Referências: consultados contexto, guia, requisitos e PDF local; abertos os
  mockups de conta, produto, checkout e administração para conferir composição.
- Minha Conta: visão geral com resumos reais, pedido vazio, bloco de favoritos e
  endereço principal; menu com rotas para pedidos, favoritos, listas, endereços,
  cartões e dados pessoais. Login continua protegendo as áreas da conta.
- Favoritos independente em `/favoritos`, sem título ou menu de Minha Conta;
  coração e ícone de usuário com destinos distintos. Após login, o visitante
  retorna ao destino protegido solicitado.
- Endereços: criar, editar e remover com confirmação, validação de CEP/UF e
  obrigatórios. Listas: criar, renomear, abrir detalhes e remover com confirmação.
  Dados por usuário em `forma:account:<userId>`, versão 1; eventos de outra aba
  atualizam a conta. Nenhuma credencial ou chave anterior foi migrada ou apagada.
- Produto indisponível e checkout vazio seguem as colunas e etapas das referências.
  Administração com prévia visual pública identificada como demonstração,
  resumos zerados e tabela vazia; abas de produtos, promoções e pedidos.
- Limites mantidos: nenhum produto, pedido ou favorito fictício, nenhuma foto
  de produto, nenhum cartão cadastrado, nenhum pagamento, frete ou gerenciamento
  administrativo operacional. Não foram criados privilégios de administrador.
- Arquivos principais: `src/App.jsx`, `src/pages/account/`, `Account.jsx`,
  `Product.jsx`, `Checkout.jsx`, `Administration.jsx`, `src/services/account.js`,
  `src/context/useAccountData.js`, cabeçalho, rodapé e `src/styles/global.css`.
- Verificações realizadas: sete testes passaram, incluindo isolamento por conta,
  edição/remoção, validações, falha de gravação, corrupção e preservação de dados.
  Edge confirmou autenticação e edição do perfil, persistência e edição de
  endereço, criação/renomeação/detalhes/remoção de lista e destinos dos ícones.
  Vinte e uma telas medidas em 1440, 1280, 1024, 901, 768, 390 e 320 px,
  sem overflow horizontal, sobreposição do cabeçalho ou exceções JavaScript.
- Capturas desktop e mobile abertas e analisadas; visão geral comparada ao
  mockup de conta, checkout e administração às suas referências. Subtelas sem
  mockup individual usam o sistema visual comum. Capturas em `.tmp/`, fora do Git.
- Build final passou, lint sem avisos e `git diff --check` sem erros. Formulários
  de endereço e lista conferidos em larguras mobile; retorno ao Favoritos após
  login confirmado no navegador.
- Contexto, guia e README atualizados. Sem back-end, integração, commit ou push.

### 14/10/2026 — API local, PostgreSQL e bloco de conta

- Solicitação: implementar somente a estrutura do back-end local — `server/`
  com Node.js/Express e PostgreSQL local, migrações, validação, tratamento de
  erros e `.env.example` sem segredos; cliente HTTP reutilizável no React;
  documentação de execução local; contratos da API; padrões de centavos e de
  unidades; verificação da API; registro em `docs/forma/entregas/01-conta.md`.
  Sem commit/push e sem os demais blocos.
- Alterações feitas: API em `server/` (Express 5, `pg`, `dotenv`) com
  configuração que falha cedo sem `DATABASE_URL`, CORS restrito à origem do
  Vite, autenticação Bearer e erros padronizados (envelope `error.code`);
  executor transacional e idempotente de migrações com `schema_migrations` e a
  migração `0001_conta.sql` (`users`, `sessions`, `addresses`, `lists`);
  endpoints do bloco de conta (`/api/auth/*`, `/api/conta/enderecos`,
  `/api/conta/listas`, `/api/health`); sessão por token opaco (banco guarda
  SHA-256), senhas com scrypt; utilitários de centavos e de unidades
  (gramas/centímetros); cliente HTTP `src/services/api.js` no front; scripts
  `api` e `api:migrate` na raiz; `docs/forma/API_CONTRATOS.md`; contexto,
  README e registro de entrega atualizados.
- Verificações executadas e resultados: 21/21 testes unitários do servidor
  passaram (money, units, password/token, schemas); 28/28 testes da raiz
  continuam passando; lint sem avisos; build do front passou. API executada e
  conferida com PostgreSQL real (instância efêmera de teste em `/tmp`,
  descartada): migração aplicada e idempotente; health 503 com banco desligado
  e 200 após ligá-lo; fluxo completo por HTTP com registro (201), login
  (200/401), e-mail duplicado (409), perfil (200), CRUD de endereços e listas
  (201/200/204), validações por campo (400), nome de lista repetido (409),
  isolamento entre contas (404), logout (204) e token invalidado (401); JSON
  inválido (400), rota inexistente (404), sem token (401), banco fora
  (503 `banco_indisponivel`) e SIGTERM sem erros.
- Limites: PostgreSQL não está instalado na máquina do aluno — para uso
  permanente é preciso criar usuário/banco locais (passo 1 de
  `docs/forma/API_CONTRATOS.md`); sem isso a API responde com 503. Apenas o
  bloco de conta existe; `productIds` das listas retorna vazio até a migração
  do catálogo; nenhuma tela consome a API ainda (front aprovado preservado);
  integrações autorizadas nesta etapa, mas não implementadas.
- Não houve commit, push, hospedagem ou deploy.

### 15/10/2026 — autenticação no servidor e papéis (cliente/administrador)

- Solicitação: autenticação no servidor usando a estrutura local existente,
  preservando as telas aprovadas; substituir o `localStorage` por cadastro,
  login, logout e sessão validada no servidor; hash seguro, validações, e-mail
  único e promo desmarcado; papéis cliente/administrador com autorização
  reutilizável no back-end e comando para criar administrador sem senha fixa
  no código; adaptar AuthProvider, serviços e proteção de rotas; preservar
  dados antigos do navegador e documentar a transição sem importar
  privilégios/credenciais locais como confiáveis; testar cadastro, sessão,
  logout e bloqueio administrativo para clientes; atualizar o registro de
  entrega. Sem hospedagem, deploy ou commit/push.
- Alterações feitas: migração `0002_papeis.sql` (`users.role` com padrão
  `cliente`); `role` no usuário público da API; middleware `authorize.js`
  (`requireRole`, 403 `acesso_negado`); módulo `admin` com
  `GET /api/admin/visao-geral` e `GET /api/admin/usuarios` (exigem papel
  administrador); comando `criar-admin.js` (`npm run api:admin` na raiz ou
  `npm run admin` em `server/`) com senha por terminal oculto ou
  `ADMIN_PASSWORD`, `--promover` para contas existentes e `carregar-env.js`
  para funcionar de qualquer diretório; front refeito sobre a API:
  `services/auth.js` (token em `forma:apiToken`), `services/account.js`
  (endereços/listas em `/conta/...`), remoção de `services/storage.js`,
  `AuthProvider` validando a sessão no servidor (estado `ready`, sincronia
  entre abas, `isAdmin`), `RequireAuth` consciente do carregamento, novo
  `RequireRole` protegendo `/administracao`, telas de login/cadastro/perfil/
  endereços/listas assíncronas com os mesmos textos e visuais aprovados, e
  `check-browser.mjs` atualizado ao token e ao carregamento assíncrono.
  Documentação da transição em `API_CONTRATOS.md`, README e
  `docs/forma/entregas/02-autenticacao.md`.
- Arquivos principais: `server/src/db/migrations/0002_papeis.sql`,
  `server/src/middleware/{auth,authorize}.js`,
  `server/src/modules/admin/`, `server/src/scripts/{criar-admin,carregar-env}.js`,
  `server/tests/authz.test.js`, `src/services/{auth,api,account}.js`,
  `src/context/{AuthProvider.jsx,useAccountData.js}`,
  `src/components/{RequireAuth,RequireRole}.jsx`, `src/App.jsx`,
  `src/pages/{Auth,Account}.jsx`, `src/pages/account/`, `package.json`,
  `server/package.json`, `docs/forma/API_CONTRATOS.md`, README,
  `CONTEXTO_FORMA.md`.
- Verificações executadas e resultados: 35/35 testes passam (24 do servidor,
  incluindo os novos de `requireRole`; 11 da raiz com `fetch` simulado);
  lint sem avisos; build passou. API testada com PostgreSQL real efêmero em
  `/tmp/opencode` (binários portáveis, descartados depois): migração 0002
  aplicada e idempotente; cadastro 201 (`role: "cliente"`, `promo: false`
  por padrão), duplicado case-insensitive 409, validações 400 por campo,
  login 200/401, `GET/PATCH /auth/eu` 200, endereço e lista 201, cliente em
  rota administrativa 403 `acesso_negado`, visitante 401, logout 204 com
  token invalidado 401; `criar-admin` cria administrador (login com
  `role administrador`), rejeita senha curta/e-mail inválido/duplicado e
  `--promover` preserva a senha; cadastro enviando `"role":
  "administrador"` no corpo continua criando cliente. Interface verificada
  com Playwright + Firefox headless contra a API de teste: cadastro com
  promo desmarcada e token salvo, sessão restaurada ao recarregar, endereço
  e lista criados pela tela, cliente redirecionado de `/administracao`,
  perfil editado e logout limpando o token, e-mail duplicado como erro de
  campo, login inválido como alerta, retorno ao destino protegido e
  administrador vendo o painel aprovado; sem exceções JavaScript; captura
  do painel conferida visualmente.
- Limites: PostgreSQL continua não instalado na máquina do aluno (verificação
  com instância efêmera; para uso permanente, passo 1 de
  `API_CONTRATOS.md`); contas da demonstração local antiga não migram — é
  preciso cadastrar novamente; endereços/listas antigos do navegador não
  migram; painel administrativo segue prévia visual, agora restrita a
  administradores; outros navegadores além do Firefox (verificação) e do
  Edge (script do aluno) não foram testados.
- Não houve commit, push, hospedagem ou deploy.

### 15/10/2026 — recursos de conta persistentes (endereços, favoritos, listas)

- Solicitação: completar os recursos de conta com persistência no PostgreSQL
  local reutilizando as telas; conectar perfil e promo à API; endereços com
  seleção explícita do principal; favoritos e listas com adicionar/remover
  produtos e consultar itens usando o contrato de produtos do Gabriel;
  isolamento entre usuários e contadores reais; preservar os mockups; testar
  persistência após reiniciar a API e bloqueio de dados de outra conta; pedidos
  e cartões ficam para Lucas; registro em `docs/forma/entregas/01-conta.md`.
  Sem hospedagem ou commit/push automático.
- Alterações feitas: migração `0003_favoritos_listas_principal.sql`
  (`addresses.principal`, tabelas `favorites` e `list_items` — produtos
  referenciados por UUID do contrato do catálogo, sem FK, pois `products` é do
  bloco de produtos); rotas `PUT /conta/enderecos/:id/principal`,
  `GET/POST/DELETE /conta/favoritos`, `GET /conta/listas/:id`,
  `POST/DELETE /conta/listas/:id/itens[...]`; `productIds` reais nas listas;
  primeiro endereço nasce principal e a troca é transacional; remoção do
  principal promove o mais antigo; front: `services/products.js` (resolução de
  produto pelo contrato, único ponto de integração com o catálogo), favoritos
  e detalhe de lista com itens reais e remoção, botão "Definir como principal"
  nos endereços, visão geral com principal eleito e contadores reais de
  favoritos/listas (pedidos seguem `00`), tela de produto com ações de
  favoritar/salvar em lista quando houver peça, e recarga ao trocar de seção
  da conta; como o contrato do Gabriel não estava no repositório, adotou-se o
  formato já especificado em `API_CONTRATOS.md` — anotado na entrega.
- Arquivos principais: `server/src/db/migrations/0003_favoritos_listas_principal.sql`,
  `server/src/db/pool.js`, `server/src/modules/conta/*`,
  `server/tests/schemas.test.js`, `src/services/{products,account}.js`,
  `src/context/useAccountData.js`, `src/pages/account/*`, `src/pages/Product.jsx`,
  `tests/account.test.js`, `docs/forma/API_CONTRATOS.md`,
  `docs/forma/entregas/01-conta.md`, README.
- Verificações executadas e resultados: 40/40 testes (27 servidor, 13 raiz);
  lint sem avisos; build passou; `git diff --check` limpo. PostgreSQL efêmero
  em `/tmp/opencode`: migração 0003 aplicada e idempotente; endereço principal
  (nascimento, eleição explícita, promoção do mais antigo após remoção);
  favoritos e itens com duplicados 409 e remoções 204; isolamento total entre
  duas contas (404 em leitura/edição/eleição/itens de terceiros);
  **persistência confirmada após SIGTERM e novo start da API** (sessão,
  principal, item e favorito intactos). Interface com Playwright/Firefox:
  cadastro, eleição de principal refletida nos rótulos e visão geral,
  contadores reais (00→01→00), item de lista na tela com remoção, renomear
  lista, favorito removido pela tela, perfil persistido e dados intactos após
  reiniciar a API; sem exceções JS; capturas conferidas visualmente.
- Limites: catálogo vazio (bloco de Gabriel) — não há peças para favoritar nas
  telas ainda; itens salvos aparecem como "Produto indisponível" até a tabela
  `products` existir; pedidos e cartões seguem para Lucas (contadores `00`);
  PostgreSQL não instalado na máquina do aluno (verificação com instância
  efêmera); outros navegadores não testados.
- Não houve commit, push, hospedagem ou deploy.

### 15/10/2026 — Lucas: frete e checkout

- Solicitação: conectar carrinho, catálogo, endereços e cupons ao checkout;
  cotar Melhor Envio inicialmente no Sandbox com OAuth e segredos no servidor;
  invalidar cotação por mudança de endereço/carrinho; autenticar a confirmação;
  documentar a entrega, sem cobrança, etiqueta, envio, hospedagem ou commit/push.
- Alterações: corrigidos imports de pool que impediam a API de carregar;
  conectadas leitura de produtos, resumo/cupom do carrinho, cotações e criação
  transacional de pedidos; carrinho local guarda apenas IDs/tamanhos/quantidades
  e cupom, enquanto preço e desconto são recalculados na API. Endereço, produtos,
  dimensões, quantidade, preço e serviço da cotação são conferidos no servidor.
- Melhor Envio: somente host Sandbox e escopo `shipping-calculate`; script OAuth
  valida `state`, troca authorization code e grava tokens em `server/.local/`
  (ignorado pelo Git). Renovação trata 401 no servidor. Interface mostra apenas
  serviços/preços/prazos realmente retornados. Pedido nasce
  `aguardando_pagamento`; Mercado Pago, etiquetas, envio e e-mail permanecem
  fora desta etapa.
- Persistência: migração nova `0006_frete_checkout.sql` cria snapshots de
  cotações, pedidos e itens. Migrações não foram aplicadas ao PostgreSQL local;
  executar `npm run api:migrate` conforme o guia depois de conferir a configuração.
- Documentação: `docs/forma/entregas/03-compra.md` contém sandbox, OAuth,
  variáveis, endpoints e roteiro manual; contratos, README, guia visual e
  CONTEXTO_FORMA.md foram alinhados ao escopo autorizado.
- Verificações: `npm test` 44/44 passou; build passou; importação da aplicação
  Express passou; `git diff --check` limpo. Checkout carregado no navegador sem
  exceções após corrigir um estado de inicialização; largura sem overflow em
  1440 px e 390 px. Lint com um aviso preexistente em
  `src/pages/admin/AdminProducts.jsx` (parâmetro `err` não usado).
- Limites: cotação real não executada sem autorização/credenciais sandbox,
  produtos e endereço locais configurados. Sem chamadas externas reais, alteração
  no banco, compra, envio, commit, push ou deploy.

### 15/10/2026 — Lucas: pedidos e Mercado Pago (teste)

- Solicitação: persistir snapshots de pedidos/itens; revalidar preço/desconto/
  estoque; reservar/liberar estoque; evitar pedidos e eventos duplicados; criar
  pagamento Mercado Pago de teste; validar webhooks consultando o gateway;
  manter credenciais no backend; documentar túnel HTTPS. Sem cobrança real,
  hospedagem, etiquetas/envios ou commit/push.
- Implementação: checkout exige chave `checkoutKey` e usa fingerprint/advisory
  lock; reservas de variante são debitadas dentro da mesma transação do pedido,
  vencem em 30 minutos e são liberadas no sweep local, recusa ou cancelamento.
  Pedido/itens guardam características, endereço, frete e preços em snapshots.
- Pagamento: SDK oficial Mercado Pago Node; somente `MERCADOPAGO_MODE=sandbox`
  + `MERCADOPAGO_TEST_ACCESS_TOKEN`; Checkout Pro envia referência/preferência do
  pedido, usa idempotency key estável e só devolve `sandbox_init_point`. Pagamento
  confirmado exige HMAC oficial e consulta do recurso (`external_reference`, ID,
  valor, BRL e `live_mode=false`); ID da preferência permanece vinculado no
  pedido local. Redirect não confirma. Evento
  repetido, cupom e transição/estoque são protegidos por chave única/transação;
  aprovação após cancelamento e chargeback vão para revisão manual.
- Cartões salvos: Checkout Pro hospedado permite o comprador usar meios salvos
  na própria conta Mercado Pago. FORMA não grava PAN/CVV/validade; a tela Cartões
  informa esse limite.
- Migração/documentação: `0007_pagamento_estoque_idempotencia.sql`, contratos,
  README, contexto e `docs/forma/entregas/04-pagamento.md` atualizados. Túnel
  HTTPS temporário documentado com configuração de Webhooks em modo teste.
- Verificações: `npm test` passou 49/49; `npm test --prefix server` passou
  35/35; `npm run build` passou; `npm run lint` sem avisos; importação de
  `server/src/app.js` e `git diff --check` passaram. Testes usam HMAC/retornos
  determinísticos sem chamadas/cobranças externas. Checkout carregado no Edge;
  estado vazio/auth correto e texto atualizado, sem overflow em 1440 px e
  390 px.
- Limitações: `psql`/PostgreSQL local não disponível; migração e transações SQL
  não foram executadas. Sem credenciais do Mercado Pago nem URL pública de túnel,
  teste end-to-end de preferência/webhook não foi realizado. Túnel é temporário;
  nenhuma cobrança real, etiqueta, envio, commit, push ou deploy.

## Registro de próximas alterações

Copiar e preencher este modelo para cada etapa concluída:

### Data / etapa

- Solicitação do aluno:
- Alterações feitas:
- Arquivos principais:
- Verificações executadas e resultados:
- Pendências:
- Próximo passo autorizado:
