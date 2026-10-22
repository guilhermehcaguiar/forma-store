# FORMA

Para preparar **o ambiente local deste projeto** pela primeira vez (Linux com
os binários PostgreSQL `initdb` e `pg_ctl` instalados), execute:

```bash
npm run api:setup
npm run api:admin:demo
npm run api
# Em outro terminal:
npm run dev
```

`api:setup` cria/inicia PostgreSQL exclusivo em `127.0.0.1:55434`, gera
`server/.env` com senha aleatória privada, aplica as migrações e carrega o
catálogo. Os dados persistem em `.local/postgres`; dados e credenciais são
ignorados pelo Git. Repetir o comando preserva dados e estoque. Após reiniciar
o computador, rode `npm run db:local` antes da API (ou repita `api:setup`).
Uma configuração `server/.env` preexistente não é substituída automaticamente;
nesse caso, use o PostgreSQL nela configurado e os comandos de migração/seed.

Se aparecer `DATABASE_URL não definida`, falta essa preparação/configuração.
Saúde da API: `http://localhost:3333/api/health`.

Estado atual — 22/10/2026: vitrine, catálogo, detalhes, imagens e
gestão administrativa usam a API/PostgreSQL. Há seed opcional de **12 peças
demonstrativas**, com seis cores, P/M/G/GG e quatro promoções. O gerenciamento de cartões tokenizados e pagamento direto foi implementado localmente;
a homologação externa permanece bloqueada por credenciais sandbox ausentes. Evidências e
limitações estão em [AUDITORIA_REQUISITOS.md](docs/forma/AUDITORIA_REQUISITOS.md).

```bash
# Banco e server/.env configurados conforme instalação abaixo:
npm run api:migrate
npm run api:seed
npm run api
# Em outro terminal:
npm run dev
```

O seed é transacional e usa IDs fixos. Repeti-lo não duplica produtos, tamanhos
ou imagens e **não repõe estoque, não reativa peças nem sobrescreve preços,
datas ou edições**. Insere peças demonstrativas ausentes; substitui somente URLs SVG conhecidas por WebP
quando cor/estampa ainda correspondem à coleção. Descrições antigas só mudam por
comparação exata; uploads e descrições editadas são preservados.
Dados: `server/src/db/demo-products.js`; executor: `server/src/db/seed-demo.js`.
Imagens: `public/products/` — foto preta original somente na Lavada Preta e
onze imagens individuais geradas por IA, identificadas no texto alternativo e na descrição.
Origem e prompts: [IMAGENS.md](docs/forma/IMAGENS.md). Originais SVG permanecem para
referências de pedidos anteriores; a coleção atual usa WebP. A peça Concreto Cinza
está esgotada para testar indisponibilidade. Isso não configura pagamento,
frete ou e-mail real; essas integrações mantêm os limites das entregas anteriores.


### Administrador de demonstração e cartões — 22/10/2026

```bash
npm run api:admin:demo
```

Entre em `http://localhost:5173/login` com **admin@forma.local** e
**FormaDemo2026!** — **credencial exclusiva do ambiente local de demonstração**,
nunca de produção ou banco remoto. Abra `/administracao/produtos` ou `/administracao/pedidos`.
A conta usa scrypt e autenticação normal. O comando só aceita `development`/`test`
e PostgreSQL em loopback; em produção ou banco remoto falha antes de gravar.
A política central também protege os runners e testes diretos: URLs com qualquer
query/fragmento ou variáveis indiretas `PG*` são recusadas antes da conexão. Use a
URL completa em `DATABASE_URL`/`FORMA_TEST_DATABASE_URL`, sem parâmetros de host
ou serviço, e remova variáveis `PGHOST`, `PGPORT`, `PGSERVICE` etc. do terminal.
`localhost` é fixado em `127.0.0.1` nos clientes locais protegidos; o peer TCP e a
identidade do servidor/banco são conferidos antes dos comandos de escrita.
Se o e-mail já existir, preserva senha, nome e papel: não promove uma conta
preexistente nem restaura a senha demonstrativa. A CLI `api:admin` permanece
para criar seu administrador próprio.

