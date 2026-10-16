# FORMA — contexto para continuidade do projeto

### Etapa autorizada em 16/10/2026 — catálogo demonstrativo

O aluno autorizou seed PostgreSQL idempotente de camisas oversized e uso da
foto local adequada `camisa-preta.png`, com placeholders locais identificados
para peças sem fotografia. Esta autorização substitui as restrições históricas
de catálogo vazio e de não usar a foto da camisa. Vitrine, detalhes, carrinho
e consulta administrativa usam a API; filtros e todas as ordenações do PDF
devem funcionar. Não criar outro banco/arquitetura, não fazer commit nem push.
Ver `docs/forma/AUDITORIA_REQUISITOS.md` para evidências desta etapa.

Leia este arquivo antes de alterar o projeto. As decisões abaixo foram definidas com o aluno; o código atual deve ser inspecionado para confirmar o que já foi implementado.

## Projeto e identidade

Projeto acadêmico de uma loja virtual de camisas oversized masculinas. O nome definitivo é **FORMA**, conforme o PDF entregue ao professor. Não usar OverStore ou Ze Buc como marca deste projeto.

Front-end obrigatório: **React**. A base prevista utiliza **Vite**; preserve a linguagem e a organização existentes, sem migrar o projeto desnecessariamente.

Paleta aprovada: `#E9F1FA` (azul claro), `#00ABE4` (azul de destaque), `#FFFFFF` (branco). O código correto é E9F1FA, nunca I9F1FA. Os tons escuros e neutros usados nos mockups complementam a paleta: `#102430`, `#062D3D`, `#73828A`, `#F6F8F9`, `#E4EBEE`.

## Fonte visual obrigatória

- PDF: `docs/forma/referencias/FORMA_Requisitos_e_Mockups.pdf`.
- As sete imagens em `docs/forma/referencias/mockups/` são renderizações diretas das páginas 5 a 11 do mesmo PDF. Não são novos designs.
- O mapeamento está em `docs/forma/GUIA_VISUAL.md`.
- Preserve a composição, hierarquia tipográfica, espaçamentos, cores, proporções, navegação, botões e organização dessas referências ao refinar a interface. Não invente uma identidade diferente.
- A barra de navegador, o título “MOCKUP VISUAL” e as legendas externas pertencem à apresentação do PDF; não são elementos do site.
- O PDF apresenta uma visão completa com produtos e dados ilustrativos. Esses exemplos não autorizam cadastrar dados no estágio atual.

## Etapa atual autorizada

Desenvolver e refinar progressivamente a base do front-end, com navegação e organização visual. Além de início, catálogo, Sobre Nós, carrinho, login e cadastro, a solicitação de 05/10/2026 autorizou completar as telas visuais dos mockups e as opções internas do perfil. Minha Conta inclui visão geral, pedidos, favoritos, listas, endereços, cartões e dados pessoais. Favoritos também possui página própria: o coração abre `/favoritos`, enquanto o ícone de usuário abre `/minha-conta`.

Produto e checkout têm estados vazios quando não há produtos ou itens reais. O catálogo pode usar produtos cadastrados na API local. Administração possui uma prévia visual identificada como demonstração, ainda sem gestão completa de produtos, promoções e pedidos. Não criar privilégios de administrador para clientes.

**Catálogo vazio, sem produtos fictícios. Imagens em banners e áreas institucionais estão autorizadas desde a solicitação de 05/10/2026.** Essa autorização substitui a restrição anterior de ausência total de imagens na interface. Usar a foto original `docs/forma/referencias/imagens-originais/hero-editorial.png` no banner principal, copiando os arquivos efetivamente utilizados para `src/assets/`. Construir o banner com componentes React, textos e botões reais; nunca usar a página inteira do mockup como imagem do site. Não acrescentar banners ou composições sem referência aprovada.

O aluno adicionará os produtos e suas imagens em uma etapa posterior. As regiões de produtos continuam com estados vazios discretos, preservando o estilo do mockup. Não mostrar cards de produtos, preços, avaliações, estoque, pedidos, favoritos ou contadores fictícios. A imagem `camisa-preta.png` não está autorizada para simular produtos nesta etapa.

Cadastro, login, sessão e preferências funcionavam como demonstração no navegador — a autenticação foi substituída pela API local em 15/10/2026. Integrações e blocos de compra só devem ser implementados conforme solicitações específicas; veja a autorização mais recente abaixo.

### Nova etapa autorizada em 14/10/2026 — back-end e banco locais

A solicitação de 14/10/2026 substitui a restrição anterior de ausência total de API/back-end. A etapa atual autoriza:

