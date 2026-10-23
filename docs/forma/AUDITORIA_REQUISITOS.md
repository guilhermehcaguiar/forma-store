# FORMA — auditoria consolidada de requisitos

Atualização: **23/10/2026**, validação final sobre o commit `26c40c4`
(atalho administrativo e placeholder de UF), preservando as alterações preexistentes. Escopo: projeto acadêmico **local**,
React + Express + PostgreSQL. Alterações locais anteriores foram preservadas.
Não foram executados git add, commit ou push, nem criado PDF ou relatório final.

A fonte normativa é o [texto literal do PDF](REQUISITOS_DO_PDF.txt). Cada linha
abaixo reproduz o enunciado, registra implementação e distingue evidência local
de homologação de provedor. Os estados são **atendido localmente**, **parcial**
e **ausente**. “Atendido localmente” se limita ao ambiente e cenários verificados.

## Resultado atual

| Grupo | Atendido localmente | Parcial | Ausente | Total |
| --- | ---: | ---: | ---: | ---: |
| RF01–RF26 | 22 | 4 | 0 | 26 |
| RNF01–RNF14 | 6 | 8 | 0 | 14 |
| Total | **28** | **12** | **0** | **40** |

**DEMONSTRAÇÃO — sem cobrança ou envio real.** A compra demonstrativa funcional
usa frete e pagamento locais identificados, sem credenciais MP/ME. Não representa
homologação de Mercado Pago, Melhor Envio, cartões ou entrega externa de e-mail.

## Evidências desta rodada

| Código | Execução / resultado comprovado |
| --- | --- |
| U | `npm test -- --test-reporter=tap --test-concurrency=1`: 104 testes; 91 aprovados, 13 integrações opt-in puladas, zero falhas. |
| DB | `FORMA_TEST_DATABASE_URL=… npm run test:db`: **166/166**, 26 arquivos, zero falhas/pulados, um banco descartável por arquivo. |
| CAT | `server/tests/catalog.test.js`: 11 testes, **480 combinações** de cor/estampa/tamanho/promoção, cinco ordenações, imagens, estoque e preservação de edições. |
| UI | `scripts/check-local-demo-browser.mjs`: **97 checks**; jornada em 1440/390 px, layouts adicionais em 768/320 e cabeçalho admin em 1440/1280/1024/901. React/API/PostgreSQL reais, sem interceptação de frete/pagamento. |
| G | `server/tests/demo-mode.test.js` e `local-database.test.js`: produção, remoto, overrides, escuta não local e SMTP externo recusados antes da ativação; sem acessar banco remoto. |
| V | `npm run lint`, `npm run build` (71 módulos) e `git diff --check` aprovados. |

No PostgreSQL limpo: **30 produtos, 15 estampados, 15 cores, 12 promoções,
120 variantes e 30 imagens**. Primeira execução do seed: **30 inseridos / 0
existentes**; segunda: **0 inseridos / 30 preservados**. O teste de atualização
12 → 30 insere só 18 e conserva os dados anteriores, incluindo edições. O seed
não remove produtos extras criados por administrador em um banco já utilizado.

As 18 imagens novas foram geradas individualmente com `image_gen`, após a
inspeção da amostra Solar Terracota. Todas foram convertidas para WebP 800 × 800
e inspecionadas. Os 12 produtos anteriores são idênticos ao código anterior;
seus IDs, imagens originais e arquivos referenciáveis em snapshots permanecem.
Prompts e correspondência: [IMAGENS.md](IMAGENS.md).

A UI comprovou cadastro/login, cinco ordenações, filtros combinados persistentes,
favoritos e listas, perfil, endereço, cupom, frete demo, pedido, pagamento demo,
confirmação e histórico após recarga. A compra de R$ 109,90 com FORMA10 e frete
R$ 10,00 resulta em **R$ 108,91**, calculados na API. O administrador entrou pelo
login normal e pelo novo atalho, editou preços/estoque e consultou promoções e
pedidos; repetir o seed preservou a edição. O cliente não acessa a administração.

