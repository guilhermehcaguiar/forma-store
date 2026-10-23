# FORMA

Projeto acadêmico de e-commerce de **camisas oversized masculinas**, com vitrine,
conta do cliente, carrinho, checkout e administração do catálogo. A aplicação usa
React na interface e uma API com PostgreSQL para os dados da loja.

## Estado atual da entrega

A loja pode ser instalada e demonstrada **localmente**: cadastro e login, perfil,
endereços, favoritos, listas, catálogo, carrinho com cupom e gestão administrativa
estão implementados. O banco guarda contas, produtos e pedidos; o catálogo inicial
opcional contém **30 peças demonstrativas**, **15 estampadas**, **15 cores**,
tamanhos P/M/G/GG e **12 promoções**. Vinte e nove imagens de produtos são
representações geradas por IA,
identificadas na descrição e no texto alternativo.

**Mercado Pago, Melhor Envio e entrega externa de e-mail ainda dependem de
homologação.** O código integra os ambientes de teste de pagamento e frete, mas
as evidências existentes usam fixtures (respostas controladas nos testes).
Essas fixtures não representam pagamentos nem fretes reais. Há também um **modo
demonstrativo local explícito**, descrito abaixo, para concluir a compra pela
interface sem credenciais externas. SMTP foi exercitado com captura local; o modo padrão de e-mail
é `mock`, que gera apenas prévias, sem envio.

Com a demonstração habilitada, cadastro → produto → carrinho → cupom → endereço →
frete demonstrativo → pedido → pagamento demonstrativo → confirmação → histórico
e e-mail mock/SMTP local formam um fluxo funcional. **DEMONSTRAÇÃO — sem cobrança
ou envio real** identifica esse fluxo. Sem essa configuração, frete e pagamento
continuam dependendo das integrações externas, sem fallback simulado.
Não há deploy documentado. As evidências e os limites da entrega estão na
[auditoria de requisitos](docs/forma/AUDITORIA_REQUISITOS.md) e na
[auditoria de segurança](docs/forma/AUDITORIA_SEGURANCA.md).

## Funcionalidades

### Cliente

- Cadastro com consentimento promocional opcional, login e logout.
- Perfil com edição de nome e preferência promocional; troca de e-mail e senha
  mediante confirmação da senha atual.
- Cadastro, edição e remoção de endereços, com escolha explícita do principal.
- Catálogo com filtros por cor, estampa, tamanho e promoção; ordenação A–Z,
  menor/maior preço e mais novos/antigos.
- Detalhe do produto com imagens, preço, tamanhos e disponibilidade.
- Carrinho com inclusão, remoção, alteração de quantidades e cupom; preços e
  estoque revalidados pela API, com aceite de mudanças de preço.
- Favoritos e listas de compras persistidos por conta.
- Checkout autenticado com endereço, frete, desconto e resumo; histórico e
  detalhes dos pedidos com os dados registrados na compra.
- Compra demonstrativa local sem credenciais de pagamento/frete, quando
  habilitada explicitamente no servidor.
- Integração implementada para Checkout Pro e carteira de cartões tokenizados
  (listar, adicionar, remover e pagar com cartão salvo), pendente de homologação.
- Página institucional Sobre Nós e interface responsiva.

### Administrador

- Acesso restrito por papel, validado na API.
- Atalho **Painel Admin** no menu após login administrativo, inclusive no menu móvel.
- Cadastro e edição de produtos: nome, descrição, cor, estampa, peso,
  dimensões de embalagem e status ativo/inativo.
- Gestão de preços, promoções, tamanhos P/M/G/GG e estoque por tamanho.
- Upload de imagens PNG, JPEG ou WebP, até cinco por produto e 5 MB por arquivo,
  com seleção da imagem principal.
- Proteção contra edições desatualizadas e alterações incompatíveis com reservas.
- Consulta dos últimos 200 pedidos, com filtro de estado, itens, valores e
  situação do pagamento. O painel não permite forçar a aprovação de pagamento.

