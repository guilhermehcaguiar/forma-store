# Entrega local — 22/10/2026

Projeto acadêmico demonstrável com PostgreSQL local. As integrações externas
continuam **parciais**, pois não há credenciais sandbox configuradas.
Não houve cobrança, etiqueta de envio ou entrega de e-mail externa.

## Usar a loja

Pré-requisitos: Node.js 20.19+ ou 22.12+, npm e PostgreSQL local com `initdb`,
`pg_ctl` e `createdb` no PATH. Dependências já estavam instaladas nesta máquina.
Em outra instalação, execute `npm ci` e `npm ci --prefix server`.

```bash
npm run api:setup
npm run api:admin:demo
npm run api
# Em outro terminal:
npm run dev
```

Abra **http://localhost:5173**. API em http://localhost:3333/api/health.
Use sempre a mesma origem durante a aula; o token e o carrinho pertencem ao
navegador. Não substitua `server/.env` preexistente. `api:setup` preserva dados,
aplica migrações e insere apenas produtos demonstrativos ausentes. O PostgreSQL
persistente fica em `.local/postgres`, porta 55434; após reiniciar a máquina,
`npm run db:local` o inicia novamente.

Administrador: **admin@forma.local** / **FormaDemo2026!** em `/login`.
Abra `/administracao/produtos`, `/administracao/promocoes` ou
`/administracao/pedidos`. O provisionamento só funciona em development/test e
PostgreSQL loopback. Usa scrypt e login normal; preserva senha/nome/papel caso o
e-mail já exista. Não há bypass, promoção pública ou botão para forçar “pago”.
No banco habitual, o login e os dois endpoints admin retornaram 200; há 12
produtos e nenhum pedido. A edição de produtos foi testada só em bases descartáveis.

## O que foi entregue

- Catálogo: 11 imagens IA individuais em WebP, sem hotlinks ou foto repetida,
  correspondentes à cor/estampa. Origem, prompts e arquivos em [IMAGENS.md](IMAGENS.md).
  Hero e camisa preta preexistentes também têm versões WebP; originais/SVGs
  preservados para fallback e referências históricas. Seed protege edições do admin.
- Administração: provisionamento local idempotente e consulta dos últimos 200
  pedidos, seus estados, itens históricos e valores; filtros de estado na tela.
- Cartões: API autenticada e tela de listar/adicionar/remover; Secure Fields MP,
  pagamento em uma parcela com cartão salvo após criar pedido ou pelo histórico;
  Checkout Pro preservado. Migração 0012 guarda somente IDs de vínculo para
  reconciliar timeout/exclusão. Tokens ficam só em memória e não são logados.
  Nenhum cartão real/teste foi enviado ao provedor nesta rodada: sandbox pendente.
- Conta: favoritos e listas consultam produtos na API após recarga direta;
  imagens/links e contagem de listas reais. Sobre Nós e estado final do checkout
  atualizados. A aprovação fixture percorreu o mesmo fluxo de estoque/outbox existente.

## Resultados observados

| Verificação | Resultado |
|---|---|
| Migrações 0001–0011 do zero | 11 aplicadas com sucesso no PostgreSQL descartável |
| Migração complementar 0012 | Aplicada incrementalmente e do zero nas bases da suíte |
| Upgrade com dados legados | 0010 → 0011 → 0012; usuário, opt-in, produto/preço, pedido e tentativa preservados; 1/1 |
| Seed duas vezes | 12 inseridos e depois 0; 12 produtos, 48 variantes, 12 imagens |
| Suíte detalhada API | **110/110**, 17 arquivos, zero falhas e skips; `npm run test:db` |
| Comandos padrão | `npm test`: 22 arquivos aprovados; `npm test --prefix server`: 17 arquivos; integrações opt-in exigem a suíte com banco |
| Lint | `npm run lint`, exit 0 |
| Build | `npm run build`, exit 0; 69 módulos; JS 359,84 kB / gzip 107,64 kB; CSS 26,81 kB / gzip 5,49 kB; hero 80,08 kB |
| Diff | `git diff --check`, exit 0 |
| Navegador catálogo | 43 checks, larguras 1440/768/390/320 |
| Navegador administração | 23 checks, larguras 1440/768/390/320 |
| Navegador carrinho/perfil | 39 checks, larguras 1440/768/390/320 |
| Navegador compra completa | 30 checks, 1440/390; quatro mensagens em SMTP de captura |
| Verificador geral adicional | 20 rotas × 7 larguras (140 verificações de layout), autenticação/endereços/listas/menu; exit 0 |
| Total estruturado de navegador | **135 checks**, sem exceções JS nem overflow nas verificações |
| Provedores externos | **Zero chamadas** a Mercado Pago/Melhor Envio; SMTP apenas loopback |

