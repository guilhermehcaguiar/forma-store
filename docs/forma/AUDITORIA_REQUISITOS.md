# FORMA — auditoria de requisitos, catálogo e administração

Atualização: 16/10/2026. Fonte: `REQUISITOS_DO_PDF.txt` e PDF original em
`referencias/FORMA_Requisitos_e_Mockups.pdf` (RF01–RF26, RNF01–RNF14).

## Etapa atual — e-mail de confirmação de compra (16–21/10/2026)

Requisito RF18/RNF14: substituir a outbox exclusivamente mock por entrega
transacional configurável. A implementação (16/10) foi feita sem shell, com
revisão estática apenas; a rodada de 21/10 restabeleceu as permissões,
aplicou as correções da revisão adversarial (A1–A8 abaixo) e executou toda a
validação local descrita adiante — testes, lint, build, PostgreSQL
descartável, upgrade in-place da migração e integração SMTP de captura. As
consultas de arquivos (pedidos/outbox/testes) foram feitas por leitura de
arquivos; nenhum comando tocou o banco habitual.

Escopo entregue, preservando a arquitetura existente:

- `server/src/modules/notifications/smtp.client.js` (novo): cliente SMTP
  próprio com `node:net`/`node:tls`, **sem dependência nova**. Texto puro
  UTF-8 (8bit) com dot-stuffing; EHLO, STARTTLS/SSL (certificados validados,
  STARTTLS recusado quando não anunciado) e AUTH PLAIN/LOGIN; recusa
  quebras de linha em endereços/assunto (injeção de cabeçalho) e credenciais
  em plaintext fora de 127.0.0.1/localhost; timeouts de socket/conexão.
- `0010_email_entrega_smtp.sql` (nova migração): estados
  `sending`/`sent`/`failed`, template `purchase_confirmation`, colunas
  `next_attempt_at`/`sent_at`/`last_error` e índice de dispatch ajustado.
  `event_key` UNIQUE e `mock_message` preservados; linhas legadas
  `queued`/`mocked` continuam válidas.
- `email.service.js` reescrito: configuração validada por variáveis de
  ambiente (`resolveEmailConfig`, falha antes de reivindicar qualquer linha);
  worker claim-and-send — reivindicação em transação curta
  (`FOR UPDATE SKIP LOCKED`, status `sending` com lease em
  `next_attempt_at`), envio fora da transação e finalização guardada por
  `attempts`; falha de SMTP registrada em `last_error` com backoff
  exponencial (2, 4, 8... minutos, teto 60) e limite
  `FORMA_EMAIL_MAX_ATTEMPTS` (esgotado: `failed` com reenvio manual
  documentado). O pedido nunca é afetado pelo envio.
- `payments.service.js`: a transição efetiva para `pago` (após consumo das
  reservas, na transação do webhook/reconciliação) enfileira
  `purchase_confirmation` no lugar do aviso genérico `order_status:pago`;
  `applyVerifiedPayment` passou a ser exportada para os testes, no
  precedente de `createOrder`/`readCart`/`consumeOrderReservations`.
- Opt-in promocional independente: `users.promo` não é consultado em nenhum
  caminho transacional; `enqueueOrderEmail` recusa templates fora da
  allowlist transacional (e-mails promocionais futuros não usarão este
  funil). Desmarcar promoções não impede a confirmação da compra.
- `index.js` registra na inicialização se a entrega é real (SMTP) ou prévia
  (mock), sem imprimir credenciais; `server/.env.example` documenta
  `FORMA_SMTP_HOST/PORT/SECURE/USER/PASS`, `FORMA_EMAIL_FROM` e
  `FORMA_EMAIL_MAX_ATTEMPTS`. Sem `FORMA_EMAIL_MODE`, o padrão mock é
  mantido com aviso — o mock segue sendo modo **explícito** de
  desenvolvimento/teste, cujo texto afirma que nada foi entregue.

Conteúdo da confirmação: número do pedido, data, itens (nome, cor, tamanho,
quantidade, preço unitário e da linha), subtotal, desconto com cupom, frete
com serviço/transportadora/prazo, total e endereço de entrega do snapshot.
Sem dados de pagamento, cartão ou gateway no payload e no texto. Webhook
repetido (mesmo ou distinto `event_id`) e reconciliação repetida não
duplicam: a deduplicação primária é o guard de transição sob lock e o
backstop é a `event_key` `order:{id}:purchase_confirmation`.

Testes criados (**não executados nesta rodada**):

- `server/tests/email-purchase.test.js` (unitário, sem banco/rede):
  configuração por env (padrão mock com aviso, modos inválidos, SMTP sem
  host, porta/TLS/credenciais/tentativas inválidos, aviso sem vazar
  segredos), backoff, guard de templates, event_key/assunto/payload da
  confirmação, render com itens/valores/endereço e sem dados de pagamento,
  prévia mock com aviso de não entrega, MIME com dot-stuffing e contra
  injeção de cabeçalho.
- `server/tests/email-confirmation.integration.test.js` (opt-in
  `FORMA_TEST_DATABASE_URL`, PostgreSQL descartável local; mini servidores
  SMTP de captura em 127.0.0.1 dentro do próprio teste, **sem rede
  externa**; em verificação manual, o mesmo fluxo aponta ao Mailpit):
  confirmação única na transição real para `pago` via `applyVerifiedPayment`
  com fixture de `payment_attempts` na forma do gateway; repetições de
  webhook/reconciliação sem duplicar (com `paid_at` preservado);
  `promo=false` recebe a confirmação; modo mock como prévia explícita sem
  conexão SMTP; entrega SMTP com destinatário/assunto/conteúdo corretos e
  sem dados sensíveis; falha SMTP (421) com `last_error`, backoff e pedido
  intacto; nova tentativa controlada entregando uma única vez; configuração
  inválida recusada sem reivindicar linhas.
