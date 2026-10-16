# Entrega 04 — Pedidos e Mercado Pago (teste)

Data: 15/10/2026.

## Escolha de checkout e cartões

O FORMA usa **Checkout Pro hospedado**. O comprador é redirecionado ao ambiente
seguro do Mercado Pago e pode pagar com cartão salvo na conta Mercado Pago ou
adicionar um cartão ali. A documentação oficial descreve esses meios salvos; a
FORMA não coleta nem persiste PAN, CVV, validade ou tokens de cartão. A tela
`Minha Conta > Cartões` informa que o gerenciamento fica com o gateway, não na
loja.

Esta escolha atende ao RF06 sem implementar tokenização de cartão no FORMA e
mantém o visual atual do checkout. A preferência é criada no servidor a partir
do pedido já persistido, com o total de itens + desconto + frete; o cliente
recebe apenas um link `sandbox_init_point` HTTPS. A API recusa resposta sem link
de sandbox e fixa `MERCADOPAGO_MODE=sandbox`.
O e-mail cadastrado no FORMA não é enviado como `payer`: o comprador autentica a
conta de teste Mercado Pago no Checkout Pro para que a carteira/cartões salvos
sejam os da própria conta de teste.

## Configuração local de teste

1. Crie uma aplicação em Suas integrações do Mercado Pago e use **somente o
   Access Token de teste** da aplicação Checkout Pro. Nunca use credenciais de
   produção. Configure as variáveis em `server/.env`:
   `MERCADOPAGO_MODE=sandbox`, `MERCADOPAGO_TEST_ACCESS_TOKEN`,
   `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_PUBLIC_URL` e
   `MERCADOPAGO_FRONTEND_URL=http://localhost:5173`.
2. Inicie o PostgreSQL e aplique a nova migração com `npm run api:migrate`.
   Inicie a API por `npm run api` e o front por `npm run dev`.
3. Para expor apenas os callbacks durante o teste, em outro terminal execute
   `ngrok http 3333`. Copie o endereço **HTTPS temporário** emitido pelo túnel
   para `MERCADOPAGO_PUBLIC_URL` (sem caminho). Reinicie a API se alterou `.env`.
   O túnel encaminha para o processo local; não é hospedagem permanente. Pode
   ser usado outro túnel HTTPS equivalente, desde que mantenha a URL acessível
   enquanto o pagamento/webhook de teste estiver em andamento.
4. No painel da aplicação, configure a URL de webhook em modo **teste** como
   `{MERCADOPAGO_PUBLIC_URL}/api/pagamentos/webhook`, selecione o evento
   `payment` e copie a assinatura secreta gerada para
   `MERCADOPAGO_WEBHOOK_SECRET`. Não configure uma URL em modo produção.
5. Use uma conta de teste vendedora (o Mercado Pago cria uma para a aplicação)
   e uma conta de teste compradora do mesmo país. No Checkout Pro, faça o teste
   numa janela anônima e use os cartões e cenários da documentação oficial.

O `back_url` não aponta diretamente para `localhost`: é o endpoint público
HTTPS temporário `/api/pagamentos/retorno`, que apenas redireciona ao front local.
Parâmetros `status`, `collection_status` ou equivalentes recebidos no retorno
são ignorados para aprovação. O token de acesso continua exclusivamente em
`server/.env`; o webhook secret também não sai do servidor.

## Pedido, reserva e pagamento

- A confirmação do checkout exige sessão e `checkoutKey` UUID persistida em
  `sessionStorage` pelo front. A API revalida endereço, itens, preços atuais,
  desconto, frete e estoque. Chave repetida com outro conteúdo é recusada; uma
  tentativa repetida igual retorna o pedido existente.
- Uma transação bloqueia as variantes por tamanho, revalida o estoque, desconta
  as quantidades e cria uma reserva de 30 minutos junto com o snapshot completo
  do pedido, itens, endereço, cupom e frete. Uma impressão digital impede dois
  pedidos pendentes do mesmo carrinho, mesmo após duplo clique/retry.
