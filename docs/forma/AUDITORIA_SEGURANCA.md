# Auditoria de ambiente e checkout — 22/10/2026

Parecer: **pronto para commit no escopo acadêmico local**, após as correções
abaixo e os resultados executados nesta rodada. Não significa homologação
externa ou aprovação para produção. Não foi executado git add, commit, push,
reset nem reescrita de histórico; índice vazio. Trabalhos anteriores preservados.

## Correção dos três achados da revisão independente

Os três achados foram corrigidos nesta continuação, com testes novos. O parecer
é **pronto para preparar commits no escopo local**, sem homologação externa.

| Achado | Correção | Resultado executado |
| --- | --- | --- |
| URL de teste loopback com `?host=` remoto | Política extraída do provisionador para `server/src/db/local-database.js`, usada pelo admin, preparação local, runners e integrações diretas. Recusa qualquer query/fragmento, host fora da allowlist e configuração indireta `PG*` antes da conexão. Factories fixam localhost em 127.0.0.1. Cada checkout do pool verifica host efetivo, peer TCP, `inet_server_addr()` e banco esperado no mesmo cliente antes de liberar comandos SQL. | Cinco testes unitários, incluindo recusa nos três runners e dez entrypoints de integração, sem conexão remota. Peers remotos recebem zero SQL; identidade divergente recebe somente SELECT de identificação. PostgreSQL real aceita cliente localhost/127.0.0.1 e pool/transação local. |
| Cartão salvo iniciava sem callback/segredo | `resolveSavedCardConfig` valida configuração antes de qualquer tentativa ou consulta/pagamento no gateway. Exige sandbox, Access Token/Public Key, callback HTTPS público sem credenciais/query/fragmento/endereço privado ou local e segredo não fictício. Carteira retorna Public Key nula quando indisponível; a UI não oferece o pagamento direto. Checkout Pro permanece independente. | 12/12 testes HTTP/SQL do novo arquivo, incluindo teste pai. Ausência de URL/segredo, HTTP, credencial embutida, localhost, IP privado, IPv6 loopback e placeholders retornam 503; snapshots de pedido/reserva/estoque/outbox/tentativa permanecem iguais e chamadas ao gateway ficam em zero. Configuração válida paga só no gateway fixture. |
| Upgrade dependia do CWD | Migrações resolvidas por `new URL('../src/db/migrations/', import.meta.url)`. | 1/1 pela raiz e 1/1 pela pasta server, no PostgreSQL descartável. |

A checagem de conexão exige loopback TCP e identidade do PostgreSQL; não é
atestação de localização física contra toda topologia possível de proxy/túnel.
As recusas foram verificadas com URLs/peers sintéticos; nenhum banco remoto real
foi acessado. Todos os bancos usados nas execuções positivas eram descartáveis.

## Escopo e situação inicial

Código atual em `main`, HEAD `d52c74e`, com trabalho local anterior já não
commitado (catálogo, imagens, cartões e administração). Foram conferidos branch,
status, índice/diff e commits recentes antes das correções. A fonte de verdade
foi o código existente e seus testes, sem criar outro checkout.

Nenhuma credencial de Mercado Pago, Melhor Envio ou SMTP externo estava
configurada para teste real. A senha do PostgreSQL de desenvolvimento foi lida
somente em memória para comparação pelo scanner, sem exibir/copiar seu valor.
Não foram usados PAN/CVV, cartões, tokens de cartão reais ou credenciais de
produção. O formulário de cartão foi exercitado com um SDK **fixture**, que
monta iframes vazios e gera identificadores opacos fictícios somente em memória.

## Achados e correções

| Gravidade inicial | Achado | Correção e evidência |
| --- | --- | --- |
| Alta | Vite servia arquivo em `.local` por HTTP: canário próprio retornou 200 com conteúdo antes da correção. Poderia expor senha local/cache OAuth. Nenhum arquivo privado real foi requisitado. | `server.fs.deny`, host loopback e middleware antes das transformações negam `.env*`, servidor, diretórios privados e chaves. 16 tentativas HTTP retornaram 403 depois, com e sem `/@fs`, `?raw` e `?import`. |
| Alta | Validador do SDK Mercado Pago era usado sem `toleranceSeconds`; assinatura antiga permanecia válida. | Janela explícita de 300 segundos; HTTP recusa assinatura ausente, divergente, antiga e futura **antes** de consultar o gateway fixture. Relógio local precisa estar sincronizado. |
| Alta | Provisionamento demo validava hostname textual da URL sem conferir overrides de roteamento ou servidor conectado. | Usa a política central: recusa toda query e configuração PG* indireta antes de conectar, confere peer TCP e identidade do servidor/banco na mesma conexão antes de inserir. Produção prevalece mesmo sobre opção de teste. Testes de remoto, override e produção passam. |
| Média | Handler inesperado registrava objeto inteiro do erro; health/404 e SMTP podiam refletir detalhes de configuração/servidor. | Erros HTTP/health/404 genéricos; não registra objetos de SDK/SQL nem respostas SMTP brutas. CLIs e sweeps omitem detalhes privados. SMTP hostil que ecoa credencial bruta/base64 gera somente erro com comando/código. |
| Média | Ausência de proteção explícita contra configuração privada com prefixo `VITE_*`; ignore incompleto para variantes de `.env`. | Allowlist de `VITE_API_URL`, URL sem credenciais/query/fragmento; build recusa demais `VITE_*`. Ignore cobre variantes em qualquer pasta e chaves privadas. Exemplos permanecem incluíveis. |
| Defesa adicional | Resposta consultada do gateway precisava corresponder explicitamente ao ID solicitado; URLs configuradas poderiam carregar credenciais. | Conferência explícita do ID retornado, URL de callback/retorno sem usuário/senha/query/fragmento e callback HTTPS externo. Placeholders não habilitam integrações. JSON com campos de PAN/CVV é recusado globalmente. |

A tentativa `?import` de `.txt` com apenas `fs.deny` gerava módulo de URL
HTTP 200 **sem conteúdo do canário**; o guard anterior aos middlewares torna
também essa resposta 403. Não foi demonstrado vazamento de conteúdo nesse
caminho intermediário. O achado inicial de exposição direta foi comprovado.

## Comprovado por execução local

| Verificação | Resultado / evidência reproduzível |
| --- | --- |
| `npm test` | 93 testes: 83 passaram, 10 integrações sem URL de banco puladas, 0 falhas. |
| `FORMA_TEST_DATABASE_URL=... npm run test:db` | 139/139 passaram, 22 arquivos, 0 falhas/pulados, banco PostgreSQL novo por arquivo. Todas as migrações 0001–0012 aplicadas; atualização legada e idempotência do seed também cobertas. |
| Fronteira HTTP nova | 10/10 (inclui teste pai): preço promocional 8000, desconto 800 e frete 1234 resultam em 8434 centavos, mesmo enviando total 1/status pago. Quantidade negativa/fracionária/excessiva/duplicada, estoque falso, cupom inválido/inativo, endereço/cotação alheios, cotação expirada e endereço alterado são recusados. |
| Mercado Pago fixture | Pagamento deve corresponder ao ID, pedido, valor, moeda BRL, preferência e `live_mode=false`; corpo do webhook/retorno não aprova. Duas entregas de evento aprovado deixam um consumo de reserva, um resgate de cupom e um e-mail de confirmação. |
| Carteira/admin | Suíte `demo-cards.integration.test.js` cobre login normal, hash scrypt, senha alterada preservada, negação a comum/anônimo, cartões/pedidos entre contas, token incompatível, concorrência, timeout e reconciliação. Não existe rota administrativa para marcar pago. |
| Navegador real | `scripts/check-security-browser.mjs`: 56 checks passaram: 40 no Chromium/Brave headless (20 em desktop 1440 e 20 em celular 390) e 16 HTTP do Vite no mesmo harness. Manipulação por `fetch` no navegador; React/API/SQL reais, cotação/pagamento/SDK fixtures explícitas. Inclusão envia só `{token}`; pagamento só `{orderId,token}`; token fixture ausente de pedido/tentativa/cartão no SQL. |
| Vite HTTP | 16/16 canários negados com 403 e sem conteúdo privado, incluindo `/@fs`, `?raw`, `?import`. Nenhum `.env` real foi requisitado pelo teste. |
| Bundle | `scripts/check-bundle-security.mjs`: build passa com canários em nove variáveis privadas sem publicá-los em nenhum dos 30 arquivos de `dist`; variável privada em `VITE_*` impede build sem ecoar valor. |
| Segredos/Git | `scripts/audit-secrets.py`: 187 arquivos rastreados, trabalho não rastreado incluível, diff HEAD, 404 blobs de todas as refs/reflog e 30 arquivos de bundle; 0 achados nos padrões verificados e na comparação com o segredo local existente. `.env` reais ausentes dos arquivos rastreados/histórico examinado. |
| SMTP | Capturador local e teste hostil de AUTH passam. Resposta com credencial bruta/base64 não aparece na exceção. Sem entrega externa nesta rodada. |
| `npm test --prefix server` | 68 testes: 58 passaram, 10 integrações puladas sem URL de banco, 0 falhas. |
| Lint/build/diff | `npm run lint` sem avisos; `npm run build` passou; `git diff --check` limpo. |

Relatórios locais ignorados pelo Git: `.tmp/security-audit/{browser,vite,bundle,secrets}.json`,
`.tmp/db-tests/results.json` e TAP por arquivo. Artefatos desta rodada não
contêm credenciais reais ou tokens temporários do provedor.

O scanner é heurístico; não prova ausência universal de segredos desconhecidos.
**Nenhuma credencial real versionada foi identificada**; não há revogação de
credencial versionada determinada por evidência nesta rodada. Como o servidor
de desenvolvimento anteriormente podia servir `.local`, considere trocar a
**senha do PostgreSQL local** caso ele tenha sido exposto a terceiros antes da
correção. Não foi demonstrado acesso indevido ao valor real. Não há token
externo configurado a revogar neste ambiente auditado. O histórico foi preservado.

## Confirmado por leitura do código

- Checkout exige sessão e usa preços/promoções, cupom ativo, quantidade/estoque e
  cotação persistida do dono, vinculada a endereço e fingerprint do carrinho.
  Valores/status enviados pelo cliente não são autoridade. Locks e snapshots
  conservam estoque/histórico. Não há endpoint público para mudar status pago.
- O retorno `/api/pagamentos/retorno` apenas redireciona IDs validados. A tela
  consulta a API autenticada, que busca o pagamento com `Payment.get` oficial.
  O webhook usa `WebhookSignatureValidator` oficial, consulta o pagamento no
  servidor e aplica a mesma transição transacional/idempotente.
- Na produção do aplicativo (fora dos harnesses de teste), gateways sempre são
  os clientes oficiais. Injeção de fixtures só ocorre na fábrica Express chamada
  pelos testes; nenhum parâmetro HTTP/variável de ambiente ativa pagamento falso.
- Número, validade e CVV são montados por `mp.fields.create(...).mount(...)`
  do SDK v2. A FORMA não implementa inputs próprios de PAN/CVV. A API aceita
  token opaco temporário; não há coluna, gravação de corpo ou log desses tokens.
  JSON malicioso com campos conhecidos de PAN/CVV é rejeitado; isso não impede
  que um cliente hostil envie bytes à rede, nem torna esta auditoria certificação PCI.