## Tecnologias e arquitetura

- **Interface:** React 19, Vite 8 e React Router 7; estilos em CSS e lint com Oxlint.
- **API:** Node.js e Express 5, organizados em módulos de conta, catálogo,
  carrinho, frete, checkout, pagamentos e administração.
- **Persistência:** PostgreSQL, migrações SQL e seed demonstrativo.
- **Pagamento:** SDK oficial do Mercado Pago, Checkout Pro e Payments API em
  modo sandbox; campos seguros do SDK no navegador para tokenização de cartões.
- **Frete:** cotação via Melhor Envio Sandbox e autorização OAuth no servidor.
- **E-mail:** outbox no PostgreSQL, transporte SMTP com novas tentativas ou
  prévias locais em modo `mock`.

O navegador consome a API em `/api`. O servidor calcula preços, descontos e
estoque e registra pedidos com cópias dos dados da compra, reservas e controle
contra duplicidade. Pagamentos externos dependem de consulta ao gateway; o retorno do
navegador não marca um pedido como pago. Na demonstração, o servidor confirma
apenas pedidos identificados como demo, usando a mesma transição de estoque,
cupom e outbox. As tentativas têm provedor `forma_demo` e IDs `demo:…`.

Senhas usam scrypt com salt; o banco guarda o hash do token de sessão.
O token enviado como Bearer e o carrinho ficam no `localStorage` do navegador.
Contas, endereços, favoritos, listas e pedidos ficam no PostgreSQL.

## Pré-requisitos e instalação

### 1. Preparar as ferramentas e dependências

- Node.js compatível com o Vite: **20.19+ na série 20 ou 22.12+**.
- npm e PostgreSQL **14+**.
- Para a preparação automática em Linux, binários `initdb` e `pg_ctl` no `PATH`;
  `createdb` também é usado no exemplo de testes com banco descartável.
- Portas livres: `5173` (frontend), `3333` (API) e `55434` (banco automático).

Abra um terminal **na raiz do repositório**. Todos os comandos abaixo partem
dessa pasta, salvo indicação em contrário.

```bash
npm ci
npm ci --prefix server
```

### 2. Preparar o banco local

Para uma instalação nova, sem `server/.env`, execute como usuário comum,
sem `sudo`:

```bash
npm run api:setup
```

O comando inicia um PostgreSQL exclusivo em `127.0.0.1:55434`, cria o banco
`forma`, gera `server/.env` com senha local aleatória, aplica as migrações e
carrega o catálogo demonstrativo. Não exige Docker nem altera o serviço
PostgreSQL do sistema.

**Não copie `server/.env.example` antes dessa preparação automática.** Um
`server/.env` preexistente é preservado; se ele existir antes da criação do
banco automático, o comando recusará a preparação. Para usar um PostgreSQL local
próprio, crie um usuário e um banco nele, copie o modelo apenas se o arquivo real
ainda não existir e ajuste `DATABASE_URL` antes de executar:

```bash
# Alternativa ao api:setup: PostgreSQL local próprio já criado e em execução
cp -n server/.env.example server/.env
# Edite server/.env com a conexão do seu banco local antes de continuar.
npm run api:migrate
npm run api:seed
```

O seed insere as peças demonstrativas ausentes. Reexecutá-lo não duplica peças,
não repõe estoque nem sobrescreve preços, status, datas, uploads ou edições
personalizadas. Ele também atualiza apenas imagens e descrições legadas
reconhecidas em produtos sem edição administrativa. Uma peça da coleção, Concreto Cinza, começa esgotada para demonstrar
indisponibilidade.

### 3. Iniciar a API e o frontend

**Terminal 1 — API:**

```bash
npm run api
```

**Terminal 2 — frontend:**

```bash
npm run dev
```

- Loja: <http://localhost:5173>.
- API: <http://localhost:3333/api> (base das rotas).
- Saúde da API e do banco: <http://localhost:3333/api/health>.
  Responde com HTTP 200 e `status: "ok"` quando o banco está acessível; HTTP 503
  quando está indisponível.

