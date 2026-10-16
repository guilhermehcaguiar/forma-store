# Etapa 03 — pedidos, e-mails mock e cartões

## Histórico de pedidos

A área autenticada `Minha Conta > Pedidos` lista os pedidos do usuário e abre um detalhe com itens, endereço/frete em snapshot, totais, status do pedido e status de pagamento. As consultas são restritas ao `user_id` da sessão; valores e status são lidos da API, não do navegador.

## E-mails transacionais em modo mock

A migração `0008_email_outbox.sql` cria uma fila local de e-mails. A confirmação é enfileirada na mesma transação de criação do pedido. Cada mudança efetiva para pago, cancelado ou revisão manual gera um evento com chave única, na mesma transação da mudança. Repetições não criam mensagens duplicadas.

O servidor aceita apenas `FORMA_EMAIL_MODE=mock` (também é o padrão). O worker local transforma itens `queued` em `mocked` e guarda destinatário, assunto e texto em `mock_message`. Não há SMTP, chamada de rede, credencial de e-mail nem entrega externa. Esses registros são prévias de teste, não confirmação de envio. A mensagem não inclui dados de cartão.

Depois de aplicar as migrações em um PostgreSQL local, verifique as prévias com:

```sql
SELECT event_key, template, recipient_email, status, mock_message, created_at, processed_at
FROM email_outbox
ORDER BY created_at DESC;
```

Confirmação é criada ao concluir um pedido; avisos de estado só são criados quando a transição do pedido ocorre. Um reprocessamento não duplica um mesmo evento. Pedidos criados antes desta migração não recebem mensagem retroativa.

## Cartões salvos

O checkout usado é Mercado Pago Checkout Pro hospedado, em modo de teste. O comprador pode selecionar meios salvos na própria conta Mercado Pago ao entrar nessa conta durante o checkout. A tela Cartões da FORMA explica que a administração fica com o Mercado Pago.

Não há formulário de cartão, integração `customer/cards`, nem armazenamento de PAN, CVV, validade ou token de cartão na FORMA. A API `customer/cards` pertence a integrações de checkout transparente; não é necessária para o fluxo hospedado escolhido. Não coletar ou inserir dados reais para testar.

## Verificações e limites

Os testes automatizados verificam a renderização mock, a chave idempotente do outbox e a recusa a modos diferentes de `mock`. Eles não substituem a verificação da migração e das transações contra um PostgreSQL real. Nenhum e-mail externo, pagamento, cobrança, migração ou túnel foi executado neste ambiente.