O fluxo completo registra cliente pelo formulário, salva favorito/lista, recarrega
diretamente essas telas, salva endereço, aplica FORMA10 (R$ 109,90 → R$ 98,91),
seleciona frete fixture de R$ 10,00, registra pedido de R$ 108,91 pela API real,
confirma pagamento por fixture explícita, captura e-mail via SMTP e consulta o
histórico; depois faz login normal de admin e consulta os pedidos. Não comprova
SDK MP nem frete externo. O teste administrativo separado edita produto e
confere a alteração na vitrine, desativação/reativação, promoções e conflitos.

Houve falhas iniciais nas ferramentas de teste, corrigidas e reexecutadas:
outbox compartilhado entre arquivos; waits que liam o DOM antes do commit React;
fixture de upgrade incompleta; IDs de pagamento fixos repetidos na mesma base.
O executor `test:db` cria base própria por arquivo para isolar SMTP e dados.
O verificador geral revelou overflow real do cupom em 901 px: o formulário agora
permite quebra de linha e o botão permanece dentro do resumo do carrinho.

O verificador geral legado imprimia a contagem fixa “21 telas”; sua lista contém
20 rotas. O rótulo foi corrigido para usar o tamanho real da lista; o log bruto
da execução bem-sucedida foi preservado sem edição.

Resultados detalhados ficam em `.tmp/db-tests/` e
`.tmp/{catalog,admin,cart-profile,demo}-browser/results.json`; capturas nos mesmos
diretórios. `.tmp` é ignorado pelo Git. Não são provas de Firefox/WebKit nem de
aparelhos físicos. A matriz dos 40 requisitos está em
[AUDITORIA_REQUISITOS.md](AUDITORIA_REQUISITOS.md).

## Reproduzir testes com banco descartável

Use diretório e base novos se estes nomes já existirem. Nenhum comando abaixo
aponta para o banco habitual. Trust está restrito ao PostgreSQL descartável em
loopback; não altere o serviço PostgreSQL do sistema.

```bash
initdb -D /tmp/forma-revalidacao-pg --auth-local=trust --auth-host=trust --encoding=UTF8 --locale=C
pg_ctl -D /tmp/forma-revalidacao-pg -l /tmp/forma-revalidacao-pg.log -o '-h 127.0.0.1 -p 55435 -k /tmp' start
createdb -h 127.0.0.1 -p 55435 forma_revalidacao_test
FORMA_TEST_DATABASE_URL=postgresql://guihca@127.0.0.1:55435/forma_revalidacao_test npm run test:db
npm test
npm test --prefix server
npm run lint
npm run build
git diff --check
```

Substitua `guihca` pelo usuário local em outra máquina. O executor cria bases
novas, aplica todas as migrações e grava TAP/JSON. Pode repetir sem reutilizar
dados anteriores. Os bancos de evidência ficam na instância descartável até
ela ser descartada pelo responsável.

Para navegador, crie uma base nova local `forma_browser_test`, aplique
migrações/seed nela e suba API/Vite em terminais separados:

```bash
createdb -h 127.0.0.1 -p 55435 forma_browser_test
DATABASE_URL=postgresql://guihca@127.0.0.1:55435/forma_browser_test npm run api:migrate
DATABASE_URL=postgresql://guihca@127.0.0.1:55435/forma_browser_test npm run api:seed
DATABASE_URL=postgresql://guihca@127.0.0.1:55435/forma_browser_test PORT=3337 CORS_ORIGIN=http://127.0.0.1:5187 npm run api
# Outro terminal:
VITE_API_URL=http://127.0.0.1:3337/api npm run dev -- --host 127.0.0.1 --port 5187 --strictPort
```