- `server/tests/purchase.test.js` ajustado: event_key por evento (posições
  do INSERT) e remoção do bloco que rejeitava `FORMA_EMAIL_MODE=smtp` — o
  modo agora existe; a recusa de modo inválidos está coberta nos testes
  novos.

Verificações executadas na rodada de 21/10/2026 (permissões de shell e
edição restabelecidas; revisão adversarial A1–A8 aplicada antes):

```text
npm test --prefix server  → 56 testes, 52 aprovados, 0 falhas, 4 pulados
                            (integrações opt-in; email-purchase incluído)
npm test                  → 77 testes, 73 aprovados, 0 falhas, 4 pulados
npm run lint              → sem avisos (oxlint, exit 0)
npm run build             → concluído (vite build, 65 módulos)
git diff --check          → limpo
```

Integração `email-confirmation.integration.test.js` (9/9 aprovados, agrupador
+ 8 cenários, HTTP/PostgreSQL reais e mini servidores SMTP de captura em
127.0.0.1, sem rede externa) — banco descartável novo com 0001–0010 + seed:

```bash
FORMA_TEST_DATABASE_URL=postgresql://guihca@127.0.0.1:55433/forma_email_test \
  node --test --test-reporter=tap server/tests/email-confirmation.integration.test.js
```

Upgrade in-place da 0010 (banco `forma_upgrade_test`): 0001–0009 aplicadas via
psql, linhas legadas inseridas na outbox (`mocked` com prévia e `queued`),
`npm run api:migrate` aplicou **somente** a `0010`; as linhas antigas foram
preservadas (a `mocked` intacta), o worker novo processou a legada `queued`
para `mocked` com a prévia renderizada, e a integração completa passou 9/9
nesse banco de upgrade. A migração ainda **não** foi aplicada ao banco
habitual (aguardando decisão do aluno).

Cenários específicos exigidos, cobertos pelos subtests: confirmação única por
compra paga; webhook repetido (mesmo e distinto `event_id`) e reconciliação
repetida sem duplicar (com `paid_at` preservado); `promo=false` recebe a
confirmação; mock como prévia explícita sem conexão SMTP; entrega SMTP com
destinatário/assunto/conteúdo e sem dados sensíveis; falha 421 com `last_error`
e backoff; **lease vencido** recuperado no mock e no SMTP; **esgotamento de
tentativas** parando sem reprojetar e **reenvio manual** entregando; e o caso
**aceito-porém-não-registrado**: linha presa em `sending` com lease vencido é
reivindicada e **reenviada** — o teste documenta que esse cenário produz
segunda cópia se o envio anterior tinha sido aceito, ou seja, o worker é
*at-least-once* por construção, não *exactly-once*.

Correções da revisão adversarial aplicadas antes da validação (arquivo:
achado): `email.service.js` — falha de banco ao gravar o sucesso deixou de ser
tratada como falha de entrega (A1); re-checagem de propriedade por `attempts`
antes de cada envio, eliminando a duplicata determinística de lotes lentos
(A2); recuperação de reivindicação interrompida (`sending` com lease vencido)
no modo mock (A3) e cast explícito `$2::int` no lease (A7);
`smtp.client.js` — tratador de `close` do servidor nas leituras pendentes
(A5) e listener de `error` no socket pai durante/após o STARTTLS (A4). A6
(corpo 8-bit sem checagem de `8BITMIME`) e os informativos de A8 permanecem
como pendências documentadas, não como defeitos aceitos sem registro.

Mailpit: o binário não está disponível nesta máquina; o envio SMTP local foi
validado exclusivamente contra os mini servidores de captura do teste
(protocolo real EHLO/MAIL/RCPT/DATA/QUIT em loopback). A conferência no Mailpit
em si fica como verificação manual quando o binário existir.

Entrega capturada no Mailpit (ou no capturador embutido do teste) comprova o
transporte SMTP até o servidor local em loopback; **não constitui
homologação de entrega externa** — provedores reais (TLS/AUTH/SPF/
entregabilidade) continuam pendentes, assim como frete/Mercado Pago externos.
STARTTLS/AUTH não são exercitados pelos testes automatizados (o capturador
local é plaintext por design); webhook end-to-end com o gateway real
permanece não coberto, com a cola fetch+apply validada separadamente.

Limites assumidos explicitamente: o worker é *at-least-once* — uma falha
exatamente entre o servidor aceitar a mensagem e a gravação `sent` (ou um
crash no mesmo intervalo) deixa a linha em `sending` e, vencido o lease, ela é
**reenviada**, podendo produzir duplicata nesse cenário (comprovado pelo
subtest de lease vencido); as guardas de `attempts` garantem apenas que dois
workers não enviem nem finalizem a mesma reivindicação. O enqueue é
transacional por decisão de arquitetura herdada (um erro no INSERT aborta a
transação do pagamento, garantindo que nenhum evento fique sem registro).

Revisão final de segurança com o Sentinel (21/10/2026, somente leitura):
veredito **apto para commit**, sem achados críticos/altos. Correções aplicadas
na sequência e revalidadas (lint sem avisos, 56 testes/52 aprovados/0 falhas
no servidor, integração 9/9):

- **Plaintext para host externo sem credenciais (médio)** — a documentação
  prometia "none (apenas loopback)" mas o bloqueio dependia de haver
  credenciais; agora `FORMA_SMTP_SECURE=none` é recusado para qualquer host
  fora de 127.0.0.1/localhost, com ou sem credenciais (`resolveEmailConfig`
  e, defensivamente, `sendSmtpEmail`), com testes para as duas variantes.
- **Renovação de lease por item antes de cada envio (baixos 3/4)** — a
  conferência de propriedade virou um `UPDATE` que revalida `attempts` **e**
  renova `next_attempt_at` no momento do envio: fecha a janela de
  milissegundos entre conferência e envio e impede que lotes longos percam a
  posse e consumam `attempts` sem envio real; varreduras sobrepostas no mesmo
  processo foram bloqueadas por flag de reentrância em `runEmailOutboxSweep`.