- O worker local verifica reservas vencidas ao iniciar e a cada minuto. Pedido
  que não iniciou pagamento no prazo é cancelado e o estoque é liberado. Pagamento
  recusado/cancelado também libera a reserva. Pagamento aprovado muda a reserva
  para `consumido` (o estoque já tinha sido debitado; não há segunda baixa).
  Aprovação recebida depois da liberação vai para `revisao_manual`, sem entrega
  automática.
- O cupom só é registrado em `coupon_redemptions` depois de pagamento aprovado;
  `order_id` único e a transação do webhook impedem uso duplicado por evento.
- O SDK oficial Node cria preferência com idempotency key estável por pedido.
  O ID da preferência e o link sandbox são vinculados à única tentativa do pedido.

## Webhooks e confirmação

Configure somente o tópico `payment`. A API valida `x-signature` pelo
`WebhookSignatureValidator` oficial, usando `x-request-id`, `data.id` e o
`MERCADOPAGO_WEBHOOK_SECRET`. Depois consulta `GET /v1/payments/{id}` com o SDK;
**nunca confia no payload ou na página de retorno para confirmar**.

A atualização só pode aprovar se o pagamento consultado corresponder ao ID, ao
`external_reference` (UUID do pedido), ao valor total exato, à moeda `BRL` e
`live_mode: false`. O ID da preferência fica persistido na tentativa local; o
schema oficial de `GET /v1/payments/{id}` não exige `preference_id` no pagamento.
IDs de eventos ficam em
`payment_webhook_events`; evento repetido não repete transição, baixa de estoque
ou gravação do cupom. Webhooks assinados recebidos fora do tópico `payment` são
ignorados. O endpoint responde `200` depois que validou/processou ou reconheceu
uma repetição. A consulta do gateway tem timeout de 9 segundos para caber no
prazo de confirmação de 22 segundos documentado pelo Mercado Pago.

## Verificações manuais

- Sem token `MERCADOPAGO_TEST_ACCESS_TOKEN`, com modo diferente de sandbox, URL
  sem HTTPS ou URL de checkout sem host sandbox, a tentativa é recusada antes
  de redirecionar.
- Faça um pedido e confira snapshot, reserva, desconto, frete e total em centavos.
- Simule teste aprovado e pendente com comprador/cartão de teste. Confirme que a
  página de retorno consulta o gateway e que apenas a resposta consultada muda o
  estado local.
- Reenvie a mesma notificação: o pedido, cupom e reserva devem permanecer sem
  segunda transição. Teste IDs/referências/valores divergentes e HMAC inválido;
  nenhum deve aprovar o pedido.
- Deixe um pedido expirar ou use cartão de teste recusado: confirme cancelamento
  e liberação do estoque. Uma confirmação tardia deve exigir revisão manual.
- Sem o túnel ativo, o webhook não pode chegar ao computador; sem a URL HTTPS
  pública a criação de preferência é recusada. O frontend/API/PostgreSQL continuam
  locais, sem deploy ou domínio permanente.

### Limites do ambiente de teste

As contas, credenciais, cartões, preferências, pagamentos e notificações de teste
são separados dos dados de produção. Cenários simulados não comprovam aprovação,
liquidação, prazos ou cartões salvos numa conta real. Checkout Pro pode exigir
login do comprador de teste e configuração do painel; o túnel precisa permanecer
aberto para receber webhooks. Nenhuma cobrança real, compra de etiqueta ou envio
é realizado nesta etapa.

## Referências oficiais consultadas

- [Visão geral do Checkout Pro e cartões salvos](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/overview)
- [Criar preferência de pagamento](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/create-payment-preference)
- [URLs de retorno](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/configure-back-urls)
- [Webhooks, assinatura e consulta posterior](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/additional-content/notifications/webhooks)
- [Contas de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/test-accounts)
- [Cartões de teste e cenários](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/integration-test/test-purchases)
- [Credenciais de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/additional-content/credentials)
- [SDK oficial Mercado Pago Node.js](https://github.com/mercadopago/sdk-nodejs)