Rode catálogo **primeiro**, em base com apenas as 12 peças; as outras verificações
criam produtos/pedidos auxiliares. Cada comando recebe o mesmo ambiente:

```bash
FORMA_TEST_DATABASE_URL=postgresql://guihca@127.0.0.1:55435/forma_browser_test FORMA_BROWSER_ORIGIN=http://127.0.0.1:5187 FORMA_BROWSER_API=http://127.0.0.1:3337 FORMA_BROWSER=/usr/bin/brave node scripts/check-catalog-browser.mjs
# Repita o prefixo de ambiente acima com cada script:
# scripts/check-demo-browser.mjs
# scripts/check-admin-browser.mjs
# scripts/check-cart-profile-browser.mjs
```

O script de compra intercepta somente a cotação com fixture e usa a transição
real de pagamento com payload fixture; não instala endpoints de simulação no app.
O cliente/tokens de sessão ficam em memória e no perfil temporário do navegador;
nenhum token temporário de cartão é capturado. O SMTP de captura é criado e
fechado pelo próprio teste. Para parar a instância de testes após encerrar
as APIs de teste: `pg_ctl -D /tmp/forma-revalidacao-pg stop`.

## Homologação posterior — somente serviços de teste

1. **Mercado Pago:** no painel de desenvolvedor, obtenha vendedor/comprador de
   teste e credenciais da mesma aplicação. Configure em `server/.env`
   `MERCADOPAGO_MODE=sandbox`, `MERCADOPAGO_TEST_ACCESS_TOKEN`,
   `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET` e
   `MERCADOPAGO_PUBLIC_URL` (túnel HTTPS temporário para API 3333).
   `MERCADOPAGO_FRONTEND_URL=http://localhost:5173`. Cadastre a URL
   `<túnel>/api/pagamentos/webhook`, tópico `payment`. Reinicie a API.
2. Registre uma conta FORMA usando o e-mail de comprador de teste aceito pelo
   Customer API (a documentação atual menciona `test_payer_[0-9]{1,10}@testuser.com`).
   Em `/minha-conta/cartoes`, adicione cartão de teste usando somente Secure
   Fields; confira marca/final/validade. Recarregue, use outra conta e confira
   que ela não vê/remove/paga com o cartão. Remova e adicione novamente.
3. Faça pedido com cotação de frete real sandbox. No cartão salvo, confirme o
   CVV no iframe, pague em uma parcela e confira no provedor `live_mode=false`,
   referência, total e os IDs esperados de cliente/cartão. Verifique aprovação,
   pendência e recusa com os dados oficiais para **Payments API**; não use a
   tabela de Orders API. Se a resposta tiver identificadores diferentes do
   contrato esperado, ela deve ser recusada e o vínculo precisa ser homologado
   antes de classificar RF06 como atendido.
4. Confira webhook assinado e `Consultar pagamento solicitado`. Reentrega não
   duplica compra, consumo de reserva ou linha de e-mail. Para timeout sem ID,
   encontre o pagamento no painel de teste e envie `{ paymentId }` à rota
   `/api/pagamentos/pedidos/:id/verificar`, com sessão do dono. Nenhuma nova
   cobrança deve ocorrer. Pedido expirado/aprovação tardia exige revisão manual.
5. Faça **outro pedido** e escolha Checkout Pro. Complete só o checkout sandbox;
   retorno do navegador não confirma pagamento. Confira consulta/webhook e e-mail.
6. **Melhor Envio:** configure `MELHOR_ENVIO_CLIENT_ID`, `MELHOR_ENVIO_CLIENT_SECRET`,
   `MELHOR_ENVIO_REDIRECT_URI`, CEP de origem e user agent; execute
   `npm run api:melhor-envio:autorizar` e autorize a aplicação sandbox.
   Cadastre endereço fictício com CEP válido; consulte cotação, compare preço/prazo
   com sandbox, teste CEP/serviço indisponível e cotação expirada. Não compre etiqueta.