- **Saneamento de resposta SMTP (baixo 5)** — caracteres de controle são
  removidos do texto de resposta antes de compor erros (`stripControlChars`),
  evitando injeção de log/escapes de terminal em `last_error`.
- **Endereços apenas ASCII** — `assertAddress` recusa não-ASCII no envelope
  (SMTPUTF8 não implementado), evitando bytes não negociados em
  `MAIL FROM`/`RCPT TO`/cabeçalhos.

Pendências mantidas com justificativa técnica verificável: **A6/8BITMIME** —
o corpo 8-bit continua sem negociação porque todos os destinos homologados
nesta etapa (Mailpit e capturadores locais) suportam `8BITMIME`, a entrega
externa é explicitamente não homologada e trocar a codificação
(quoted-printable/base64 condicional) sem provedor real para validar seria
homologar às cegas — item obrigatório da pauta de homologação externa;
**TOCTOU residual** entre a renovação do lease e o `DATA` (milissegundos,
não eliminável sem idempotency-key suportada pelo servidor SMTP) — coberto
pela garantia at-least-once documentada; **`mocked` não é reentregue** após
troca de modo — comportamento intencional do modo mock explícito, sinalizado
na inicialização; **retenção de PII no outbox** — `payload`/`mock_message`
seguem o ciclo do pedido (`ON DELETE CASCADE`), aceitável para e-mail
transacional do próprio pedido, sem política de poda adicional.

## Etapa anterior — carrinho e perfil (16/10/2026)

Base inicial limpa na `main`, `0d4f80e` (administração já commitada). A leitura
inicial confirmou: inclusão e botão de aumento já limitavam estoque; resumo,
cupom, frete e confirmação já recalculavam dados no servidor; nome e opt-in já
eram editáveis. Essas implementações foram reaproveitadas. As lacunas eram:
setter de quantidade sem limite de estoque, resumo inutilizado por produto
inativo, ausência de aviso/aceite de mudança de preço e de reconferência antes
das ações, e ausência de alteração de e-mail/senha no perfil.

Escopo entregue: revisão de carrinho + continuidade no checkout e edição de
credenciais no perfil. Sem novas tabelas, migrações, dependências ou integrações.
O PostgreSQL descartável da porta 55433 foi reiniciado; testes usaram
`forma_admin_regression_test`, com as nove migrações e seed existentes. Nada
foi criado/alterado por teste no banco habitual. Sem commit, push ou stage.

**HCP** — `server/tests/cart-profile.integration.test.js`: **12/12 testes**
(agrupador + 11 cenários), HTTP e PostgreSQL reais:

- Sessão obrigatória em leitura/edição de perfil, e-mail, senha, cotação e checkout.
  Identificadores/papel no corpo não mudam a identidade do usuário; perfil de outra
  conta permanece intacto. Nome e opt-in continuam persistindo.
- E-mail normalizado e único case-insensitive; formato inválido, ausência de senha
  atual, senha incorreta e duplicidade são recusados sem gravar/revogar sessões.
  Troca válida mantém sessão atual, revoga as demais e passa a valer no login.
- Senha exige atual correta, tamanho 6–128, diferença e confirmação. Scrypt no
  PostgreSQL; hashes/senhas ausentes da resposta. Login antigo falha, novo funciona;
  outra conta mantém suas credenciais. Trocas concorrentes não reutilizam a senha
  antiga duas vezes. Requisição que passou autenticação mas aguardou um lock tem
  a sessão novamente conferida: se foi revogada nesse intervalo, recebe 401.
- Resumo usa preço/promoção atuais, imagem, subtotal/desconto/total em centavos;
  preço local adulterado é ignorado. Mudança de preço altera fingerprint. Produto
  inexistente mantém linha removível sem derrubar os demais itens. Cupom inválido
  ou posteriormente desativado bloqueia avanço, mantém linhas e zera desconto.
- Excesso de estoque, tamanho zerado/retirado e produto desativado bloqueiam antes
  de chamar provedor. Alteração de preço/estoque depois de **cotação SQL simulada**
  impede confirmação e não cria pedido. Validações, locks e fingerprints definitivos
  do servidor permanecem. Um pedido válido com fixture de frete é criado para
  comprovar isolamento real: dono consulta; outra conta recebe 404. Endereço
  alheio também não pode ser listado/editado por outra conta.

**BCP** — `scripts/check-cart-profile-browser.mjs`: **39 verificações** em Brave
headless com API/PostgreSQL. Imagem e promoção reais da API, aumentar/diminuir
até o estoque, cupom válido/inválido, recálculo ao alterar quantidade, recarga,
aviso e aceite de preço novo, redução de estoque ao avançar, bloqueio antes de
cotar, peça esgotada/desativada ainda removível, carrinho vazio após recarga,
falha de API com remoção e recuperação. Depois de selecionar **cotação fictícia
controlada no navegador e SQL**, preço alterado antes de confirmar bloqueou até
o POST do pedido. A fixture não chama nem homologa Melhor Envio ou Mercado Pago.
Perfil: nome, erros de e-mail/formato/duplicidade/senha atual, troca válida,
senha divergente/atual incorreta, sucesso, limpeza de senhas e ausência de senha
no localStorage, recarga e login com novas credenciais. Oito medições de largura
(carrinho/perfil em 1440/768/390/320 px), sem overflow e sem exceções JavaScript.
Capturas/JSON de evidência somente em `.tmp/cart-profile-browser/`, ignorado.