O comando `npm run dev` inicia em **http://localhost:5173**. O Vite mantém essa
porta fixa e informa um erro se ela estiver ocupada, evitando uma origem
diferente da autorizada pela API. Encerre a outra instância antes de iniciar.
Use sempre `localhost` no navegador: `localhost` e `127.0.0.1` têm armazenamentos
distintos, e a API autoriza `http://localhost:5173` por padrão.

### Modo de demonstração local: compra completa sem credenciais externas

**DEMONSTRAÇÃO — sem cobrança ou envio real**

Depois da instalação, aplique as migrações (inclui `0013` e `0014`):

```bash
npm run api:migrate
```

Configure no `server/.env` e reinicie a API:

```dotenv
NODE_ENV=development
FORMA_API_HOST=127.0.0.1
FORMA_DEMO_MODE=true
FORMA_DEMO_PAYMENT_PROVIDER=forma_demo
FORMA_EMAIL_MODE=mock
```

Alternativamente, inicie a API com essas opções apenas para aquela execução:

```bash
NODE_ENV=development FORMA_API_HOST=127.0.0.1 FORMA_DEMO_MODE=true FORMA_DEMO_PAYMENT_PROVIDER=forma_demo FORMA_EMAIL_MODE=mock npm run api
```

Mantenha `DATABASE_URL` apontando para o PostgreSQL local já preparado. A API
recusa produção, host de escuta fora de loopback, banco remoto, URL com
query/fragmento e overrides `PG*`. Ela confere a conexão e a identidade do banco
antes de abrir a porta e a cada conexão usada pela demo. Não ative essa opção no
frontend; nenhum `VITE_*` habilita a demonstração.

No checkout, selecione o endereço e calcule o frete: a opção demonstrativa custa
**R$ 10,00**, com prazo fictício de três dias. Confirme o pedido e clique em
**Confirmar pagamento demonstrativo**, sem informar cartão. Também é possível
retomar esse pagamento pelo detalhe do pedido no histórico. O servidor calcula
os valores e mantém idempotência, reserva/consumo de estoque e isolamento entre
contas. A compra demonstrativa consome o estoque **do banco local**; repetir o
seed não o repõe.

O aviso permanece na cotação, pagamento, pedido, histórico, administração e
mensagens. Pedidos antigos de gateway não podem ser pagos pela rota demo, e
pedidos do provedor `forma_demo` não podem ser enviados ao Mercado Pago. Nenhuma
chamada a Mercado Pago ou Melhor Envio é necessária nesse modo.

#### Demonstração com Mercado Pago sandbox e frete local

Para preencher um **cartão de teste** ou abrir o Checkout Pro durante a
demonstração, use a opção abaixo. O frete continua demonstrativo (R$ 10,00),
mas a aprovação vem do Mercado Pago, por consulta validada ou webhook.
O botão de aprovação local não pode pagar esses pedidos.

1. Aplique as migrações: `npm run api:migrate` (inclui `0014`).
2. Configure localmente em `server/.env`, sem publicar valores:
   `MERCADOPAGO_TEST_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`,
   `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_PUBLIC_URL` (URL HTTPS pública da API)
   e `MERCADOPAGO_FRONTEND_URL=http://localhost:5173`.
   Use credenciais do ambiente de teste; chaves `APP_USR` exigem conta vendedora
   identificada pelo Mercado Pago como usuário de teste.
3. Cadastre no painel do Mercado Pago o webhook
   `<URL HTTPS da API>/api/pagamentos/webhook`, tópico `payment`.
4. Encerre a API anterior e inicie:

   ```bash
   npm run api:demo:mercadopago
   ```

5. Mantenha `npm run dev` em outro terminal e abra **http://localhost:5173**.
   No health, confira `demonstration: true` e `paymentProvider: "mercadopago"`.