7. **E-mail:** primeiro rode Mailpit local, configure `FORMA_EMAIL_MODE=smtp`,
   host 127.0.0.1, porta 1025, secure none, sem autenticação; confira em 8025 o
   recibo e a confirmação após aprovação. Isso valida só captura local. Para
   homologar entrega externa, configure SMTP TLS/AUTH/remetente autorizado e
   um destino de teste próprio; valide entrega e falhas/backoff, sem contatos reais.
   Opt-in desmarcado não deve impedir transacional; disparo promocional continua
   ausente. O transporte é at-least-once: falha após aceite SMTP e antes de gravar
   `sent` pode reenviar a mesma mensagem.

Referências consultadas em 22/10/2026:
[Customers/cartões e recaptura de CVV](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/improve-payment-approval/saved-cards),
[contrato Payments versus Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/migrate-payments-to-orders),
[Secure Fields do SDK JS](https://github.com/mercadopago/sdk-js/blob/main/docs/fields.md).

## Revisão e commits manuais

Branch permaneceu `main`, HEAD `d52c74e`. Nenhuma alteração foi preparada ou
commitada. A lista exata de arquivos está no `git status --short` e no relatório
`.tmp/final-validation/git-status.txt`; mudanças incluem imagens/manifesto,
seed, conta, admin, gateway/carteira, migração 0012, testes e documentação.

Sugestões de separação para o responsável executar manualmente:

1. `feat: renovar imagens locais do catálogo e preservar edições no seed`
2. `feat: provisionar admin local e consultar pedidos administrativos`
3. `feat: gerenciar cartões tokenizados e pagamento salvo no sandbox`
4. `fix: resolver favoritos e listas após recarga e atualizar checkout`
5. `test: consolidar validação local e documentação acadêmica`

Arquivos compartilhados, como `App.jsx`, README e contratos, podem exigir separar
hunks para manter os commits coerentes. Nenhum desses commits foi executado.

Ao finalizar esta sessão, as APIs/Vites e o PostgreSQL de teste foram encerrados.
A API habitual em 3333, Vite em 5173 e PostgreSQL em 55434 permaneceram ligados.

## Arquivos alterados — status final

```text
 M README.md
 M docs/forma/API_CONTRATOS.md
 M docs/forma/AUDITORIA_REQUISITOS.md
 M package.json
 M scripts/check-browser.mjs
 M scripts/check-catalog-browser.mjs
 M server/.env.example
 M server/src/app.js
 M server/src/db/demo-products.js
 M server/src/db/seed-demo.js
 M server/src/modules/admin/admin.routes.js
 M server/src/modules/admin/admin.service.js
 M server/src/modules/payments/mercadopago.gateway.js
 M server/src/modules/payments/payments.routes.js
 M server/src/modules/payments/payments.service.js
 M server/tests/cards-migration.integration.test.js
 M server/tests/catalog.test.js
 M src/App.jsx
 M src/components/ProductImage.jsx
 M src/pages/About.jsx
 M src/pages/Administration.jsx
 M src/pages/Catalog.jsx
 M src/pages/Checkout.jsx
 M src/pages/Home.jsx
 M src/pages/account/Collections.jsx
 M src/pages/account/Lists.jsx
 M src/styles/global.css
?? docs/forma/ENTREGA_LOCAL.md
?? docs/forma/IMAGENS.md
?? public/products/camisa-preta.webp
?? public/products/demo-10.webp
?? public/products/demo-11.webp
?? public/products/demo-12.webp
?? public/products/demo-2.webp
?? public/products/demo-3.webp
?? public/products/demo-4.webp
?? public/products/demo-5.webp
?? public/products/demo-6.webp
?? public/products/demo-7.webp
?? public/products/demo-8.webp
?? public/products/demo-9.webp
?? scripts/catalog-image-manifest.json
?? scripts/check-db-tests.mjs
?? scripts/check-demo-browser.mjs
?? server/src/db/demo-admin.js
?? server/src/db/migrations/0012_vinculo_pagamento_cartao.sql
?? server/src/modules/payments/cards.routes.js
?? server/src/modules/payments/cards.service.js
?? server/src/scripts/demo-admin.js
?? server/tests/demo-cards.integration.test.js
?? server/tests/upgrade.integration.test.js
?? src/assets/hero-editorial.webp
?? src/components/SavedCardPayment.jsx
?? src/pages/account/Cards.jsx
?? src/pages/admin/AdminOrders.jsx
?? src/services/cardSdk.js
```