Em `/minha-conta/cartoes`, o cliente lista/adiciona/remove cartões via Mercado
Pago. Número, validade e CVV entram em Secure Fields do SDK oficial; só o token
temporário necessário chega à API. Pagamento com cartão salvo aparece após
registrar o pedido e no detalhe do histórico; Checkout Pro continua disponível.
A primeira tentativa define o método para aquele pedido. Cartão salvo paga em
uma parcela; reenvio/concorrência não inicia outra cobrança. Após timeout,
aguarde webhook ou reconcilie o ID seguro do pagamento, sem reenviar token.
A migração `0012` conserva IDs esperados de cliente/cartão na tentativa para
validar a reconciliação mesmo após remover um cartão da carteira.

Sem `MERCADOPAGO_TEST_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, callback HTTPS e
segredo de webhook, não há homologação do sandbox. O pagamento com cartão salvo
exige callback em endereço HTTPS público e segredo
válido: ausência/configuração inválida retorna 503 antes de criar tentativa ou
consultar/cobrar no gateway. A carteira retorna `publicKey=null`, e a UI oculta o
pagamento direto enquanto a configuração estiver incompleta. Checkout Pro mantém
seu fluxo independente. Nenhum cartão ou pagamento é inventado. Consulte
[ENTREGA_LOCAL.md](docs/forma/ENTREGA_LOCAL.md) para resultados, reprodução dos
135 checks de navegador e roteiro externo. A matriz completa dos 40 requisitos
está em [AUDITORIA_REQUISITOS.md](docs/forma/AUDITORIA_REQUISITOS.md).

### Carrinho e perfil — atualização de 16/10/2026

O carrinho confere preços/estoque na API, limita quantidades e mantém itens
indisponíveis visíveis para remover. Mudanças de preço exigem aceite explícito;
cupom e totais são recalculados. A API é consultada novamente antes de avançar,
cotar e confirmar, além da recarga/retorno à aba. Falhas de rede bloqueiam avanço
e permitem atualizar/remover. A seleção continua por navegador, sem sincronização
por conta; preço local é só referência visual, não é confiado pelo servidor.

Em `/minha-conta/dados`, nome/opt-in continuam editáveis. E-mail e senha têm
formulários separados que exigem senha atual. Nova senha: 6–128 caracteres e
confirmação. Troca bem-sucedida preserva a sessão atual e revoga as outras;
erros não alteram a conta. Não há envio real de e-mail, verificação do novo
endereço por link ou recuperação de senha nesta etapa. Sem migração nova.

### Gestão administrativa de produtos

Depois de `npm run api:migrate` (inclui `0009_admin_produtos.sql`), entre com uma
conta administradora e abra `/administracao/produtos`. Use **Novo produto** ou
**Editar produto** na lista; o filtro de status também mostra peças inativas.
O comando de criação/promoção de administrador está abaixo; nenhuma conta pública
nasce administradora.

É possível editar nome, descrição, cor, estampa, tamanhos P/M/G/GG e estoque,
preços normal/promocional em reais, peso/embalagem, imagens e status. Cada peça
representa uma cor. Promoção vazia encerra o desconto; produto inativo sai da
vitrine. Uploads locais PNG/JPEG/WebP têm limite de cinco imagens e 5 MB por
arquivo; escolha a imagem principal na galeria. Não se exigem URLs externas.

Estoque disponível já exclui reservas. Para evitar sobrescrever vendas, uma
edição desatualizada é recusada e oferece reabrir o produto. Reservas pendentes
protegem alterações comerciais. Retirar um tamanho preserva seu ID/estoque e
pedidos antigos mantêm dados e imagens. O painel `/administracao/pedidos` consulta os últimos 200 pedidos, filtra estados
e apresenta itens históricos, total e situação do pagamento, sem permitir forçar aprovação.
Contrato e limites: [API_CONTRATOS.md](docs/forma/API_CONTRATOS.md).

### E-mail de confirmação de compra — atualização de 16/10/2026

O RF18 possui transporte SMTP implementado e testado com capturador local; entrega externa não homologada. Quando o pagamento de um pedido é
efetivamente aprovado (webhook assinado ou reconciliação que consulta o
gateway), a transição para `pago` enfileira o e-mail `purchase_confirmation`
na mesma transação, com número do pedido, itens, valores
(subtotal/desconto/frete/total) e endereço de entrega do snapshot. No
enfileiramento, a `event_key` única absorve webhook repetido e reconciliação
repetida: um mesmo evento nunca produz duas linhas. No transporte, o worker é
**at-least-once** — uma falha exatamente entre o servidor SMTP aceitar a
mensagem e o registro `sent` pode reenviá-la na recuperação de lease vencido;
o que as guardas garantem é que dois workers nunca enviem a mesma
reivindicação simultaneamente. O opt-in promocional é independente —
desmarcar promoções nunca bloqueia a confirmação da compra. Dados de
pagamento não entram na mensagem.

`FORMA_EMAIL_MODE=smtp` ativa a entrega por SMTP configurável
(`FORMA_SMTP_HOST`, `FORMA_SMTP_PORT`, `FORMA_SMTP_SECURE=none|starttls|ssl`,
`FORMA_SMTP_USER/PASS`, `FORMA_EMAIL_FROM`, `FORMA_EMAIL_MAX_ATTEMPTS`).
Falha de SMTP fica registrada em `last_error` com nova tentativa em backoff
exponencial; o pedido permanece intacto em qualquer cenário.
`FORMA_EMAIL_MODE=mock` continua sendo modo **explícito** de
desenvolvimento/teste: grava apenas prévias locais (`mock_message`), nunca se
apresenta como entrega e nenhuma conexão de saída acontece. Sem a variável, o
padrão é mock e a inicialização da API avisa isso claramente.

Desenvolvimento local com Mailpit: instale o binário do
[Mailpit](https://github.com/axllent/mailpit), execute `mailpit` (SMTP em
`127.0.0.1:1025`, interface web em <http://127.0.0.1:8025>) e configure no
`server/.env`:

```bash
FORMA_EMAIL_MODE=smtp
FORMA_SMTP_HOST=127.0.0.1
FORMA_SMTP_PORT=1025
FORMA_SMTP_SECURE=none
FORMA_EMAIL_FROM=no-reply@forma.local
```

A mensagem capturada no Mailpit comprova entrega até o servidor local em
loopback; **não equivale a homologação de entrega externa**. Envio por
provedores reais (TLS/AUTH/SPF/entregabilidade) segue pendente de homologação
manual, como frete e Mercado Pago. Após esgotar as tentativas, a linha
permanece `failed` com o erro; reenvio manual:

```sql
UPDATE email_outbox SET status = 'queued', next_attempt_at = NULL, last_error = NULL
 WHERE id = '<id da mensagem>';
