# FORMA — auditoria consolidada de requisitos

Atualização: **22/10/2026**. Fonte: `REQUISITOS_DO_PDF.txt` (RF01–RF26,
RNF01–RNF14). Escopo: projeto acadêmico local, React + Express + PostgreSQL;
sem hospedagem. Esta matriz substitui o estado histórico das etapas anteriores.

## Condições observadas

Checkout inicial limpo, branch `main`, HEAD `d52c74e`, referência local de
`origin/main` no mesmo commit. Reflog consultado; o e-mail e a migração 0011 já
estavam presentes. Nenhum `AGENTS.md` aplicável. Não foram executados `git add`,
commit, push, reset ou comandos de descarte.

PostgreSQL descartável em `127.0.0.1:55435`, diretório
`/tmp/forma-final-pg-20261022`. Migrações 0001–0011 do zero passaram; a nova
0012 foi aplicada em seguida e também do zero nas bases isoladas da suíte.
Upgrade 0010 → 0011 → 0012 preservou usuário/opt-in, produto editado, pedido
e tentativa Checkout Pro legada. Seed: 12 inseridos na primeira execução,
zero na segunda; 12 produtos, 48 variantes e 12 imagens. Concorrência e
preservação de estoque/preços/datas/uploads/descrições são testadas.

O banco habitual já continha 12 produtos: `api:setup` aplicou 0010–0012,
inseriu zero produtos e atualizou somente placeholders conhecidos. Admin criado;
a segunda execução preservou a conta. Login 200; produtos 200 com 12 registros;
pedidos 200 com zero registros no banco habitual.

**Nenhum serviço Mercado Pago ou Melhor Envio foi chamado.** Não havia Access
Token/public key/webhook/callback MP nem configuração utilizável de frete. SMTP
externo ausente; modo habitual `mock`. Os testes de provedor usam fixtures.
SMTP de captura em loopback foi exercitado por conexão real, mas não comprova
entrega externa. SDK de cartões no navegador ainda não foi homologado com dados
de teste do provedor. RF06 não é classificado como completo.

## Evidências

| Sigla | Evidência |
|---|---|
| U | `npm test`: 22 arquivos passaram; `npm test --prefix server`: 17 arquivos passaram; execução padrão não habilita as integrações opt-in |
| H | `npm run test:db`: 17 arquivos, **110 testes passaram, zero falhas, zero skips**, cada arquivo com banco próprio; TAP/JSON em `.tmp/db-tests/` |
| C | `catalog.test.js`: 10 testes, seed/edições e 210 combinações de filtros |
| A | `admin-products.integration.test.js`: 10 testes; schemas, autorização, preços, grade, reservas e histórico |
| P | `cart-profile.integration.test.js`: 12 testes; conta, sessão, credenciais e carrinho |
| K | `demo-cards.integration.test.js`: 10 testes; provisionamento, carteira/dono, concorrência, recusa, timeout/reconciliação, e-mail e exclusão |
| M | `cards-migration.integration.test.js`: 7; `upgrade.integration.test.js`: 1 |
| E | `email-confirmation.integration.test.js`: 9; `email-purchase.test.js`: 9; SMTP local, retry/backoff, opt-in e limites de duplicidade |
| BC | Navegador catálogo: 43 checks, 1440/768/390/320 px, imagens/filtros/ordenações/carrinho/admin/fallback |
| BA | Navegador administrador: 23 checks, 1440/768/390/320 px, edição/vitrine, estoque/imagens/promoção/conflitos |
| BP | Navegador carrinho/perfil: 39 checks, 1440/768/390/320 px, quantidade/cupom/preço/rede/credenciais |
| BD | Navegador completo: 30 checks, 1440/390 px, cadastro → favoritos/lista → endereço → carrinho/cupom → frete fixture → pedido → pagamento fixture → SMTP local → histórico → login admin/pedidos |
| BG | Verificador geral: 20 rotas × 7 larguras (140 checks de layout), sem overflow; rótulo legado “21 telas” corrigido no script |
| V | `npm run lint`, `npm run build`, `git diff --check`: aprovados; build com 69 módulos |

