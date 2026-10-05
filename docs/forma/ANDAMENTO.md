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

## Registro de próximas alterações

Copiar e preencher este modelo para cada etapa concluída:

### Data / etapa

- Solicitação do aluno:
- Alterações feitas:
- Arquivos principais:
- Verificações executadas e resultados:
- Pendências:
- Próximo passo autorizado:
