# FORMA — auditoria de requisitos e catálogo demonstrativo

Atualização: 16/10/2026. Fonte: `REQUISITOS_DO_PDF.txt` e PDF original em
`referencias/FORMA_Requisitos_e_Mockups.pdf` (RF01–RF26, RNF01–RNF14).

## Base efetivamente encontrada

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

## Dados e arquitetura

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

## Evidências de execução desta etapa

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
| RF01 Cadastro antes da finalização | Atendido na implementação legada | `checkout.routes.js` exige `requireAuth`; `Auth.jsx` | Inspeção; fluxo de cadastro de teste em H/B | Fluxo completo de finalização autenticada não revalidado |
| RF02 Opt-in | Atendido na implementação legada | `Auth.jsx`, `users.promo` | Testes existentes de serviços/validações | Comunicações promocionais não implementadas |
| RF03 Autenticação | Atendido na implementação legada | `auth.service.js`, `AuthProvider.jsx` | H/B usam cadastro e sessão reais | Logout/expiração não revalidados aqui |
| RF04 Perfil | Parcial | `Account.jsx`, `parseProfile` | Inspeção e testes existentes | Só nome/opt-in; sem alteração de e-mail/senha |
| RF05 Endereços | Atendido na implementação legada | `enderecos.service.js`, `Addresses.jsx` | H cria endereço real para testar recusa de estoque | Edição/principal/isolamento não revalidados aqui |
| RF06 Cartões | Ausente | `Collections.jsx:Cards` só informa delegação | Inspeção | Gerenciamento ainda não existe; carteira externa não validada |
| RF07 Catálogo | Atendido para demonstração local | `demo-products.js`, `ProductCard`, `ProductImage`, `Home`, `Catalog`, `Product` | D/H/B: dados, vitrine, detalhe, foto, placeholders, recarga | Substituir ilustrações quando houver fotografias correspondentes |
| RF08 Cor | Atendido | `getProducts` retorna `filters.colors`; seletor dinâmico | H/B, inclusive cor criada após seed | — |
| RF09 Estampa | Atendido | `is_printed` no SQL e URL da tela | H/U/B: true/false e combinações | — |
| RF10 Tamanho | Atendido | `EXISTS` com estoque positivo; grade preservada | H/B: P/M/G/GG, tamanhos zerados | — |
| RF11 Promoção | Atendido | Filtro SQL e preços promocionais reais | H/B: quatro promoções e combinações | — |
| RF12 A–Z/preços/datas | Atendido | Cinco opções no front e SQL; acentos e desempate | H/B: inclusive mais antigos e recarga | — |
| RF13 Carrinho | Parcial | `cart.js`, `Cart.jsx`, resumo server-side e imagens | H/U/B: adicionar, recarga, limites e checkout bloqueado sem estoque | Persiste por navegador, sem sincronização por conta; remoção/quantidade completas não revalidadas aqui |
| RF14 Cupons | Atendido no escopo testado | `validateCoupon`, `/cart/cupom` | H: preço promocional e cálculo em centavos | Casos adicionais do módulo não revalidados |
| RF15 Frete | Parcial | `shipping.provider.js` | H testa somente recusa de estoque antes de cotar | Credenciais/OAuth/cotação real não validados |
| RF16 Checkout | Parcial | `checkout.service.js` | H: itens sem estoque recusados, sem pedido gravado | Compra completa depende de frete e pagamento configurados |
| RF17 Mercado Pago | Parcial | SDK, gateway e módulos de pagamento existentes | Somente testes existentes de segurança | Não homologado externamente; nenhum pagamento/cobrança feito |
| RF18 E-mail de compra | Ausente | `email.service.js` só aceita mock | Testes existentes do mock | Mock não equivale a envio real; falta transporte |
| RF19 Favoritos | Parcial nesta árvore | API persiste IDs; tela usa `findProduct` em memória | Inspeção; não revalidado | Recarga direta depende de cache: correção anterior não estava na árvore |
| RF20 Listas | Parcial nesta árvore | API persistente; `ListItems` usa cache de produto | Inspeção; não revalidado | Mesma limitação de recarga; texto de lista vazia ainda fixo |
| RF21 Sobre Nós | Atendido na implementação legada | `About.jsx` | Inspeção | Texto contém referência à etapa antiga do catálogo |
| RF22 Administração restrita | Atendido na implementação legada | `RequireRole`, `requireRole` da API | B: administrador consulta dados reais | Negação de outros papéis não revalidada nesta etapa |
| RF23 Produtos | Parcial | `POST /admin/produtos`; consulta real em `Administration.jsx` | B: listagem de 12 peças/imagens | Formulário de cadastro legado ainda fora das rotas; sem edição |
| RF24 Alterar preços | Ausente | Preço só no cadastro | Inspeção | Não há edição de preço |
| RF25 Tamanhos/estoque | Parcial | Grade inicial e tabela administrativa real | H/B: variantes/estoque consultados | Sem edição posterior |
| RF26 Promoções | Parcial | Promoção no cadastro/API, consulta administrativa real | H/B: quatro promoções com valores reais | Sem criação/edição de campanhas no painel |
| RNF01 React | Atendido | Componentes React existentes e reutilizáveis | V/B | — |
| RNF02 PostgreSQL | Parcial | Oito migrações e seed no modelo existente | D/H | Carrinho continua em localStorage |
| RNF03 Responsividade | Parcial, atendido nas telas testadas | CSS existente e componentes do catálogo | B: cinco telas × quatro larguras sem overflow | Demais telas/aparelhos físicos não revalidados |
| RNF04 Usabilidade | Parcial | Rótulos, erros, URL de filtros, imagens, estoque e preços | B | Revisão completa de acessibilidade e fluxos fora do catálogo |
| RNF05 Identidade | Atendido | Variáveis FORMA e hero preservados | CSS, B e capturas | Sem comparação pixel a pixel de todas as telas |
| RNF06 Segurança de autenticação | Parcial | scrypt, tokens opacos e hash no banco | Testes existentes; cadastro/sessão H/B | HTTP/localStorage, sem rate limiting/recuperação |
| RNF07 Segurança de pagamento | Parcial | Checkout hospedado, sem PAN/CVV no modelo | Testes existentes de assinatura/ambiente | Gateway externo não validado |
| RNF08 Controle de acesso | Atendido na implementação legada | Middleware do servidor e guard React | Inspeção; B acessa painel com admin de teste | Novas rotas devem manter a proteção |
| RNF09 Proteção de dados | Parcial | Queries de conta filtradas por usuário | Não revalidado nesta etapa | Endurecimento local e tratamento das rotas antigas |
| RNF10 Desempenho | Parcial | Filtros SQL, imagens lazy, cancelamento lógico de respostas antigas | H/B/V com 12 peças | Sem paginação/carga; foto e hero originais ainda grandes |
| RNF11 Compatibilidade | Parcial | APIs web padrão | B em Brave/Chromium | Firefox/WebKit não testados |
| RNF12 Manutenibilidade | Parcial | Componentes de imagem/card, seed separado, testes | H/U/V | Consolidar documentação histórica e módulos legados |
| RNF13 Consistência do pedido | Parcial | Transações e locks existentes; seed não repõe estoque | H/U: estoque indisponível bloqueia carrinho/cotação/pedido | Concorrência e ciclo completo de pagamento não revalidados aqui |
| RNF14 E-mails/consentimento | Ausente para entrega | Preferência salva, outbox mock | Testes existentes | Transporte real e promoções com opt-in não existem |

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
e não foram homologados. E-mail mock continua sem envio e gerenciamento de
cartões ainda não existe. A proposta Vercel/Supabase do PDF permanece fora do
escopo local atual. A validação inicial usou somente banco descartável; a
preparação persistente adicionada posteriormente está descrita abaixo.

Próximos commits sugeridos: corrigir novamente as lacunas legadas de conta e
contratos administrativos identificadas na árvore atual; completar cadastro e
edição administrativa de produtos/preços/tamanhos/campanhas; depois homologar
sandbox de frete/pagamento e implementar entrega de e-mail real. Nada disso foi
apresentado como concluído nesta etapa de catálogo.

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