**UCP/VCP** — testes de schemas de credenciais, quantidades estritas, limites de
estoque no setter, cupom preservado/recalculado, remoção por variante, aceite de
preço e proteção contra resposta de estado antigo. `npm test`: 17 arquivos;
`npm test --prefix server`: 12 arquivos sem falhas. Testes padrão não executam
as integrações opt-in com PostgreSQL: HCP foi rodado separadamente com a variável
explícita. Regressões H **9/9** (210 combinações) e HA **10/10** passaram com a API
atual. Lint sem avisos, build concluído e diff sem erros de whitespace.

Mudanças operacionais: o resumo inclui linhas indisponíveis corrigíveis e
`canCheckout`; limites são repetidos no servidor. O front não autoriza avanço
com dados carregando/erro, excesso, cupom inválido ou preço não aceito. Reconsulta
no retorno à aba, recarga, botão de atualizar e antes de avançar/cotar/confirmar;
respostas atrasadas não substituem outro estado. O preço guardado localmente é
somente referência visual; em carrinho antigo sem referência, adota-se o primeiro
preço consultado, sem alegar conhecer o anterior. A seleção continua local ao
navegador e não é sincronizada por conta. Revisão não equivale a reserva de estoque.

Perfil usa os dados e a sessão da API existentes. E-mail/senha têm formulários
separados com senha atual, transação, validação e revogação das outras sessões.
Sem recuperação de senha/verificação da posse do novo e-mail por link, rate
limiting ou transporte de e-mail real; essas limitações não foram disfarçadas.
Frete/Mercado Pago externos continuam não homologados, e-mail mock não envia
mensagens e gerenciamento de cartões ainda não existe. Favoritos, listas e
painel de pedidos não foram alterados nesta etapa.

Reprodução (API/Vite de teste em 3336/5186, ligados à mesma base descartável):

```bash
FORMA_TEST_DATABASE_URL=postgresql://guihca@127.0.0.1:55433/forma_admin_regression_test node --test --test-reporter=tap server/tests/cart-profile.integration.test.js
FORMA_TEST_DATABASE_URL=postgresql://guihca@127.0.0.1:55433/forma_admin_regression_test node scripts/check-cart-profile-browser.mjs
npm test
npm test --prefix server
npm run lint
npm run build
git diff --check
```

Os scripts persistentes recusam URL não local ou sem test/audit no nome. Contas,
produtos, cupons e pedidos desses testes são fictícios. Evidências em `.tmp/`
não fazem parte do commit sugerido. Os servidores de teste e o PostgreSQL
descartável foram encerrados após a validação; serviços habituais preservados.

## Etapa anterior — administração operacional (16/10/2026)

Base inicial limpa na `main`, commit `a0844aa` (catálogo demonstrativo já
commitado). Os blocos históricos abaixo descrevem a entrega anterior. Nesta
etapa foram implementados cadastro/edição no painel existente e contratos
protegidos de listagem/detalhe/gravação, preservando a consulta pela API.
Não foram executados commit, push, pull, checkout ou alterações no índice.

**DA** — PostgreSQL descartável, porta 55433: `0009_admin_produtos.sql` aplicada
sobre o catálogo anterior. Em `forma_admin_regression_test`, as **nove migrações**
foram aplicadas do zero; seed inseriu 12 peças. A regressão H passou novamente:
**9/9 testes, 210 combinações de filtros**. Após validar, a migração 0009 também
foi aplicada ao banco habitual configurado em `server/.env`, sem recriar dados,
executar seed ou incluir produtos de teste nele.

**HA** — `server/tests/admin-products.integration.test.js`, HTTP + SQL reais com
`FORMA_TEST_DATABASE_URL`: **10/10 testes** (agrupador + nove cenários), sem
chamadas a provedores externos:

1. Anônimo recebe 401 e cliente 403 nas seis operações administrativas testadas
   (listagem/detalhe/criação/edição/visão-geral/usuários), antes de gravar uploads.
   Tentativa de conceder papel no registro público continua criando cliente.
2. Criação multipart com imagem PNG local, descrição, cor, grade, preço e promoção;
   arquivo acessível por HTTP e leitura posterior confirma persistência.
3. Campos, booleanos, valores, tamanhos e imagens inválidos recebem 400 sem
   alteração parcial do produto; arquivos de requisições rejeitadas são removidos.
4. Galeria com três imagens mantém as anteriores e seleciona nova principal;
   seis arquivos e arquivo acima de 5 MB são recusados, sem deixar uploads novos.
5. Edição altera a consulta pública; versão antiga recebe 409. Duas gravações
   concorrentes da mesma versão produzem um 200 e um 409.
6. Bloqueio real de variante no PostgreSQL faz edição aguardar. O lock de FK
   usado pelo checkout continua compatível; após mudar estoque, a revisão antiga
   é recusada. O teste exercita esses locks diretamente, sem gateway.
7. Desativação retira a peça do catálogo/detalhe público; consulta administrativa
   mantém acesso. Retirada e reativação de tamanho preservam ID e saldo.
8. Pedido criado pelo serviço real com cotação SQL **simulada** reserva estoque;
   revisão desatualizada é recusada. Preço/cor/status/retirada de tamanho reservado
   são bloqueados; nome pode mudar. Liberação devolve saldo apenas uma vez; CHECK
   do banco impede estoque negativo. A revisão detecta inclusive saldo que volta
   ao valor anterior depois da liberação.
9. Consumo interno de reserva e estado pago preparados como fixture de teste;
   edição posterior não altera itens, snapshots nem total do pedido. Variante e
   arquivo antigo continuam existindo; tamanho retirado não pode ser comprado.
   Isso **não valida Mercado Pago nem representa pagamento externo**.

**BA** — `scripts/check-admin-browser.mjs`, Brave headless + API/PostgreSQL:
**23 verificações aprovadas**. Cliente redirecionado; listagem e seleção; criação
via formulário com arquivo; edição de nome/descrição/cor/estampa/grade/estoque/
preços/imagem; vitrine/detalhe e filtro de cor atualizados; desativar/reativar;
encerrar promoção; reabrir valores persistidos; conflito com outra sessão sem
perder rascunho; reconsulta após conflito. Lista e editor sem overflow em
1440/768/390/320 px; sem exceções JavaScript. JSON e capturas locais em
`.tmp/admin-browser/`. Imagens PNG de um pixel são fixtures de teste, não
fotografias demonstrativas adicionadas ao catálogo habitual.

