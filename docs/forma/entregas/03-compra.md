# Entrega 03 — Frete e checkout local

Data: 15/10/2026.

## Escopo

Conectar o catálogo de Gabriel e os cupons/carrinho existentes de Hugo ao
checkout, calcular cotações reais pelo Melhor Envio Sandbox, selecionar endereço
e serviço de entrega e registrar o pedido autenticado. A cotação usa somente
produtos ativos do PostgreSQL; preço, peso e dimensões são revalidados no
servidor, assim como tamanho/estoque quando há variantes cadastradas. Nenhuma
opção de frete é inventada ou mantida como fallback quando o Melhor Envio não responde.

O pedido criado fica `aguardando_pagamento`. Esta etapa não integra Mercado
Pago, não cobra, não compra etiquetas e não solicita/coleta envios.

## Configuração local

Pré-requisitos: Node.js 20+, PostgreSQL local, `.env` do servidor e uma conta
separada do Melhor Envio Sandbox.

1. Copie `server/.env.example` para `server/.env` e preencha `DATABASE_URL`,
   `MELHOR_ENVIO_ORIGIN_CEP` (o CEP de expedição da loja, 8 dígitos),
   `MELHOR_ENVIO_CLIENT_ID`, `MELHOR_ENVIO_CLIENT_SECRET` e um
   `MELHOR_ENVIO_USER_AGENT` com nome da aplicação e e-mail real de suporte.
2. Cadastre um aplicativo em [Integrações de desenvolvedor do Sandbox](https://app-sandbox.melhorenvio.com.br/integracoes/area-dev).
   Configure como callback exatamente o valor de `MELHOR_ENVIO_REDIRECT_URI`
   (padrão local: `http://localhost:3333/api/health`) e solicite somente o
   escopo `shipping-calculate`.
3. Aplique as migrações: `npm run api:migrate`.
4. Inicie a API (`npm run api`) e, em outro terminal, execute
   `npm run api:melhor-envio:autorizar`. Abra a URL emitida, autorize a conta
   sandbox e cole no terminal a URL completa de retorno. O comando valida o
   `state`, troca o código OAuth por tokens e não imprime as credenciais.
5. Inicie o front (`npm run dev`) e crie produtos com dimensões/peso, uma conta
   FORMA e pelo menos um endereço com CEP válido.

O access token e o refresh token ficam em `server/.local/`, ignorado pelo Git.
Quando a API recebe `401` do provedor, renova o token no servidor e salva a
rotação nesse arquivo. O client secret permanece em `server/.env`. Não copie
nenhuma credencial para `src/`, o navegador ou este repositório.

O Melhor Envio usa OAuth 2.0; access tokens duram 30 dias e refresh tokens 45
dias conforme sua documentação. O Sandbox e a produção são ambientes separados;
esta integração aponta deliberadamente apenas para Sandbox. A disponibilidade
real de transportadoras e serviços depende do provedor e do destino.

## Fluxo e contratos

- O carrinho é mantido no navegador em `forma:cart`; guarda IDs, tamanhos,
  quantidades e cupom, não preços confiáveis. Resumos e descontos são recalculados
  pela API consultando produtos e cupons no PostgreSQL.
- `POST /api/cart/resumo` retorna linhas e subtotal; `POST /api/cart/cupom`
  valida o código para os itens enviados e retorna desconto/total em centavos.
- O checkout autenticado carrega endereços da conta. `POST
  /api/frete/cotacoes` recebe `addressId` e itens `{ productId, size,
  quantity }`, verifica propriedade do endereço e consulta
  `POST /api/v2/me/shipment/calculate` no host `sandbox.melhorenvio.com.br`.
- O payload externo usa CEP de origem configurável e CEP de destino do endereço;
  peso em kg (conversão de gramas), dimensões em cm, valor segurado em BRL e
  quantidade. As requisições incluem `Authorization: Bearer`, JSON quando
  aplicável e `User-Agent`, inclusive nas chamadas OAuth.
- A interface mostra nome/transportadora, preço e prazo retornados. Dá
  preferência a `custom_price` e `custom_delivery_time`, recomendados pelo
  Melhor Envio; quando o prazo não vem, informa que não foi fornecido. Lista vazia
  continua vazia.
- CEP com formato inválido é rejeitado antes da requisição. Resposta 422 do
  provedor é apresentada como cotação recusada; falha de rede/serviço vira erro
  tratável, sem cotação estimada.
- A cotação expira em 20 minutos e é de uso único. A API grava seu serviço,
  endereço e fingerprints dos dados completos do endereço, itens, preços,
  quantidades e medidas. Trocar/editar o endereço ou alterar o carrinho invalida
  a cotação; o servidor verifica tudo novamente na confirmação do pedido.
- `POST /api/checkout` exige sessão válida, endereço próprio, cotação vigente e
  serviço retornado por ela. Cria `orders` e `order_items` em transação, com
  endereço e valores em snapshot; o mesmo ID de cotação não pode gerar dois
  pedidos. `GET /api/conta/pedidos` lista os pedidos da própria conta.
- A confirmação é de pedido registrado, não de pagamento. O status inicial é
  `aguardando_pagamento`; nenhuma etiqueta, frete comprado ou envio é criado.

## Testes

Testes automatizados, sem chamadas externas: `npm test` e
`npm test --prefix server`. Incluem validação de itens/CEP, conversão de gramas,
centavos e quantidades para o payload oficial, preferência dos campos
customizados e descarte de serviços com erro/sem ID. `npm run build` e
`npm run lint` verificam o front.

O teste real de cotação requer configuração do aplicativo e tokens sandbox,
PostgreSQL com as migrações e ao menos um produto/endereço válido. Sem essas
credenciais, a API responde que o frete não está configurado; não substitui a
resposta por um serviço fictício.

### Roteiro manual local

1. Cadastre um produto ativo com preço, peso em gramas e dimensões em cm; se
  usar variantes, cadastre tamanhos com estoque positivo.
2. Entre com uma conta cliente, crie um endereço com CEP de oito dígitos e
  adicione o produto ao carrinho. Altere quantidade, remova e adicione de novo.
3. Aplique `FORMA10` no carrinho e confira subtotal/desconto em centavos exibidos
  como BRL; um código inexistente deve mostrar erro sem desconto.
4. No checkout, selecione o endereço e calcule o frete. Compare serviço, preço
  e prazo com os campos retornados pelo sandbox; se o provedor estiver fora,
  confirme que nenhum serviço é listado como alternativa.
5. Troque o endereço ou a quantidade: a opção anterior deve sumir e ser
  recalculada. Também edite o endereço em outra aba e confirme que o servidor
  rejeita uma cotação cujo snapshot mudou.
6. Confirme o pedido autenticado e verifique `aguardando_pagamento` em Meus
  pedidos. Reenvie a mesma cotação: ela não pode criar outro pedido.
7. Repita sem sessão: não deve ser possível cotar ou confirmar. Nenhum passo
  deve efetuar cobrança, comprar etiqueta ou registrar envio.

## Referências oficiais

- [Sandbox](https://docs.melhorenvio.com.br/docs/sandbox.md)
- [Cotação de fretes](https://docs.melhorenvio.com.br/docs/cotacao-de-fretes.md)
- [Cálculo por produtos e contrato da API](https://docs.melhorenvio.com.br/reference/calculo-de-fretes-por-produtos.md)
- [Autenticação OAuth e permissões](https://docs.melhorenvio.com.br/reference/fluxo-de-autorização.md)
- [Interface e segurança de credenciais](https://docs.melhorenvio.com.br/docs/interface-de-usuario.md)