O teste de e-mail usa mock e conexão SMTP a capturador em loopback. Confirmação
transacional independe do opt-in, com deduplicação no outbox; transporte SMTP
continua at-least-once. Nenhuma entrega externa foi homologada.

## Matriz funcional — RF01–RF26

| ID | Enunciado literal do PDF | Implementação | Evidência / limite | Estado |
| --- | --- | --- | --- | --- |
| RF01 | O sistema deverá permitir o cadastro de novos usuários e exigir autenticação/cadastro antes da finalização de uma compra. | Cadastro e sessão na API; checkout exige o dono autenticado. | UI cadastro/compra; DB demo-mode e cart-profile: 401 sem sessão. | atendido localmente |
| RF02 | No cadastro, o sistema deverá apresentar uma opção para o usuário aceitar o recebimento de promoções por e-mail. | Checkbox inicialmente desmarcado; preferência persistida no perfil. | UI opt-in inicial; DB cart-profile: PATCH grava promo sem conceder papel. | atendido localmente |
| RF03 | O sistema deverá permitir que usuários cadastrados realizem login e acessem recursos vinculados à sua conta. | Login/logout, sessão opaca, recursos filtrados por proprietário. | UI login normal de cliente/admin; DB authz e demo-mode A/B. | atendido localmente |
| RF04 | O usuário deverá possuir uma área de perfil para consultar e editar suas informações cadastrais. | Nome e preferência; troca de e-mail/senha mediante senha atual. | UI perfil e recarga; DB cart-profile: credenciais, scrypt e revogação. | atendido localmente |
| RF05 | O usuário deverá poder cadastrar, editar e salvar endereços para utilização nas compras. | CRUD por conta e seleção explícita de principal; checkout usa endereço salvo. | UI criar/editar/principal/remover/recriar; DB isolamento e snapshot. | atendido localmente |
| RF06 | O usuário deverá poder manter cartões para uso no checkout, respeitando os mecanismos seguros disponibilizados pelo gateway de pagamento. | Carteira e Secure Fields implementados; demo opcional com MP sandbox; demo totalmente local não simula cartão. | DB cards-migration/demo-cards/saved-card-config com gateway fixture; SDK/provedor real não homologado. | parcial |
| RF07 | O sistema deverá exibir os produtos da loja com informações necessárias à decisão de compra, incluindo preço, tamanho e características. | 30 peças, imagens individuais, descrição, preço e tamanhos/estoque. | CAT 30 produtos/120 variantes/30 imagens; UI 30 imagens carregadas e detalhe. | atendido localmente |
| RF08 | O catálogo deverá permitir filtrar camisas por cor, preferencialmente por meio de um menu lateral. | 15 cores dinâmicas no menu lateral; filtro e URL na API. | CAT combinações; UI cor preta e combinação com outros filtros. | atendido localmente |
| RF09 | O catálogo deverá permitir filtrar produtos entre estampados e não estampados. | is_printed real; 15 estampadas e 15 sem estampa. | CAT combinações; UI filtro de estampa; inspeção das imagens. | atendido localmente |
| RF10 | O catálogo deverá permitir filtrar os produtos de acordo com os tamanhos disponíveis. | Filtro exige tamanho ativo com saldo positivo; detalhe mantém a grade. | CAT 480 combinações, tamanho zerado e peça esgotada; UI tamanho M. | atendido localmente |
| RF11 | O catálogo deverá permitir visualizar produtos que estejam em promoção. | 12 promoções iniciais; preço efetivo e filtro promocional. | CAT combinações; UI filtro e painel de 12 promoções. | atendido localmente |
| RF12 | O usuário deverá poder ordenar produtos em ordem alfabética (A-Z), por menor/maior valor, por produtos mais novos e por produtos mais antigos. | Cinco ordenações na API, com desempate estável e normalização de acentos. | CAT ordenações/repetição; UI cinco opções em desktop e celular. | atendido localmente |
| RF13 | O sistema deverá disponibilizar carrinho completo, permitindo adicionar e remover produtos e alterar quantidades antes da finalização. | Carrinho no navegador; API revalida preços, disponibilidade e quantidade. | UI compra/cupom; DB cart-profile e catálogo: quantidades, mudanças e estoque. | atendido localmente |
| RF14 | O sistema deverá permitir informar e validar cupons de desconto no processo de compra. | FORMA10 inicial; desconto em centavos calculado no servidor. | UI cupom; DB security-boundary: cupom inválido/inativo e totais adulterados. | atendido localmente |
| RF15 | O sistema deverá calcular opções e valores de frete antes da conclusão do pedido. | Frete demo explícito de R$ 10,00; integração Melhor Envio Sandbox implementada. | UI frete demonstrativo antes do pedido; DB cotação persistida; Melhor Envio externo não homologado. | parcial |
| RF16 | O sistema deverá apresentar um fluxo de finalização contendo itens, valores, descontos, endereço, frete e forma de pagamento. | Checkout local completo, com forma de pagamento demo identificada; fluxo externo separado. | UI cadastro até histórico, total R$ 108,91; DB reservas, snapshot e idempotência. Não equivale a RF17 homologado. | atendido localmente |
| RF17 | O pagamento do pedido deverá ser processado por integração com o gateway Mercado Pago. | Checkout Pro e Payments API implementados; demo padrão usa forma_demo; demo opcional vincula pedido ao MP sandbox. | DB webhook/valor/idempotência com fixtures. Nenhuma transação Mercado Pago real/sandbox homologada. | parcial |
| RF18 | Após a confirmação do pedido, o sistema deverá enviar um e-mail de confirmação de compra ao usuário. | Outbox transacional, mock e SMTP; confirmação de compra após aprovação verificada/demo. | DB envio a capturador SMTP loopback e mock; UI dispara fluxo e SQL confere outbox. Entrega externa não homologada. | parcial |
| RF19 | O usuário autenticado deverá possuir uma área de favoritos para salvar produtos de interesse. | Favoritos persistentes por proprietário, com resolução do produto na API. | UI salvar, abrir/recarregar e remover favorito; serviços autenticados lidos. | atendido localmente |
| RF20 | O usuário deverá possuir uma lista de compras para organizar produtos que deseja adquirir. | Listas por conta com nome e itens, CRUD autenticado. | UI criar/renomear/adicionar peça/recarregar/remover item e lista. | atendido localmente |
| RF21 | A aplicação deverá possuir uma landing page ou seção institucional 'Sobre Nós'. | Página /sobre apresenta a proposta e o contexto acadêmico. | Código About.jsx e UI /sobre em 768/320 px. | atendido localmente |
| RF22 | O sistema deverá disponibilizar painel de administração restrito a usuários autorizados. | requireAuth/requireRole na API e proteção de rota no React. | UI cliente recusado/admin com login normal; DB admin-products e authz. | atendido localmente |
| RF23 | O administrador deverá poder cadastrar e editar informações dos produtos. | Editor de produto, uploads e status, com validação e versão de edição. | DB admin-products cria/edita; UI edita peça nova e confere vitrine; seed preserva. | atendido localmente |
| RF24 | O administrador deverá poder alterar os preços dos produtos. | Preços normal/promocional em centavos; servidor protege reservas. | UI preço 154,90/promo 124,90 e vitrine; DB conflitos/histórico. | atendido localmente |
| RF25 | O administrador deverá poder editar os tamanhos disponíveis para cada produto. | Grade P/M/G/GG com estoque e retirada lógica; revisão por tamanho. | UI altera estoque GG; DB admin-products retira tamanho e preserva histórico. | atendido localmente |
| RF26 | O administrador deverá poder criar e editar promoções aplicadas aos produtos. | Preço promocional editável; vazio encerra promoção. | UI painel/promocional; DB criar/alterar/encerrar e validações. | atendido localmente |