6. Inicie uma **nova compra**, selecione endereço e frete, e confirme o pedido.
   Na etapa seguinte, preencha os campos seguros de cartão de teste na FORMA
   ou clique em **Pagar com Mercado Pago (teste)** para abrir o Checkout Pro.
   Um cartão novo é tokenizado e salvo na carteira; depois selecione-o e
   confirme o CVV para pagar. Ele também fica disponível em Cartões salvos.

Os campos só carregam com Public Key e configuração sandbox válidas. Se faltar
configuração, a interface explica a pendência; não inventa uma aprovação nem
coleta os dados brutos do cartão. O Checkout Pro pode continuar disponível
quando faltar somente a configuração específica da carteira.

O comando fixa `NODE_ENV=development`, API loopback, `FORMA_DEMO_MODE=true`,
`FORMA_DEMO_PAYMENT_PROVIDER=mercadopago`, `MERCADOPAGO_MODE=sandbox`, e-mail mock
e origem `http://localhost:5173`; recusa `NODE_ENV=production`.
Para voltar à aprovação totalmente local,
inicie a demo com `FORMA_DEMO_PAYMENT_PROVIDER=forma_demo` (padrão anterior).
Pedidos existentes conservam seu provedor. Um pedido simulado não pode ser
convertido em pagamento de gateway; uma nova compra cria o vínculo correto.
E-mails de ambos os tipos de demonstração continuam locais.

Referências: [compras de teste no Checkout Pro](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/integration-test/test-purchases)
e [cartões no Checkout Transparente](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-test/make-test-purchase).
A validação automatizada usa fixtures locais do gateway; a homologação externa
exige as credenciais e contas de teste da aplicação.

A API processa o outbox na inicialização e a cada 60 segundos. Em `mock`, a
confirmação fica em `email_outbox.mock_message`, sem entrega; para apresentá-la,
consulte essa tabela no PostgreSQL local. Para visualizar uma mensagem capturada
no navegador, use o SMTP local/Mailpit da seção de ambiente. No modo demo o SMTP
aceita apenas os IPs `127.0.0.1` ou `::1`; e-mails de pedidos demo nunca são
encaminhados a SMTP externo, mesmo após desligar a demonstração.

Para voltar ao fluxo externo, configure `FORMA_DEMO_MODE=false` (padrão) e
reinicie a API. A rota de pagamento demo deixa de existir; pedidos demo antigos
continuam identificados no histórico e não são convertidos em transações reais.

### 4. Reiniciar preservando os dados

O PostgreSQL automático mantém seus dados em `.local/postgres`; os uploads
administrativos ficam em `server/.local/uploads`. Esses diretórios e os arquivos
reais de ambiente são ignorados pelo Git. Preserve-os para manter a demonstração.

Após reiniciar o computador, inicie novamente o banco automático e os dois
servidores:

```bash
npm run db:local
npm run api
# Em outro terminal, na raiz:
npm run dev
```

Também é possível repetir `npm run api:setup`: ele reaproveita o banco, aplica
migrações pendentes e preserva os dados existentes. Quem escolheu um PostgreSQL
próprio deve iniciar esse serviço em vez de usar `db:local`.

### Roteiro rápido de demonstração

1. Abra `/catalogo`, combine filtros e visite uma peça com estoque.
2. Crie uma conta em `/cadastro`; salve um endereço, um favorito e uma lista.
3. Adicione uma peça ao carrinho, altere a quantidade e aplique `FORMA10`
   (10%, criado pela migração e sujeito ao estado atual do banco).
4. Recarregue a página para conferir a persistência. Saia da conta e use o
   administrador abaixo para editar uma peça e conferir a mudança na vitrine.
5. Com o modo demo habilitado, selecione o frete demonstrativo e confirme o
   pagamento simulado; confira confirmação, histórico e e-mail mock/SMTP local.