- Senhas usam scrypt; sessões aleatórias têm hash SHA-256 no banco. Não existe
  segredo JWT/assinatura de sessão neste modelo. Access Token e credenciais
  externas ficam no servidor; a Public Key é a exceção pública necessária ao SDK.
- API de cartões/pedidos filtra pelo usuário autenticado; autorização de admin
  usa papel no banco, sem bypass de autenticação.

## Homologação externa pendente

**Mercado Pago, Melhor Envio e entrega externa de e-mail não homologados.**
Não foram feitas chamadas com credenciais desses serviços nem cobrança real.
Fixtures comprovam o contrato e as regras locais, não o funcionamento do provedor.

1. Obter credenciais/test users da mesma aplicação MP, configurar Public Key,
   Access Token, túnel HTTPS e assinatura de webhook conforme README. Sincronizar
   relógio; reiniciar API/frontend. Usar exclusivamente contas/cartões de teste
   oficiais nos campos do SDK real; não colocar dados em curl, logs ou arquivos.
2. Na UI real, adicionar/listar/remover cartão e pagar pedido em uma parcela.
   Confirmar no painel sandbox que `live_mode=false`, valor/BRL/cliente/cartão e
   referência correspondem. Validar tokenização SDK real e eventos com timestamp
   do provedor; reconciliar timeout sem reenviar token ou iniciar segunda cobrança.
3. Reenviar evento assinado válido, testar aprovação/recusa e verificar pedido,
   reserva, cupom e outbox únicos. Testar retorno adulterado e contas A/B também
   com o gateway real. Conferir cabeçalhos/manifesto de assinatura oficiais.
4. Autorizar app Melhor Envio **sandbox** pela CLI, cotar endereço real de teste,
   selecionar serviço e confirmar que pedido conserva valor/prazo do provedor.
   Alterar carrinho/endereço e confirmar necessidade de nova cotação. Não comprar
   etiquetas; nunca transferir tokens para frontend/relatórios.
5. Para SMTP externo, obter credenciais do provedor, usar TLS e remetente
   autorizado; criar pagamento sandbox aprovado e conferir `sent`, mensagem na
   caixa de destino e falha/retry controlados. Mailpit/capturador só comprova SMTP
   local. Entrega SMTP permanece at-least-once na fronteira ACK/gravação no banco.

## Reprodução

```bash
npm ci
npm ci --prefix server
npm run api:setup
npm run api:admin:demo
npm run api
# Outro terminal:
npm run dev
# Checks sem credenciais externas:
npm test
npm run lint
node scripts/check-bundle-security.mjs
python3 scripts/audit-secrets.py
git diff --check
git diff --cached --name-only
# PostgreSQL descartável local, nome contendo test ou audit:
FORMA_TEST_DATABASE_URL=postgresql://USUARIO_LOCAL@127.0.0.1:PORTA/forma_test npm run test:db
FORMA_TEST_DATABASE_URL=postgresql://USUARIO_LOCAL@127.0.0.1:PORTA/forma_test node scripts/check-security-browser.mjs
node scripts/check-vite-security.mjs
```

URLs devem ser completas e sem query/fragmento; variáveis `PG*` devem estar
ausentes. Use `FORMA_TEST_DATABASE_URL`, sem PGHOST/PGSERVICE ou overrides.

O runner cria bancos descartáveis com nomes `forma_test_*` e
`forma_security_browser_test_*`; requer permissão local CREATEDB. O navegador usa
Brave (`FORMA_BROWSER` pode apontar para Chromium), Vite 5189 e CDP 9244; a prova
isolada de Vite usa 5190. Servidores/browser criados pelos scripts são encerrados;
bancos de teste são preservados para inspeção. Credencial **exclusivamente local**
para a UI: `admin@forma.local` / `FormaDemo2026!`. Não é permitida em produção ou
banco remoto; usuário já existente é preservado sem alterar senha/papel.