## Matriz não funcional — RNF01–RNF14

| ID | Enunciado literal do PDF | Implementação | Evidência / limite | Estado |
| --- | --- | --- | --- | --- |
| RNF01 | A interface web deverá ser desenvolvida utilizando React. | React 19, componentes e React Router. | package.json, UI real e build Vite. | atendido localmente |
| RNF02 | Os dados persistentes da aplicação deverão ser armazenados em banco de dados relacional PostgreSQL. | Contas/catálogo/pedidos/carteira persistem no PostgreSQL; carrinho fica no localStorage. | DB migrações 0001–0014 e snapshots; seleção do carrinho não está no banco. | parcial |
| RNF03 | A interface deverá se adaptar adequadamente a computadores, tablets e smartphones. | CSS responsivo com navegação móvel e grade adaptável. | UI compra em 1440/390; layouts de catálogo/produto/checkout/conta admin em 768/320; sem aparelhos físicos. | atendido localmente |
| RNF04 | A navegação deverá apresentar organização clara, mantendo catálogo, filtros, carrinho, conta e checkout de fácil acesso. | Navegação, formulários, resumos, erros e estados vazios; atalho admin do commit integrado. | UI jornada normal e telas associadas; inspeção visual. Não é auditoria integral de acessibilidade. | atendido localmente |
| RNF05 | A interface deverá adotar como paleta principal as cores #E9F1FA, #00ABE4 e #FFFFFF. | Tokens CSS preservam a paleta literal. | global.css e capturas de catálogo, conta, checkout e administração. | atendido localmente |
| RNF06 | Credenciais e sessões de usuários deverão ser tratadas de forma segura, sem armazenamento de senhas em texto puro. | Scrypt/salt, hash de sessão, reautenticação/revogação; HTTP local e Bearer no localStorage. | DB password-token/cart-profile; sem rate limiting e sem endurecimento geral para produção. | parcial |
| RNF07 | Dados sensíveis de pagamento deverão ser tratados pelos recursos seguros do Mercado Pago, evitando armazenamento indevido de dados completos de cartão pela aplicação. | Secure Fields e token temporário; PAN/CVV proibidos na API e não persistidos. | DB segurança/carteira com fixtures; tokenização SDK/provedor real ainda não homologada. | parcial |
| RNF08 | Funções administrativas deverão ser acessíveis somente a usuários autorizados. | Papel no banco e middleware de autorização em todas as rotas administrativas. | DB 401/403 e A/B; UI cliente recusado e login normal de admin. | atendido localmente |
| RNF09 | Informações pessoais, endereços e preferências do usuário deverão possuir acesso controlado e ser tratados de acordo com as necessidades da aplicação. | Filtragem pelo usuário autenticado, CORS e respostas sem segredos. | DB isolamento A/B e segurança; token no navegador e ausência de auditoria geral de produção. | parcial |
| RNF10 | As páginas e operações principais deverão ser implementadas de modo a oferecer resposta adequada durante navegação, filtragem e uso do carrinho. | WebP/lazy e 30 peças funcionais localmente; sem paginação ou ensaio de carga. | UI navegação e 480 consultas combinadas sem falhas; não mede capacidade/carga concorrente. | parcial |
| RNF11 | A aplicação deverá funcionar nos principais navegadores modernos. | Rodada atual no Brave/Chromium headless. | UI desktop/celular emulado; Firefox/WebKit e aparelhos físicos não verificados. | parcial |
| RNF12 | O código deverá ser organizado em componentes e módulos, facilitando manutenção e evolução do sistema. | Componentes, serviços, módulos Express, migrações, contratos e verificadores reproduzíveis. | Leitura da estrutura, lint/build e suíte DB; seed/testes ampliados sem duplicar checkout. | atendido localmente |
| RNF13 | A aplicação deverá evitar duplicidade de pedidos e manter consistência entre carrinho, valores, descontos, frete e pagamento. | Locks, idempotência, reservas e snapshots; modo/provider demo separados de gateway. | DB concorrência/expiração/adulteração/upgrade; UI demo. Ciclo completo externo não homologado. | parcial |
| RNF14 | E-mails de compra e promoções deverão ser enviados de acordo com o tipo de comunicação e com o consentimento aplicável do usuário. | Opt-in persistente e transacional independente; envio promocional ausente. | DB mock/SMTP loopback e opt-in; transporte SMTP externo não homologado. | parcial |