- **Back-end local**: `server/` com Node.js/Express e **PostgreSQL local** (processo na própria máquina, via migrações versionadas). Sem Supabase, Vercel, banco remoto, hospedagem ou deploy — nada será publicado; tudo roda em `localhost`.
- **Catálogo funcional**: produtos reais podem ser cadastrados no banco e servidos pela API, encerrando o catálogo vazio das etapas anteriores.
- **Integrações**: Mercado Pago (pagamento), cálculo de frete (ex.: Melhor Envio) e envio de e-mail (confirmação de compra e promoções com consentimento) estão autorizados nesta etapa, cada um implementado em blocos próprios e sem nenhuma credencial real no repositório.

Limites mantidos: implementar um bloco por vez, conforme solicitação específica; privilégios de administrador, cartões e dados sensíveis seguem as regras do PDF (RNF07–RNF09); contratos, padrões de centavos e organização das migrações estão em `docs/forma/API_CONTRATOS.md`. O front aprovado não é reescrito: a migração das telas do `localStorage` para a API acontece gradualmente, usando o cliente HTTP reutilizável `src/services/api.js`.

### Nova etapa autorizada em 15/10/2026 — autenticação no servidor e papéis

A solicitação de 15/10/2026 substituiu a autenticação do navegador pela autenticação no servidor local, preservando as telas aprovadas. Decisões registradas:

- Cadastro, login, logout e sessão vivem na API (`server/`): senhas com **scrypt** e salt no servidor, **e-mail único** (case-insensitive), consentimento promocional **desmarcado por padrão**. O navegador guarda apenas o token de sessão (`forma:apiToken`), validado a cada abertura com `GET /api/auth/eu`.
- Papéis **cliente** e **administrador** em `users.role`. Toda conta criada pela API nasce cliente — o papel nunca vem do corpo de requisições HTTP. `administrador` é concedido apenas pelo comando local `npm run api:admin` (senha informada no terminal ou por `ADMIN_PASSWORD`; **nenhuma senha fixa no código**).
- Autorização reutilizável no back-end: `requireAuth` + `requireRole` (`server/src/middleware/authorize.js`), 403 `acesso_negado` para clientes em rotas administrativas. O front usa o papel apenas para esconder rotas (`RequireRole` protege `/administracao`); a decisão de autorizar é sempre do servidor.
- **Transição sem migração de dados não confiáveis**: as chaves antigas do navegador (`forma:users`, `forma:session`, `forma:account:*`) permanecem intactas, sem leitura, escrita ou exclusão. Hashes PBKDF2 feitos no navegador e privilégios locais **não são importados como dados confiáveis** — contas são recadastradas no servidor e endereços/listas antigos não migram.
- O painel `/administracao` continua prévia visual (gerenciamento operacional chega com o bloco de catálogo), agora restrita a administradores.

### Nova etapa autorizada em 15/10/2026 — Lucas: frete e checkout

- Conectar catálogo/carrinho de Hugo e Gabriel ao checkout existente, incluindo
	endereços e cupons já disponíveis.
- Integrar somente cotações do Melhor Envio no Sandbox, com origem configurável,
	endereço de destino e peso/dimensões/quantidades dos produtos. Segredos e
	tokens permanecem no servidor local; sem cotações fictícias.
- Invalidar cotação ao mudar endereço ou carrinho; exigir sessão para cotar e
	confirmar pedido. O pedido local fica `aguardando_pagamento` até futura
	integração de pagamento.
- Não processar Mercado Pago, não comprar etiquetas, não despachar e não enviar
	e-mail nesta etapa. Front, API e PostgreSQL ficam locais; sem deploy ou
	commit/push automático. Guia: `docs/forma/entregas/03-compra.md`.

### Nova etapa autorizada em 15/10/2026 — Lucas: pedidos e Mercado Pago

- Manter pedidos/itens com snapshots; revalidar preço, cupom e estoque no
	servidor; reservar/liberar estoque; impedir pedido, resgate de cupom ou baixa
	duplicada.
- Usar Checkout Pro hospedado com credenciais exclusivamente de teste. Cartões
  salvos ficam na Wallet Mercado Pago; FORMA não armazena PAN, CVV, validade ou
  token. Histórico e detalhe ficam em Minha Conta > Pedidos.
- Reconciliar pagamentos somente após verificar assinatura do webhook e
	consultar o gateway, conferindo referência do pedido, preferência, valor,
	moeda e `live_mode=false`. Página de retorno nunca é confirmação.
- Documentar túnel HTTPS temporário; o app e banco continuam locais, sem
	cobranças reais, hospedagem permanente, etiquetas/envios, commit ou push.
	Guia: `docs/forma/entregas/04-pagamento.md`.

### Persistência local — demonstração anterior à API