**UA/VA** — validação de DTO, versão/galeria/limites, conversão exata reais →
centavos e FormData autenticado sem Content-Type manual. `npm test` processou
14 arquivos e `npm test --prefix server` processou dez, sem falhas. Os dois
cenários persistentes são opt-in e foram executados separadamente em HA e H;
o runner padrão não constitui aprovação de testes PostgreSQL. Lint sem avisos,
build concluído e `git diff --check` limpo.

A consulta administrativa agora inclui inativos, estoque por tamanho e links
para edição. Promoções são preços promocionais por produto, conforme RF26;
não foi introduzido um subsistema de campanhas. Cada produto continua sendo
uma cor. Imagens mantidas/novas têm principal selecionável. Uploads aceitam
PNG/JPEG/WebP (MIME e assinatura inicial), até cinco imagens/5 MB cada. Arquivos
anteriores permanecem disponíveis para compras históricas.

Integridade: versão otimista de produto + revisão de estoque, transação e locks;
tamanhos são retirados logicamente, sem DELETE. Reservas pendentes protegem
campos comerciais, embalagem/status e tamanhos reservados. Estoque editado é
saldo disponível, já descontadas reservas. Não se sobrescrevem snapshots e
valores de pedidos anteriores. O seed continua sem sobrescrever edições.

Limites mantidos: gestão de pedidos no painel ainda ausente (tela agora informa
isso explicitamente), frete/Mercado Pago externos não homologados, e-mail mock
**não envia mensagens reais**, gerenciamento de cartões ainda inexistente.
Demais módulos da matriz não foram reauditados funcionalmente nesta etapa.
Os serviços de teste e o PostgreSQL descartável foram encerrados ao final.
A API habitual permaneceu disponível: consulta pública retornou 200 e 12 peças.

Reprodução adicional (banco descartável preparado conforme seção histórica):

```bash
DATABASE_URL=postgresql://guihca@127.0.0.1:55433/forma_catalog_test npm run api:migrate
FORMA_TEST_DATABASE_URL=postgresql://guihca@127.0.0.1:55433/forma_catalog_test node --test --test-reporter=tap server/tests/admin-products.integration.test.js
# Com API 3336/Vite 5186 usando esse mesmo banco:
FORMA_TEST_DATABASE_URL=postgresql://guihca@127.0.0.1:55433/forma_catalog_test node scripts/check-admin-browser.mjs
```

Esses testes criam contas/produtos/pedidos fictícios apenas no banco descartável;
o script recusa URL não local ou sem test/audit no nome. Para H e suas contagens
fixas, use um banco descartável separado, com seed e sem as peças extras de HA/BA.
O ambiente habitual não recebe esses registros. Nenhuma credencial de pagamento
real, cobrança ou promoção de usuário no banco habitual foi executada.

## Base da etapa de catálogo (histórico)

A árvore inicial estava limpa, na `main` em `58532ed`, igual à referência local
`origin/main`. Os commits de Lucas (`4313fd0`, `117eb9b`, `58532ed`) já estavam
no histórico. Não havia merge aberto. Não foram feitos fetch, pull, checkout,
commit ou push nesta etapa.

O arquivo de auditoria citado pelo aluno **não existia nessa árvore nem no
histórico disponível**, assim como os scripts/correções relatados na rodada
anterior. Este documento registra a situação atual e as evidências novas; não
apresenta a rodada anterior como reexecutada ou recuperada do Git. Os problemas
que afetavam esta entrega foram corrigidos no código atual. Os demais módulos
não receberam uma segunda auditoria funcional completa nesta etapa.

## Dados e arquitetura da etapa de catálogo (histórico)

O banco continua PostgreSQL, com as oito migrações existentes. Não foi criada
migração ou arquitetura nova: o modelo já contém `products`, `product_sizes`
e `product_images`. Cada produto representa uma cor; a variante de tamanho
possui estoque próprio. O catálogo não depende do array antigo de dados locais.

- Dados: `server/src/db/demo-products.js`.
- Seed transacional: `server/src/db/seed-demo.js`.
- Comando: `npm run api:seed`, com a mesma DATABASE_URL da API.
- **12 produtos, seis cores, 48 variantes, quatro promoções, 12 datas distintas**.
- Seis peças lisas e seis estampadas; uma peça inteiramente esgotada e outras
  com determinados tamanhos zerados. Preços efetivos entre R$ 79,90 e R$ 149,90.
- Nome, descrição, cor/estampa, preço em centavos, promoção, P/M/G/GG, estoque,
  data de cadastro, peso de 250 g e embalagem de 30 × 25 × 3 cm.
- IDs e datas fixos; advisory lock e transação. `ON CONFLICT DO NOTHING` insere
  somente produtos ausentes e suas relações. Reexecução não duplica imagens ou
  variantes, não repõe estoque, não reativa peças nem sobrescreve preços/datas.
  Produtos fora do seed são preservados. Não há comando de limpeza destrutiva.
- Imagens em `public/products/`: foto original `camisa-preta.png` só na Lavada
  Preta, com SHA-256 igual ao original; outras 11 peças usam SVGs locais com
  identificação explícita de ilustração/ausência de fotografia. Não há links
  externos nem fotos de uma peça atribuídas a outra.
- Imagens de cadastro (`uploads/...`) são resolvidas contra a origem da API;
  assets demonstrativos (`/products/...`) são servidos pelo front. O upload
  existente agora usa `server/.local/uploads` e a API serve `/uploads`.

## Evidências da etapa de catálogo (histórico)