```

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
  direita (54%), com recorte responsivo sem distorção. Quatro destaques
  disponíveis são carregados da API.
- No mobile, o texto e a foto são empilhados; a imagem continua visível e mantém
  o modelo e a camisa enquadrados.
- Catálogo com filtros laterais e ordenação conectados à API; permanece vazio
  quando não houver produtos reais cadastrados.
- Carrinho compartilhado entre produto, carrinho e checkout, com quantidades,
  remoção e subtotais/validação de cupom recalculados pelo servidor.
- Minha Conta com visão geral conforme o mockup e rotas para pedidos, favoritos,
  listas de compras, endereços, cartões e dados pessoais.
- Favoritos persistidos em página própria pelo coração do cabeçalho;
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
  também podem ser gerenciados pela FORMA via Customers/Cards oficiais, sem PAN/CVV
  ou token persistido. Webhooks assinados reconciliam pagamentos consultando o gateway.
  Todos os fluxos externos ainda precisam de homologação com credenciais de teste.
- Administração com gestão de produtos, preços, estoque e promoções e consulta de pedidos,
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

- Catálogo usa as 12 peças demonstrativas do seed e imagens locais; banco sem produtos exibe estado vazio.
- Hero com a foto editorial preexistente; catálogo com imagens locais próprias
  e representações IA identificadas. Favoritos abre a seleção salva pelo coração;
  o ícone de busca dá acesso ao catálogo.
- CSS simples, reaproveitando os componentes existentes.
- Somente credenciais e checkout Mercado Pago de teste. Não há cobrança real,
  compra de etiquetas ou envio. Confirmações e mudanças de status entram no
  outbox `email_outbox`; `FORMA_EMAIL_MODE=smtp` entrega por SMTP configurável
  (Mailpit local em desenvolvimento), enquanto `FORMA_EMAIL_MODE=mock`
  permanece como prévia explícita de desenvolvimento/teste, sem entrega.
- Cotação depende de credenciais OAuth do Melhor Envio Sandbox, CEP de origem,
  produtos com peso/dimensões e endereços com CEP válidos. Sem credenciais, não
  são exibidas cotações estimadas.
- Autenticação, perfil, endereços (com principal explícito), favoritos,
  listas, catálogo, resumo/cupom, frete e pedidos consomem módulos da API local.
  O carrinho fica no navegador; o servidor refaz preços e descontos. O painel
  de administração gerencia produtos, preços, tamanhos, estoque e promoções e consulta
  pedidos, restrito a administradores. Favoritos/listas consultam produtos na API
  após recarga; peças retiradas do catálogo aparecem como "Produto indisponível".

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

No comando personalizado `api:admin`, a senha não fica no código. Em scripts sem terminal, use
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
  e pagamentos de teste pelo Mercado Pago Checkout Pro e cartão salvo (Payments API). O guia de frete está em
  `docs/forma/entregas/03-compra.md` e
  `docs/forma/entregas/04-pagamento.md`.

### Configuração e credenciais locais

Instale dependências com `npm ci` e `npm ci --prefix server`. Os exemplos
[.env.example](.env.example) e [server/.env.example](server/.env.example)
contêm somente valores fictícios. Marcadores `FICTICIO`/`TROQUE` não habilitam
integrações. Reinicie API/Vite após editar o ambiente; refaça o build do frontend
se mudar a URL da API. Não coloque credenciais na linha de comando ou no Git.

| Ambiente/variável | Como configurar / onde obter |
| --- | --- |
| Servidor: `NODE_ENV`, `PORT`, `DATABASE_URL` | `development`, porta `3333`; `npm run db:local` gera senha aleatória e PostgreSQL loopback `55434`. Se já tem banco, use usuário/senha criados **nesse banco local**, nunca uma URL de produção. |
| Servidor: `CORS_ORIGIN` | Origem exata do Vite, padrão `http://localhost:5173`. Se usar `127.0.0.1`, ajuste também as URLs abaixo. |
| Autenticação: `SESSION_TTL_DAYS` | Prazo das sessões, padrão `7`. O código usa sessões opacas aleatórias, hash SHA-256 no banco e senha scrypt; **não há `JWT_SECRET` nem `SESSION_SECRET` a obter/configurar**. O token de sessão é privado por conta. |
| MP: `MERCADOPAGO_MODE`, `MERCADOPAGO_TEST_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY` | Mantenha `sandbox`. No [Painel de integrações Mercado Pago](https://www.mercadopago.com.br/developers/panel/app), crie/selecione a aplicação e abra **Credenciais de teste**. Use Access Token e Public Key da mesma aplicação/ambiente, com vendedor/comprador de teste distintos. [Credenciais oficiais](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/credentials). |
| MP: `MERCADOPAGO_WEBHOOK_SECRET` | Na aplicação, configure **Webhooks** de pagamentos em modo teste, copie a assinatura secreta para o servidor. [Configuração oficial](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks). Nunca a Public Key neste campo. |
| MP: `MERCADOPAGO_PUBLIC_URL` / `MERCADOPAGO_FRONTEND_URL` | Túnel HTTPS temporário **da API**, por exemplo o endereço gerado por `ngrok http 3333`; webhook em `/api/pagamentos/webhook`. Frontend local `http://localhost:5173`; retorno entra em `/checkout`. O domínio `example.invalid` do exemplo não funciona. Mantenha relógio do computador sincronizado: assinatura tolera 300 segundos. |
| Melhor Envio: `MELHOR_ENVIO_CLIENT_ID`, `MELHOR_ENVIO_CLIENT_SECRET`, `MELHOR_ENVIO_REDIRECT_URI` | Conta/aplicativo **sandbox** em [Sandbox Melhor Envio](https://sandbox.melhorenvio.com.br/), Integrações → Área Dev. Registre exatamente o redirect local (`http://localhost:3333/api/health`, por padrão), obtenha Client ID/Secret e execute `npm run api:melhor-envio:autorizar`. A CLI recebe a URL de retorno com code no terminal e a troca por tokens; não é um callback OAuth implementado na rota health. [OAuth oficial](https://docs.melhorenvio.com.br/reference/fluxo-de-autoriza%C3%A7%C3%A3o). |
| Melhor Envio: `MELHOR_ENVIO_ACCESS_TOKEN`, `MELHOR_ENVIO_REFRESH_TOKEN` | O OAuth acima salva tokens em `server/.local/melhor-envio-tokens.json` ignorado pelo Git. Alternativamente, configure tokens **sandbox** obtidos no fluxo oficial no `.env`; nunca em `VITE_*`. A base sandbox é fixa no código. |
| Melhor Envio: `MELHOR_ENVIO_ORIGIN_CEP`, `MELHOR_ENVIO_USER_AGENT` | CEP válido do remetente da demonstração e nome/contato do aplicativo; não são segredos. |
| E-mail: `FORMA_EMAIL_MODE`, `FORMA_EMAIL_FROM`, `FORMA_EMAIL_MAX_ATTEMPTS` | `mock` (prévia sem envio) ou `smtp`; remetente autorizado pelo seu provedor; tentativas padrão `5`. |
| SMTP: `FORMA_SMTP_HOST/PORT/SECURE/USER/PASS` | Para [Mailpit](https://github.com/axllent/mailpit), `127.0.0.1:1025`, `none` e **USER/PASS vazios**; interface de captura `http://localhost:8025`. Para entrega externa, obtenha host, porta, usuário e senha de aplicação no painel/documentação do **seu provedor SMTP**, com `starttls:587` ou `ssl:465` e remetente verificado. Captura local não comprova entrega externa. |
| Frontend: **somente** `VITE_API_URL` | URL pública da API, padrão `http://localhost:3333/api`. Sem usuário/senha, query ou fragmento. O Vite recusa qualquer outro `VITE_*`; nunca coloque segredos nesse prefixo. |

A **Public Key** do Mercado Pago é a exceção pública: inicializa o SDK no
navegador, conforme o contrato do provedor. A FORMA a fornece no endpoint
autenticado `/api/conta/cartoes`, somente quando configurada e com formato de
Public Key. Isso não autoriza expor Access Token, segredo de webhook, tokens
OAuth de frete, senha SMTP/banco ou sessões de outras contas. Campos de cartão
são montados pelo SDK; a API aceita só token opaco temporário, sem persistir
esse token. Arquivos privados também são negados pelo Vite em desenvolvimento.
A documentação do [Vite](https://vite.dev/guide/env-and-mode) explica que
variáveis `VITE_*` são publicadas no cliente.

Auditoria de segurança, resultados executados e limites da homologação:
[AUDITORIA_SEGURANCA.md](docs/forma/AUDITORIA_SEGURANCA.md).

### Executando banco, API e front localmente

Pré-requisitos: Node.js 20.19+ ou 22.12+ e PostgreSQL 14+ instalados na máquina.

```bash
# 1. Recomendado: banco isolado e senha local aleatória (não substitui .env existente)
npm run db:local

# 2. Frontend (opcional; padrão localhost:3333/api)
cp .env.example .env
# API: db:local já prepara server/.env. Para banco próprio, copie server/.env.example
# e configure DATABASE_URL com a senha PRIVADA do seu PostgreSQL local.

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
    promoções e consulta dos pedidos e seus estados.

As rotas `/login` e `/cadastro` exibem os dois formulários. As demais rotas são
`/`, `/catalogo`, `/sobre`, `/carrinho` e `/minha-conta`. Um endereço desconhecido
mostra uma mensagem de página não encontrada. Novas rotas: `/favoritos`,
`/produto`, `/produto/:id`, `/checkout`, `/minha-conta/{pedidos,favoritos,listas,
enderecos,cartoes,dados}`, `/minha-conta/listas/:id`, `/minha-conta/pedidos/:id`
e `/administracao/{produtos,promocoes,pedidos}`. A raiz de cada área abre sua
visão geral; pedidos inexistentes e listas inexistentes exibem estados próprios.

Para repetir os verificadores de navegador, use API e Vite ligados a um banco
descartável conforme [ENTREGA_LOCAL.md](docs/forma/ENTREGA_LOCAL.md). O verificador
geral opcional usa Brave/Chromium headless e aceita `FORMA_BROWSER` para outro
executável; `FORMA_BROWSER_ORIGIN` escolhe a vitrine de teste (padrão
`http://127.0.0.1:5187`). A depuração usa 9229 e o perfil isolado fica em
`.tmp/browser-check/profile`. Não reutilize o perfil do navegador da aula.
Capturas desktop/mobile ficam em `.tmp/browser-check/`, ignorado pelo Git.

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
├── scripts/check-browser.mjs    # checagem geral opcional no Chromium headless
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
    │   └── products.js            # compatibilidade legada; catálogo real via API
    ├── pages
    │   ├── About.jsx
    │   ├── Account.jsx            # formulário de dados pessoais
    │   ├── account/               # layout e subseções de Minha Conta
    │   ├── Administration.jsx     # consulta e gestão do catálogo (administradores)
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
  cotações/pedidos (`0006`), pagamentos/reservas/eventos (`0007`) e outbox de
  e-mail (`0008`, entrega SMTP/retry em `0010`) (executor em
  `server/src/db/migrations/run.js`). Senhas viram hash scrypt com
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
- **Dados de conta:** `src/services/account.js` lê e grava endereços, listas e
  histórico/detalhe dos pedidos em `/api/conta/...`. Carteira FORMA em `/api/conta/cartoes`: IDs
  do cliente/cartão e metadados seguros (marca, quatro últimos dígitos, titular e validade).
  PAN, CVV e token temporário nunca são persistidos. Checkout Pro continua como alternativa.
- **Papéis:** `users.role` (`cliente`/`administrador`) definido no banco. Toda
  conta da API nasce `cliente`; `administrador` é concedido apenas por
  `npm run api:admin` ou pelo provisionamento demonstrativo local `api:admin:demo`. O front (`isAdmin`) só esconde rotas — a autorização
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
  coração e da conta, e 20 rotas em sete larguras (incluindo login).

Os testes automatizados usam contas fictícias e armazenamento isolado. A
verificação inicial foi feita no Edge; a rodada de 22/10/2026 usou Brave/Chromium,
com emulação de desktop e celular. Firefox/WebKit e aparelhos físicos não foram testados. O consentimento promocional apenas salva a
preferência, sem enviar e-mails. Carrinho e token da sessão pertencem ao navegador e à
origem; perfil, endereços, favoritos, listas e pedidos ficam no PostgreSQL; use sempre a mesma URL durante a aula.

## Próximas etapas (planejadas)

Os itens abaixo ainda **não** estão implementados e serão adicionados nas
próximas entregas:

- Homologar criação/remoção/tokenização e pagamento com cartões no sandbox real; a implementação local está pronta para esse teste.
- Homologação da entrega externa de e-mail (provedor SMTP real com TLS/AUTH/SPF), liberação do checkout em produção, e-mails promocionais com opt-in e recuperação de senha.


A partir de 14/10/2026 esta etapa autoriza back-end e banco locais, catálogo
funcional e integrações (Mercado Pago, frete, e-mail), sempre por blocos
específicos. **Não haverá hospedagem, Supabase, Vercel ou deploy.**