As regras abaixo descrevem a etapa de demonstração no navegador, substituída
pela API/PostgreSQL nas autorizações de 14–15/10/2026 acima. As chaves antigas
foram preservadas e não são migradas como dados confiáveis.

- Cadastro: nome, e-mail, senha, confirmação de senha e consentimento para receber promoções, inicialmente desmarcado.
- Validar campos, confirmação e e-mails duplicados; fornecer mensagens claras.
- Login, sessão após recarregar/reabrir, logout e Minha Conta com edição de nome e preferência promocional.
- Endereços, listas e histórico de pedidos usam a API/PostgreSQL. Cartões não são cadastrados na FORMA: Checkout Pro hospedado usa os meios salvos na Wallet do Mercado Pago.
- Dados adicionais usam `forma:account:<userId>` com versão 1 e coleções `addresses`/`lists`. Chaves de autenticação e credenciais anteriores permanecem intactas. Não sobrescrever JSON inválido ou versões desconhecidas.
- Atualizar o estado React e o cabeçalho quando o usuário entra, sai ou edita dados. Restringir a rota de conta no fluxo da demonstração.
- Centralizar o acesso ao armazenamento em módulo de serviço; tratar dados ausentes ou corrompidos sem quebrar a aplicação.
- Não armazenar senhas em texto puro. Para a demonstração, usar Web Crypto com PBKDF2 e salt aleatório por usuário. Explicar no README que autenticação local e proteção de rota no cliente não equivalem a autenticação segura de produção; usar credenciais fictícias.
- Não armazenar cartões nem dados sensíveis de pagamento localmente.
- `localStorage` pertence ao navegador/origem; usuários e sessões não são sincronizados entre PCs.

## Requisitos finais preservados para próximas entregas

Estes são objetivos futuros, não tarefas para implementar todos agora. O PDF é a especificação completa.

- RF01–RF06: cadastro obrigatório antes da conclusão de compra, consentimento promocional, login, edição de perfil, endereços salvos e cartões tratados pelos mecanismos seguros do gateway.
- RF07–RF12: catálogo, filtros laterais por cor, estampada/lisa, tamanhos e promoção; ordenação A–Z, menor/maior preço, mais novos/mais antigos.
- RF13–RF18: carrinho com adicionar/remover/quantidade, cupons, cálculo de frete, checkout, Mercado Pago e confirmação de compra por e-mail.
- RF19–RF21: favoritos, listas de compras e página Sobre Nós.
- RF22–RF26: administração restrita para produtos, preços, tamanhos e promoções.
- Requisitos não funcionais: React, PostgreSQL local implementado em `server/` (14/10/2026), responsividade, usabilidade, identidade visual, segurança de credenciais/pagamento, controle de acesso, proteção de dados, desempenho, compatibilidade, manutenção, consistência de pedidos e comunicação por e-mail conforme consentimento.
- Planejamento por blocos desta etapa: catálogo funcional e integrações (Mercado Pago, frete via Melhor Envio, e-mail) são autorizados e devem ser implementados em solicitações próprias. **Não haverá hospedagem, Supabase, Vercel ou deploy**; a proposta de hospedagem do PDF foi descartada nesta etapa do projeto.

## Histórico acadêmico informado

- 25/09/2026: recebimento da proposta e definição dos requisitos.
- 26/09/2026: envio dos requisitos e mockups ao professor pelo Microsoft Teams.
- 30/09/2026: início da base básica do front-end em casa, para aproveitar melhor a aula.
- 02/10/2026: aula de início do código; uso informado de DeepSeek v4.1 pelo OpenCode para estilização básica sobre a base pronta; repositório GitHub iniciado durante a aula.
- Link do GitHub: ainda não informado neste contexto.

O relatório DOCX é um documento em evolução. Não registrar melhorias propostas como concluídas sem verificar o código e receber os fatos necessários. O andamento do repositório não foi inspecionado na criação deste pacote.

## Como trabalhar

1. Ler este contexto, o guia visual, os requisitos extraídos e as imagens correspondentes à tela.
2. Inspecionar o código existente, `package.json`, rotas, componentes e persistência; respeitar instruções existentes no repositório.
3. Alterar somente o escopo da solicitação atual, em etapas pequenas e compreensíveis para o aluno.
4. Comparar a interface com os mockups em desktop e adaptar para mobile. Explicar diferenças inevitáveis dos estados vazios e das telas sem mockup específico.
5. Executar os comandos de verificação disponíveis e atualizar o README com implementação real, execução e limitações locais.
6. Atualizar `docs/forma/ANDAMENTO.md` com mudanças e verificações efetivamente feitas. Não declarar sucesso de comandos que não foram executados.

Não sobrescrever arquivos de contexto, README ou instruções existentes sem integrar suas informações. Este pacote não contém a conversa inteira nem o código do site.