## Pendências e limites

- **RF06, RF15, RF17 e RF18:** homologar cartões/Mercado Pago, Melhor Envio
  Sandbox e SMTP externo. Fixtures e modo demo não comprovam esses serviços.
  RF16 é atendido no fluxo local demonstrativo; isso não altera o estado de RF17.
- **RNF02/06/07/09/10/11/13/14:** carrinho e token no localStorage, HTTP local,
  sem rate limiting nem auditoria geral de produção, carga/paginação não aferidas,
  Firefox/WebKit não verificados, ciclo externo não homologado e disparo
  promocional ausente. O opt-in existe, mas não envia promoções.
- Recuperação de senha e verificação de e-mail por link são melhorias futuras
  além dos requisitos explícitos. Vercel/Supabase são a hospedagem proposta no
  PDF, não um deploy realizado nesta entrega.
- Não houve cobrança, compra de etiqueta ou envio externo. A demo consome apenas
  o estoque do PostgreSQL local e conserva marca permanente de simulação.

## Reproduzir e consultar as evidências

[README](../../README.md) contém instalação e ativação explícita da demo;
[contratos](API_CONTRATOS.md) descrevem as rotas. A
[auditoria de segurança](AUDITORIA_SEGURANCA.md) preserva os achados e correções
anteriores; a [entrega de 22/10](ENTREGA_LOCAL.md) é histórica e usa a coleção antiga.