**D** — banco PostgreSQL 18.6 descartável novo, porta 55433. Oito migrações
aplicadas. Seed CLI: primeira execução **12 inseridos/0 existentes**; segunda
**0 inseridos/12 existentes**. O executor foi repetido sem migrações pendentes.

**H** — `server/tests/catalog.test.js`, com `FORMA_TEST_DATABASE_URL` explícita:
HTTP e SQL reais, sem chamadas externas. Nove testes contando o agrupador e o
check de assets, com sete cenários persistentes:

1. Seed repetido/concorrente: contagens 12 produtos/48 variantes/12 imagens;
   estoque, preço, data e desativação alterados são preservados. Os valores
   modificados pelo próprio teste são restaurados somente no banco descartável.
2. Inclusão de uma cor extra na API e exclusão após desativar a peça, sem
   reduzir opções ao filtrar outra cor; produto externo ao seed preservado.
3. **210 combinações** de cor, estampa, tamanho e promoção comparadas ao
   conjunto esperado, incluindo combinações vazias e exclusão de tamanho zerado.
4. Cinco ordenações verificadas entre todos os resultados; preço efetivo inclui
   promoção, A–Z normaliza acentos portugueses e empates têm UUID estável.
5. Detalhe por UUID, descrição, imagem e grade completa mesmo após filtro por
   tamanho. UUID inválido → 400; UUID inexistente → 404.
6. Carrinho/cupom: duas peças a R$ 109,90, subtotal R$ 219,80, desconto R$ 21,98
   e total R$ 197,82. Preço enviado pelo cliente é ignorado; imagem corresponde.
7. Variante zerada, peça esgotada e quantidade acima do estoque recebem
   `estoque_indisponivel` antes de chamar frete externo. Mesmo com cotação local
   de teste, a criação do pedido recusa esses itens e não grava nenhum pedido.
   A cotação usada nesse cenário é uma fixture SQL, não uma integração de frete.

**U** — `tests/catalog.test.js`: URL de imagem local/upload, rejeição de URL
externa/caminho inválido, filtro booleano `false` para peças lisas e recusa no
carrinho de tamanho inexistente, zerado ou acima do estoque.

**B** — `scripts/check-catalog-browser.mjs`, Brave headless/Chromium com API real:
quatro destaques disponíveis, 12 peças, seis cores, cinco ordenações, combinação
preta/estampada/M/promoção, persistência de filtros pela URL após recarga,
resultado vazio, limpar filtros, preço/datas na ordenação, detalhe direto,
foto correta, placeholder identificado, promoção, tamanho zerado desabilitado,
imagem/preço/variante no carrinho após recarga, checkout bloqueado para item
esgotado inserido diretamente no localStorage, consulta administrativa de 12
peças e quatro promoções. Cinco telas em 1440/768/390/320 px, sem overflow.
Também verifica fallback de imagem indisponível e mensagem de erro quando a
requisição de catálogo é bloqueada. Capturas e JSON em `.tmp/catalog-browser/`.

**V** — `npm run lint`, `npm run build`, `npm test` e
`npm test --prefix server`. Os testes padrão não substituem H: sem a variável
opt-in, o cenário com banco não é executado. As dependências já estavam
instaladas pelos lockfiles existentes; não foram adicionadas dependências.

Resultados finais: **H 9/9 testes aprovados**, incluindo as 210 combinações;
**B 43 verificações aprovadas**, incluindo 20 medições de tela/largura, fallback
de imagem e falha de API; lint sem avisos e build concluído. O runner padrão
processou 11 arquivos na raiz e oito no servidor, sem falhas. Uma tentativa
inicial de build terminou com código 137 sem diagnóstico; a execução isolada
e a verificação final concluíram normalmente. Não foi classificada como sucesso
aquela tentativa interrompida. A instância descartável e os serviços de teste
foram encerrados após a validação; os comandos acima permitem reproduzir.

## Matriz atualizada de aderência

Atendido = comportamento coberto nesta etapa, ou implementação legada indicada
como tal. Parcial = escopo incompleto ou validação externa pendente. Ausente =
a ação exigida não existe. A coluna de testes distingue execução de inspeção;
não considera módulos legados aprovados apenas porque compilam.