As quatro suítes usam Brave/Chromium headless e somam **135 checks**, sem exceções
JS ou overflow nas verificações. Capturas/resultados em
`.tmp/{catalog,admin,cart-profile,demo}-browser/`. Larguras são emulação, não
aparelhos físicos. A revisão visual incluiu catálogo mobile, detalhe desktop,
editor administrativo e pedidos mobile. Falhas iniciais de teste corrigidas:
outbox compartilhado, espera prematura pelo React, fixture de upgrade sem
as dimensões obrigatórias e IDs de pagamento de fixture reutilizados. O verificador
geral também encontrou overflow real do cupom em 901 px: corrigido permitindo
quebra do campo/botão no espaço disponível do resumo.

## Matriz RF

“Atendido” refere-se ao escopo acadêmico local testado; “Parcial” identifica
validação externa ou parte pendente. Fixture nunca equivale a homologação de
provedor. Nenhum RF está totalmente ausente.

| ID | Requisito | Estado | Evidência / limite |
|---|---|---|---|
| RF01 | Cadastro antes de concluir compra | Atendido | `requireAuth`, P/BD; checkout/frete sem sessão dão 401 |
| RF02 | Opt-in promocional | Atendido | Cadastro desmarcado, perfil persiste `promo`; P/BD/E |
| RF03 | Login e recursos da conta | Atendido | Scrypt/sessão Bearer, P/K/BD; admin usa login normal |
| RF04 | Perfil | Atendido | Nome/opt-in, troca segura de e-mail/senha; P/BP |
| RF05 | Endereços | Atendido | API por proprietário, criar/editar/principal/remover; P/BD/U |
| RF06 | Manter/pagar com cartões | Parcial | API/telas e Payment.create implementados; K/M; Secure Fields e Customer/Card/Payment reais bloqueados por credenciais |
| RF07 | Catálogo | Atendido | 12 peças, 11 imagens IA próprias + peça preta, preços/estoque; C/BC |
| RF08 | Cor | Atendido | C: cores dinâmicas; BC: combinação e recarga |
| RF09 | Estampa | Atendido | SQL `is_printed`, C/BC |
| RF10 | Tamanho | Atendido | Variantes com saldo positivo, grade completa; C/BC |
| RF11 | Promoção | Atendido | Quatro promoções, C/BC |
| RF12 | Cinco ordenações | Atendido | A–Z, preços, novos/antigos e desempate UUID; C/BC |
| RF13 | Carrinho | Atendido | Quantidade/remover/imagem/revisão/limites/preços; P/BP/BD; seleção por navegador |
| RF14 | Cupons | Atendido | FORMA10, erro/remoção/revalidação/cálculo em centavos; P/BP/BD |
| RF15 | Frete | Parcial | Melhor Envio implementado; cotação fixture BD; sandbox real não homologado |
| RF16 | Checkout | Parcial | Fluxo local completo BD, snapshots/reservas/idempotência H; provedores reais bloqueados |
| RF17 | Mercado Pago | Parcial | Checkout Pro + Payments API; K e segurança/webhook por fixture; nenhuma chamada sandbox real |
| RF18 | E-mail de compra | Parcial | Outbox/SMTP local E/BD, quatro capturas no fluxo completo; entrega externa não homologada |
| RF19 | Favoritos | Atendido | API persistente; recarga direta resolve produto pela API; BD |
| RF20 | Listas | Atendido | CRUD/itens, contagem real, resolução sem depender de cache; BD/U |
| RF21 | Sobre Nós | Atendido | Página institucional atualizada para coleção demonstrativa local |
| RF22 | Administração restrita | Atendido | Middleware/RequireRole; 401/403 A/K; cliente recusado e admin entra BA/BD |
| RF23 | Produtos | Atendido | Editor/API reutilizados, A/BA; consulta de pedidos adicional |
| RF24 | Preços | Atendido | Normal/promocional em centavos, locks e histórico preservado; A/BA |
| RF25 | Tamanhos/estoque | Atendido | Grade P/M/G/GG, retirada lógica, concorrência/reservas; A/BA |
| RF26 | Promoções | Atendido | Criar/editar/encerrar preço promocional; A/BA |

## Matriz RNF