As evidências recentes ficam em **`.tmp/entrega-local-20261023/`**, ignorado pelo
Git: `local-browser/`, `regression-browser/` e `mp-browser/` (capturas e JSON),
`db-tests/` (TAP e resultados), `standard.log`, `lint.txt`, `build.txt`,
`git-diff-check.txt`, `catalog.json`, `git-status.txt`, `security/` e folha de contato. Os nomes distinguem catálogo, filtro,
produto, favoritos, lista, perfil, endereço, carrinho, frete, pagamento,
confirmação, histórico e produtos/promoções/pedidos administrativos.

Os bancos de teste são locais e descartáveis; nenhum `.env` real, token de sessão
ou segredo de serviço integra as evidências versionadas. Capturas usam contas
fictícias. **Nenhum PDF ou rascunho de relatório final foi produzido**: estes
artefatos destinam-se somente à consulta na elaboração futura.

O primeiro teste desta rodada encontrou um prazo curto de 5 segundos no subprocesso
que verifica recusa de configuração; sob carga, o processo excedeu esse limite.
O prazo do verificador foi ajustado para 15 segundos, mantendo as mesmas recusas.
Também foi corrigida uma espera prematura pelo formulário de login no harness.
Os resultados acima correspondem à reexecução completa aprovada.

Após o pull, o novo atalho administrativo evidenciou sobreposição entre menu e
conta no cabeçalho. A grade CSS passou a reservar a largura da conta e permitir
quebra de linha do menu, preservando o atalho. A execução final conferiu o
cabeçalho em 1440/1280/1024/901 px, menu móvel, placeholder de UF lido no código
e novamente toda a jornada. Um encerramento do navegador intermediário levou
à inclusão de detecção de perda de conexão no verificador, evitando espera
indefinida; não é um resultado aprovado usado na contagem final.