| Requisito | Status | Evidência no código | Teste nesta etapa | Pendência |
|---|---|---|---|---|
| RF01 Cadastro antes da finalização | Atendido no escopo local | `requireAuth` em frete/checkout; autenticação existente | HCP: cotação/checkout anônimos → 401; BCP: sessão validada | Pagamento externo não homologado |
| RF02 Opt-in | Atendido na implementação legada | `Auth.jsx`, `users.promo` | Testes existentes de serviços/validações | Comunicações promocionais não implementadas |
| RF03 Autenticação | Atendido na implementação legada | `auth.service.js`, `AuthProvider.jsx` | H/B usam cadastro e sessão reais | Logout/expiração não revalidados aqui |
| RF04 Perfil | Atendido no escopo local | `Account.jsx`, schemas/auth service; PUT `/auth/eu/email` e `/auth/eu/senha` | HCP/BCP: nome, opt-in, e-mail/senha, recarga, erros, isolamento, revogação | Sem recuperação de senha ou verificação de posse de e-mail por link |
| RF05 Endereços | Atendido na implementação legada | `enderecos.service.js`, `Addresses.jsx` | H cria endereço real para testar recusa de estoque | Edição/principal/isolamento não revalidados aqui |
| RF06 Cartões | Ausente | `Collections.jsx:Cards` só informa delegação | Inspeção | Gerenciamento ainda não existe; carteira externa não validada |
| RF07 Catálogo | Atendido para demonstração local | `demo-products.js`, `ProductCard`, `ProductImage`, `Home`, `Catalog`, `Product` | D/H/B: dados, vitrine, detalhe, foto, placeholders, recarga | Substituir ilustrações quando houver fotografias correspondentes |
| RF08 Cor | Atendido | `getProducts` retorna `filters.colors`; seletor dinâmico | H/B, inclusive cor criada após seed | — |
| RF09 Estampa | Atendido | `is_printed` no SQL e URL da tela | H/U/B: true/false e combinações | — |
| RF10 Tamanho | Atendido | `EXISTS` com estoque positivo; grade preservada | H/B: P/M/G/GG, tamanhos zerados | — |
| RF11 Promoção | Atendido | Filtro SQL e preços promocionais reais | H/B: quatro promoções e combinações | — |
| RF12 A–Z/preços/datas | Atendido | Cinco opções no front e SQL; acentos e desempate | H/B: inclusive mais antigos e recarga | — |
| RF13 Carrinho | Atendido no escopo local | `cart.js`, `cartReview.js`, `Cart.jsx`, resumo e validações definitivas | HCP/UCP/BCP: imagens, quantidades/limites, remoção, cupom/totais, recarga, mudanças entre inclusão/finalização, erros de rede | Seleção local ao navegador, sem sincronização por conta; revisão não reserva estoque |
| RF14 Cupons | Atendido no escopo testado | `validateCoupon`; resumo com couponError; aplicação/remoção no carrinho | HCP/BCP: válido/inválido, desativado após aplicação, preço promocional, quantidade e totais | Gestão de cupons no painel fora deste escopo |
| RF15 Frete | Parcial | `shipping.provider.js` | H testa somente recusa de estoque antes de cotar | Credenciais/OAuth/cotação real não validados |
| RF16 Checkout | Parcial | `Checkout.jsx` usa revisão antes de cotar/confirmar; servidor mantém locks/fingerprints | HCP: alteração após fixture SQL recusada; BCP: preço antes de confirmar impede POST | Compra completa depende de provedores externos ainda não homologados |
| RF17 Mercado Pago | Parcial | SDK, gateway e módulos de pagamento existentes | Somente testes existentes de segurança | Não homologado externamente; nenhum pagamento/cobrança feito |
| RF18 E-mail de compra | Parcial — implementado, validação pendente | `email.service.js` + `smtp.client.js`; `purchase_confirmation` na transição para `pago`; migração `0010` | Testes criados nesta etapa (`email-purchase.test.js`, `email-confirmation.integration.test.js`) — **não executados** | Executar testes/lint/build; homologar entrega externa; e-mail legado de pedido recebido mantido |
| RF19 Favoritos | Parcial nesta árvore | API persiste IDs; tela usa `findProduct` em memória | Inspeção; não revalidado | Recarga direta depende de cache: correção anterior não estava na árvore |
| RF20 Listas | Parcial nesta árvore | API persistente; `ListItems` usa cache de produto | Inspeção; não revalidado | Mesma limitação de recarga; texto de lista vazia ainda fixo |
| RF21 Sobre Nós | Atendido na implementação legada | `About.jsx` | Inspeção | Texto contém referência à etapa antiga do catálogo |
| RF22 Administração restrita | Atendido | `RequireRole`; `adminRouter.use(requireAuth, requireRole)` antes dos uploads | HA: 401/403 em leitura/escrita; BA: cliente redirecionado, admin opera | — |
| RF23 Produtos | Atendido | `Administration.jsx`, `AdminProducts.jsx`, `products.schemas/service.js`; GET/POST/PUT protegidos | HA/BA: criar, selecionar, editar, imagens, desativar, recarga e vitrine | Gestão de pedidos é outro fluxo e continua pendente |
| RF24 Alterar preços | Atendido | Campos normal/promocional em reais; centavos inteiros no servidor | HA/UA/BA: atualizar preços e refletir na API/vitrine; pedido antigo preservado | Reservas pendentes bloqueiam alteração comercial |
| RF25 Tamanhos/estoque | Atendido | Migração 0009, revisão/retirada lógica; consultas públicas excluem variantes inativas | HA/BA: editar saldo, retirar/reativar tamanho, mesmo ID, estoque negativo recusado, concorrência e reservas | Estoque informado é disponível, descontadas reservas |
| RF26 Promoções | Atendido | Preço promocional por produto e aba Promoções reais | HA/BA: criar/alterar/remover desconto e preço público; validação menor que normal | Sem motor de campanhas, não exigido por RF26 |
| RNF01 React | Atendido | Componentes React existentes e reutilizáveis | V/B | — |
| RNF02 PostgreSQL | Parcial | Nove migrações e seed no modelo existente | DA/H/HA | Carrinho continua em localStorage |
| RNF03 Responsividade | Parcial, atendido nas telas testadas | CSS existente e componentes do catálogo | B: cinco telas × quatro larguras; BA: lista/editor; BCP: carrinho/perfil em quatro larguras | Demais telas/aparelhos físicos não revalidados |
| RNF04 Usabilidade | Parcial | Rótulos, erros, URL de filtros, imagens, estoque e preços | B | Revisão completa de acessibilidade e fluxos fora do catálogo |
| RNF05 Identidade | Atendido | Variáveis FORMA e hero preservados | CSS, B e capturas | Sem comparação pixel a pixel de todas as telas |
| RNF06 Segurança de autenticação | Parcial | Scrypt, Bearer, reautenticação de credenciais e locks/sessões | HCP: hash, login novo/antigo, concorrência e revogação; BCP: sem senha persistida | HTTP/localStorage, sem rate limiting/recuperação/verificação de e-mail |
| RNF07 Segurança de pagamento | Parcial | Checkout hospedado, sem PAN/CVV no modelo | Testes existentes de assinatura/ambiente | Gateway externo não validado |
| RNF08 Controle de acesso | Atendido nos escopos testados | Middleware global admin e req.user.id na conta | HA/BA: administração; HCP: perfil, credenciais, endereço/pedido alheio | Demais fluxos de conta fora desta rodada |
| RNF09 Proteção de dados | Parcial | Perfil pela sessão, scrypt, transação, revalidação após lock | HCP: outra conta inalterada e endereço/pedido real isolados; BCP: senhas não persistidas | Endurecimento geral e demais módulos não reauditados |
| RNF10 Desempenho | Parcial | Filtros SQL, imagens lazy, cancelamento lógico de respostas antigas | H/B/V com 12 peças | Sem paginação/carga; foto e hero originais ainda grandes |
| RNF11 Compatibilidade | Parcial | APIs web padrão | B em Brave/Chromium | Firefox/WebKit não testados |
| RNF12 Manutenibilidade | Parcial | Componentes de imagem/card, seed separado, testes | H/U/V | Consolidar documentação histórica e módulos legados |
| RNF13 Consistência do pedido | Parcial | Revisão do carrinho e transações/locks/fingerprints definitivos preservados | HCP/HA: estoque, reservas, concorrência; BCP: preço/estoque antes de ações | Ciclo externo de pagamento não homologado |
| RNF14 E-mails/consentimento | Parcial — transacional implementado, validação pendente | `users.promo` não é consultado no fluxo transacional; mock explícito; SMTP configurável por env | Integração criada cobre `promo=false`; **não executada nesta rodada** | Executar testes; e-mails promocionais com opt-in continuam inexistentes; entrega externa não homologada |