| ID | Requisito | Estado | Evidência / limite |
|---|---|---|---|
| RNF01 | React | Atendido | React 19/componentes, V e suítes de navegador |
| RNF02 | PostgreSQL | Parcial | Conta/catálogo/pedidos/carteira persistidos, M/H; carrinho em localStorage |
| RNF03 | Responsividade | Atendido no escopo testado | BC/BA/BP 320–1440 px, BD 390/1440; sem aparelhos físicos |
| RNF04 | Usabilidade | Atendido no escopo testado | Navegação/campos/erros/vazios, 135 checks; sem auditoria completa de acessibilidade |
| RNF05 | Identidade | Atendido | #E9F1FA/#00ABE4/#FFFFFF preservados; capturas revisadas |
| RNF06 | Autenticação segura | Parcial | Scrypt, hash de sessão, reautenticação/revogação P/K; HTTP local, Bearer em localStorage, sem rate limiting/recuperação |
| RNF07 | Pagamento seguro | Parcial | Secure Fields, dados mínimos, tokens só em memória, K/M; SDK/browser e provedor reais não homologados |
| RNF08 | Controle de acesso | Atendido | Carteira/pedido por dono e middleware admin; A/P/K/BD |
| RNF09 | Proteção de dados | Parcial | APIs autenticadas, isolamento K/P; sem auditoria geral de produção |
| RNF10 | Desempenho | Parcial | WebP/lazy, hero ~80 KB e camisa preta ~44 KB; sem teste de carga/paginação |
| RNF11 | Compatibilidade | Parcial | Brave/Chromium nesta rodada; Firefox/WebKit não testados |
| RNF12 | Manutenibilidade | Atendido no escopo local | Módulos reutilizados, migração nova, contratos e suíte reproduzível V/H |
| RNF13 | Consistência do pedido | Parcial | H/K: locks/reservas/snapshots, cobrança concorrente única, expiração/reconciliação/e-mail; ciclo externo não homologado |
| RNF14 | E-mail/consentimento | Parcial | Opt-in independente do transacional E; envio promocional ausente, SMTP externo não homologado |

## Pendências e reprodução

Permanecem as homologações de Mercado Pago/Melhor Envio/SMTP e o disparo
promocional. Não houve cobrança, emissão de etiqueta ou envio externo. O painel
de pedidos é de consulta e não permite alterar estados ou marcar pago.
Recuperação de senha e endurecimento para produção estão fora desta entrega local.

Comandos completos, roteiros por serviço, arquivos e sugestões de commits manuais:
[ENTREGA_LOCAL.md](ENTREGA_LOCAL.md). Prompts e imagens: [IMAGENS.md](IMAGENS.md).
Contratos: [API_CONTRATOS.md](API_CONTRATOS.md).


## Auditoria de segurança complementar — 22/10/2026

Parecer **pronto para commit no escopo acadêmico local**, mantendo homologação
externa pendente. Correções de Vite/arquivos privados, janela de assinatura de
webhook, provisionamento demo, ambiente público/privado e mensagens sem segredos:
[AUDITORIA_SEGURANCA.md](AUDITORIA_SEGURANCA.md).

Evidências desta rodada: 139/139 testes de API em 22 bancos isolados, 93 testes
no comando raiz (83 passaram, 10 integrações puladas sem URL; nenhuma falha),
56 checks no harness de segurança (40 no Chromium desktop/celular e 16 caminhos
privados HTTP negados), build com
canários privados sem vazamento, lint/diff limpos. Carteira/SDK/pagamento/frete
nesses harnesses usam fixtures; SMTP é local. Nenhum serviço externo homologado.

| Requisito relacionado | Estado após auditoria | Evidência / limite |
| --- | --- | --- |
| RF06 — cartões | Parcial | Isolamento e token-only executados; tokenização/pagamento no sandbox real ainda pendentes. |
| RNF07 — pagamento seguro | Parcial | Valores autoritativos, timestamp de webhook e idempotência executados com gateway fixture. Falta homologação real. |
| RNF08 — acesso | Atendido no escopo local | Conta A/B, admin/comum, negação de provisionamento em produção/remoto e preservação de senha. |
| RNF09 — dados | Parcial | Env/ignore/bundle/Git e logs corrigidos/verificados; não equivale a auditoria geral de produção/certificação. |
| RNF13 — consistência | Parcial | HTTP/SQL/navegador e suíte de concorrência/reservas passam; ciclo externo não homologado. |
| RNF14 — e-mail | Parcial | Captura SMTP e erro hostil sem eco de credenciais; entrega externa pendente. |


Os três achados da revisão independente foram corrigidos: guard único de banco
local nos runners/integrações/admin, cartão salvo indisponível sem callback e
segredo antes de qualquer tentativa, e upgrade independente de CWD. O upgrade
passou pela raiz e por server. Novos testes de recusa não usam banco remoto;
continua pendente a homologação dos serviços externos. Detalhes na auditoria de
segurança vinculada acima.