6. Para homologar frete, pagamento e e-mail externos, desligue a demo, prepare
   as credenciais de teste e siga o [roteiro de homologação](docs/forma/ENTREGA_LOCAL.md#homologação-posterior--somente-serviços-de-teste).

## Administrador de demonstração

- Comando de provisionamento: `npm run api:admin:demo`
- Página de login: http://localhost:5173/login
- Login: `admin@forma.local`
- Senha: `FormaDemo2026!`
- Uso: **somente desenvolvimento local**.
- Páginas: `/administracao/produtos`, `/administracao/promocoes` e `/administracao/pedidos`.

Após preparar o banco e aplicar as migrações, execute:

```bash
npm run api:admin:demo
```

Essa conta é **EXCLUSIVA de desenvolvimento/teste com PostgreSQL local**.
O comando aceita apenas `development`/`test`, confere a conexão em loopback e
recusa produção e banco remoto. A conta não é criada automaticamente ao iniciar
a API nem é criada em produção; usa o login normal e senha com hash scrypt.

Se já existir uma conta com o mesmo e-mail, o comando **preserva nome, senha e
papel**: não redefine a senha nem promove uma conta comum. Nesse caso, as
credenciais demonstrativas podem não permitir acesso administrativo.
A senha publicada acima é apenas dessa conta de demonstração; não é credencial
de banco, SMTP ou outro serviço.

Para provisionar um administrador próprio, use a CLI documentada nos
[contratos da API](docs/forma/API_CONTRATOS.md#comando-para-criar-administrador).

## Configuração de ambiente

Os modelos [.env.example](.env.example) e
[server/.env.example](server/.env.example) contêm valores fictícios.
**Não publique os arquivos `.env` reais nem credenciais de serviços.**
Marcadores como `FICTICIO` e `TROQUE` não habilitam integrações.

O frontend funciona com a URL padrão da API. Para personalizá-la, copie o
modelo sem sobrescrever uma configuração existente:

```bash
cp -n .env.example .env.local
```

O Vite aceita **somente `VITE_API_URL`**, padrão
`http://localhost:3333/api`, sem credenciais, query ou fragmento; outras variáveis
`VITE_*` são recusadas. Tudo publicado no frontend é acessível ao navegador.
No servidor, use o `server/.env` gerado por `api:setup` ou a configuração manual
descrita na instalação. Reinicie API/Vite após editar o ambiente; uma alteração
da URL da API exige novo build para aparecer na versão compilada.

| Configuração | Uso e visibilidade |
| --- | --- |
| `NODE_ENV`, `PORT`, `CORS_ORIGIN`, `SESSION_TTL_DAYS` | Servidor: ambiente `development`, API `3333`, origem `http://localhost:5173` e sessão de sete dias por padrão. Não há `JWT_SECRET` ou `SESSION_SECRET` neste modelo de autenticação. |
| `FORMA_DEMO_MODE`, `FORMA_API_HOST` | `false` por padrão; `true` habilita demonstração somente em `development`/`test`, API em IP de loopback e PostgreSQL local. Sem configuração, o fluxo externo atual é preservado. |
| `DATABASE_URL` | **Privada, somente no servidor.** Conexão com o PostgreSQL local; use a senha gerada ou a do banco que você criou. |
| `MERCADOPAGO_PUBLIC_KEY` | **Pública**, necessária ao SDK no navegador. É configurada no servidor e fornecida pela API autenticada em `/api/conta/cartoes` quando a configuração de cartão salvo está válida. |
| `MERCADOPAGO_TEST_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | **Privados, somente no servidor.** Access Token de teste e segredo de assinatura do webhook; são diferentes da Public Key. Use credenciais da mesma aplicação e `MERCADOPAGO_MODE=sandbox`. |
| `MERCADOPAGO_PUBLIC_URL`, `MERCADOPAGO_FRONTEND_URL` | URL HTTPS pública temporária da API para callback/webhook e URL do frontend local. Webhook: `/api/pagamentos/webhook`. Cartão salvo exige callback e segredo válidos antes de iniciar pagamento; sem configuração, a UI oculta esse pagamento. |
| `MELHOR_ENVIO_CLIENT_ID`, `MELHOR_ENVIO_CLIENT_SECRET`, `MELHOR_ENVIO_REDIRECT_URI`, `MELHOR_ENVIO_ACCESS_TOKEN`, `MELHOR_ENVIO_REFRESH_TOKEN` | Configuração OAuth **somente no servidor**; segredo e tokens são privados. A base sandbox é fixa no código. Após configurar o aplicativo, execute `npm run api:melhor-envio:autorizar`; o cache privado fica em `server/.local/melhor-envio-tokens.json`. |
| `MELHOR_ENVIO_ORIGIN_CEP`, `MELHOR_ENVIO_USER_AGENT` | CEP do remetente e identificação/contato do aplicativo, configurados no servidor. A cotação também depende de CEP válido e peso/dimensões dos produtos. |
| `FORMA_EMAIL_MODE`, `FORMA_EMAIL_FROM`, `FORMA_EMAIL_MAX_ATTEMPTS` | `mock` gera prévias sem entrega; `smtp` ativa transporte. Remetente e limite de tentativas são configurados no servidor. |
| `FORMA_SMTP_HOST`, `FORMA_SMTP_PORT`, `FORMA_SMTP_SECURE`, `FORMA_SMTP_USER`, `FORMA_SMTP_PASS` | Configuração **somente no servidor**; usuário/senha são privados. Para SMTP externo, use TLS (`starttls` ou `ssl`) e remetente autorizado pelo provedor. |

O fluxo OAuth recebe a URL de retorno no terminal. O redirect padrão
`http://localhost:3333/api/health` deve coincidir com o cadastrado no aplicativo;
a rota de saúde não implementa um callback OAuth automático.

Para captura local com Mailpit instalado e em execução, configure em `server/.env`:

```dotenv
FORMA_EMAIL_MODE=smtp
FORMA_EMAIL_FROM=no-reply@forma.local
FORMA_SMTP_HOST=127.0.0.1
FORMA_SMTP_PORT=1025
FORMA_SMTP_SECURE=none
FORMA_SMTP_USER=
FORMA_SMTP_PASS=
```

O Mailpit usa a interface <http://localhost:8025>. Essa captura comprova apenas
recebimento no servidor local. A confirmação de compra é enfileirada após a
aprovação verificada do pagamento, independentemente do opt-in promocional.
O transporte SMTP pode reenviar uma mensagem se houver falha entre o aceite do
servidor e o registro do envio no banco; não há garantia de entrega única.

## Comandos de manutenção e verificação

Execute na raiz do repositório:

| Comando | Finalidade |
| --- | --- |
| `npm run db:local` | Iniciar/preparar o PostgreSQL persistente exclusivo do projeto. |
| `npm run api:setup` | Executar `db:local`, migrações e seed. |
| `npm run api:demo:mercadopago` | Iniciar frete demo local com pagamento Mercado Pago sandbox e e-mail mock. |
| `npm run api:migrate` | Aplicar apenas migrações pendentes, registradas em `schema_migrations`. |
| `npm run migrate:status --prefix server` | Consultar o estado das migrações. |
| `npm run api:seed` | Inserir produtos demonstrativos ausentes, preservando edições existentes. |
| `npm test` | Executar os testes descobertos pelo runner do Node.js, incluindo os da API. |
| `npm test --prefix server` | Executar somente a suíte de `server/tests`. |
| `npm run test:db` | Executar a suíte da API com PostgreSQL descartável; exige a variável abaixo. |
| `npm run lint` | Verificar o código com Oxlint. |
| `npm run build` | Gerar o frontend compilado em `dist/`. |
| `npm run preview` | Pré-visualizar o frontend compilado, normalmente em `http://localhost:4173`; não inicia a API. |

Para usar a API na pré-visualização, ajuste `CORS_ORIGIN` para
`http://localhost:4173` e reinicie a API; ao voltar ao Vite, restaure a origem
`http://localhost:5173`.

### Testes de integração com PostgreSQL (opt-in)

Sem `FORMA_TEST_DATABASE_URL`, os testes que exigem PostgreSQL são pulados.
Para executá-los, use **somente uma instância local descartável**, com nome do
banco contendo `test` ou `audit`, e um usuário com permissão `CREATEDB`.
O runner recusa hosts remotos, query, fragmento e variáveis indiretas `PG*`
(como `PGHOST` e `PGSERVICE`); remova essas variáveis do terminal e informe a URL
completa em `FORMA_TEST_DATABASE_URL`. Esse comando não carrega a URL de testes
automaticamente do `server/.env`.

Exemplo para Linux, em diretório novo e porta livre, separado do banco da loja.
A autenticação `trust` é exclusiva desta instância temporária em loopback:

```bash
initdb -D /tmp/forma-readme-test-pg --username=forma_teste --auth-local=trust --auth-host=trust --encoding=UTF8 --locale=C
pg_ctl -D /tmp/forma-readme-test-pg -l /tmp/forma-readme-test-pg.log -o '-h 127.0.0.1 -p 55435 -k /tmp' start
createdb -h 127.0.0.1 -p 55435 -U forma_teste forma_readme_test
FORMA_TEST_DATABASE_URL=postgresql://forma_teste@127.0.0.1:55435/forma_readme_test npm run test:db
# Após concluir os testes:
pg_ctl -D /tmp/forma-readme-test-pg stop
```

O [runner](scripts/check-db-tests.mjs) cria um banco por arquivo de teste,
aplica as migrações e grava relatórios em `.tmp/db-tests/`. A suíte inclui a
jornada demo por HTTP/SQL, concorrência, isolamento, expiração, e-mail mock/SMTP
local e recusa de produção/banco remoto antes de qualquer conexão remota. Os bancos criados
permanecem na instância descartável para inspeção. Para repetir a preparação,
escolha outro diretório/porta ou reinicie a instância existente.

Para verificar a jornada demo real no Brave/Chromium (executável ajustável com
`FORMA_BROWSER`), com a instância descartável acima em execução:

```bash
FORMA_TEST_DATABASE_URL=postgresql://forma_teste@127.0.0.1:55435/forma_readme_test node scripts/check-local-demo-browser.mjs
```

O verificador cria outro banco descartável, inicia API e Vite próprios (porta
`5191`, depuração do navegador `9245`) e testa desktop/celular sem interceptar
frete ou pagamento. Relatório e capturas ficam em `.tmp/local-demo-browser/`;
os processos criados são encerrados ao concluir.

As evidências atuais para consulta na futura elaboração do PDF ficam em
`.tmp/forma-final-20261023/`, ignorado pelo Git. Incluem capturas de catálogo,
produto, conta, compra e administração, resultados de testes e contagens do seed.
A matriz atual dos 40 requisitos está na
[auditoria de requisitos](docs/forma/AUDITORIA_REQUISITOS.md). Nenhum PDF ou
rascunho de relatório final foi criado nesta rodada.

Os verificadores de navegador também alteram dados de teste e exigem ambiente
isolado. Preparação, comandos e evidências anteriores estão no
[guia de entrega local](docs/forma/ENTREGA_LOCAL.md) e na
[auditoria de segurança](docs/forma/AUDITORIA_SEGURANCA.md). Seus resultados com
fixtures ou demonstração local não substituem homologação externa.

## Estrutura do repositório e documentação

```text
.
├── src/                       # Interface React
│   ├── assets/                # Imagens importadas pela interface
│   ├── components/            # Componentes reutilizáveis e proteção de rotas
│   ├── context/               # Sessão e dados de conta
│   ├── pages/                 # Loja, conta e administração
│   ├── services/              # Cliente HTTP, carrinho e integrações da interface
│   ├── styles/                # Estilos compartilhados
│   └── App.jsx                # Rotas da aplicação
├── public/products/           # Imagens locais do catálogo demonstrativo
├── server/
│   ├── src/db/                # Pool, migrações SQL e dados demonstrativos
│   ├── src/modules/           # Regras e rotas da API por domínio
│   ├── src/middleware/        # Autenticação, autorização, uploads e erros
│   ├── src/scripts/           # Banco local, seed, administradores e OAuth
│   ├── tests/                 # Testes unitários e de integração da API
│   └── .env.example           # Modelo de configuração do servidor
├── scripts/                   # Verificadores de banco, navegador e segurança
├── tests/                     # Testes de serviços e validações do frontend
├── docs/forma/                # Requisitos, contratos, auditorias e referências
├── .env.example               # Modelo de configuração pública do frontend
└── package.json               # Comandos executados a partir da raiz
```

- [Requisitos extraídos do PDF](docs/forma/REQUISITOS_DO_PDF.txt) e
  [PDF original com mockups](docs/forma/referencias/FORMA_Requisitos_e_Mockups.pdf).
- [Auditoria de requisitos](docs/forma/AUDITORIA_REQUISITOS.md): matriz RF/RNF,
  evidências e pendências.
- [Auditoria de segurança](docs/forma/AUDITORIA_SEGURANCA.md): verificações,
  correções e limites do ambiente local.
- [Contratos da API](docs/forma/API_CONTRATOS.md): rotas, campos, autenticação,
  respostas e erros.
- [Imagens](docs/forma/IMAGENS.md): origem dos arquivos, uso de IA e prompts.
- [Entrega local e roteiro de homologação](docs/forma/ENTREGA_LOCAL.md): reprodução
  das verificações e validação posterior dos serviços de teste.

As auditorias e entregas preservam registros históricos das respectivas rodadas;
referências antigas a commits e resultados descrevem aqueles momentos.

## Limitações conhecidas e próximos passos

### Pendências dos requisitos do PDF

A [matriz de requisitos](docs/forma/AUDITORIA_REQUISITOS.md) detalha o estado de
cada item. Permanecem parciais:

- **RF06 e RF15–RF18:** carteira/cartões, frete, checkout, Mercado Pago e e-mail
  de confirmação têm implementação local, mas dependem de homologação com os
  provedores. O fluxo demonstrativo funcional não conclui essa homologação.
  Mercado Pago e Melhor Envio Sandbox e SMTP externo ainda não
  foram homologados; captura local e fixtures não concluem esses requisitos.
- **RNF02:** o carrinho permanece em `localStorage`, sem persistência no
  PostgreSQL ou sincronização entre dispositivos por conta.
- **RNF06, RNF07 e RNF09:** autenticação, pagamento e proteção de dados têm
  controles locais, mas o token fica em `localStorage`, o ambiente usa HTTP
  local e não há limitação de tentativas de login nem auditoria geral de produção.
  A tokenização e o pagamento pelo SDK real ainda precisam de homologação.
- **RNF10:** não há teste de carga nem paginação que comprovem desempenho em escala.
- **RNF11:** as evidências de navegador usam Edge/Brave/Chromium; Firefox e
  WebKit não foram verificados. Emulação responsiva não substitui aparelhos físicos.
- **RNF13:** reservas, valores e prevenção de duplicidade possuem verificações
  locais; o ciclo completo com provedores externos permanece pendente.
- **RNF14:** consentimento promocional é salvo, mas o envio promocional está
  ausente e a entrega SMTP externa não foi homologada. A confirmação transacional
  é independente desse consentimento.

A próxima validação deve seguir o roteiro externo com contas e credenciais de
**teste**, incluindo cartão salvo, Checkout Pro, webhook, cotação e e-mail.
A entrega atual não inclui compra de etiquetas nem operação comercial real.

### Melhorias futuras além dos requisitos explícitos

Recuperação de senha, verificação de e-mail por link e automação de CI são
possíveis evoluções e não fazem parte da entrega atual.
O PDF também propõe Vercel e Supabase na seção de hospedagem; essa proposta não
foi executada nesta entrega local e não constitui um deploy disponível.