## Reproduzir sem tocar no banco habitual

Os binários PostgreSQL já estavam disponíveis. A instância abaixo é isolada em
`/tmp` e loopback; trust é exclusivo desse ambiente descartável. Use diretório
e nome de banco novos para repetir a criação; adapte `guihca` ao usuário local.
Nenhum `.env` habitual foi modificado.

```bash
initdb -D /tmp/forma-catalog-pg-20261016 --auth-local=trust --auth-host=trust --encoding=UTF8 --locale=C
pg_ctl -D /tmp/forma-catalog-pg-20261016 -l /tmp/forma-catalog-pg-20261016.log -o '-h 127.0.0.1 -p 55433 -k /tmp' start
createdb -h 127.0.0.1 -p 55433 -U guihca forma_catalog_test
DATABASE_URL=postgresql://guihca@127.0.0.1:55433/forma_catalog_test npm run api:migrate
DATABASE_URL=postgresql://guihca@127.0.0.1:55433/forma_catalog_test npm run api:seed
DATABASE_URL=postgresql://guihca@127.0.0.1:55433/forma_catalog_test npm run api:seed
FORMA_TEST_DATABASE_URL=postgresql://guihca@127.0.0.1:55433/forma_catalog_test node --test --test-reporter=tap server/tests/catalog.test.js

# Em terminais separados, com a mesma base:
DATABASE_URL=postgresql://guihca@127.0.0.1:55433/forma_catalog_test PORT=3336 CORS_ORIGIN=http://127.0.0.1:5186 npm run api
VITE_API_URL=http://127.0.0.1:3336/api npm run dev -- --host 127.0.0.1 --port 5186 --strictPort
FORMA_TEST_DATABASE_URL=postgresql://guihca@127.0.0.1:55433/forma_catalog_test node scripts/check-catalog-browser.mjs

npm run lint
npm run build
npm test
npm test --prefix server
# Após encerrar API/Vite de teste:
pg_ctl -D /tmp/forma-catalog-pg-20261016 stop
```

O navegador usa perfil temporário e cria/promove apenas uma conta fictícia no
banco descartável via SQL para consultar o painel. Não há endpoint público de
promoção de papel. JSON e capturas ficam em `.tmp/`, ignorado pelo Git.

## Limites e próximas etapas

Frete/Mercado Pago externos não foram chamados, não receberam credenciais reais
e não foram homologados. A entrega de e-mail agora tem transporte SMTP
configurável (etapa de 16/10/2026), mas os testes dessa etapa **não foram
executados** e a entrega externa (provedor real, TLS/AUTH/SPF) segue sem
homologação; e-mails promocionais com opt-in e gerenciamento de cartões ainda
não existem. A proposta Vercel/Supabase do PDF permanece fora do escopo local
atual. A validação inicial usou somente banco descartável; a preparação
persistente adicionada posteriormente está descrita abaixo.

Próximos commits sugeridos após catálogo/administração/carrinho/perfil/e-mail:
executar as verificações pendentes da etapa de e-mail (testes, lint, build e
Mailpit local), corrigir lacunas de favoritos/listas, implementar
consulta/gestão administrativa de pedidos, depois homologar sandbox de
frete/pagamento e a entrega externa de e-mail. Esses fluxos continuam
pendentes; não foram classificados como concluídos.

## Complemento — inicialização local após erro de DATABASE_URL

Após o aluno abrir a aplicação, foi confirmado que `server/.env` não existia e
não havia PostgreSQL na porta padrão. O banco descartável anterior estava
encerrado. Foi adicionado `npm run api:setup`: cria/inicia PostgreSQL persistente
exclusivo em `127.0.0.1:55434`, gera senha aleatória e `server/.env` privado,
aplica migrações e seed. Dados em `.local/postgres`, socket privado em
`.local/postgres-socket`; senha/.env com modo 600 e pastas com modo 700.
`git check-ignore` confirmou que dados e credenciais não entram no Git.
Uma configuração `.env` preexistente não é sobrescrita. Não há sudo nem
alteração de serviço do sistema. `npm run db:local` reinicia esse banco após
reiniciar a máquina. A API lê `server/.env` independentemente do CWD.

Verificação: primeira preparação aplicou oito migrações e inseriu 12 peças;
segunda preparação não tinha migrações pendentes e inseriu zero peças.
`/api/health` confirmou banco saudável. Brave headless em `localhost:5173`
carregou quatro destaques e 12 peças do catálogo, sem alerta de conexão/CORS.
Lint, os 11 arquivos de teste padrão e `git diff --check` passaram. API em 3333
e banco local foram deixados ligados para o aluno usar; nenhum commit/push.
