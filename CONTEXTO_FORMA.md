# FORMA — contexto para continuidade do projeto

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

Produto e checkout têm interfaces adaptadas ao catálogo vazio. Administração possui uma prévia visual pública explicitamente identificada como demonstração, com seções de produtos, promoções e pedidos; não constitui um painel administrativo operacional ou restrito. Não criar privilégios de administrador para clientes nem implementar gerenciamento de produtos nesta fase.

**Catálogo vazio, sem produtos fictícios. Imagens em banners e áreas institucionais estão autorizadas desde a solicitação de 05/10/2026.** Essa autorização substitui a restrição anterior de ausência total de imagens na interface. Usar a foto original `docs/forma/referencias/imagens-originais/hero-editorial.png` no banner principal, copiando os arquivos efetivamente utilizados para `src/assets/`. Construir o banner com componentes React, textos e botões reais; nunca usar a página inteira do mockup como imagem do site. Não acrescentar banners ou composições sem referência aprovada.

O aluno adicionará os produtos e suas imagens em uma etapa posterior. As regiões de produtos continuam com estados vazios discretos, preservando o estilo do mockup. Não mostrar cards de produtos, preços, avaliações, estoque, pedidos, favoritos ou contadores fictícios. A imagem `camisa-preta.png` não está autorizada para simular produtos nesta etapa.

Cadastro, login, sessão e preferências devem funcionar como demonstração acadêmica com **persistência local no navegador (`localStorage`)**. Não integrar Supabase, Vercel, banco remoto, API ou back-end nesta etapa. Não implementar pagamento, frete, envio de e-mail ou checkout real sem uma nova solicitação. A hospedagem simples Supabase/Vercel no PDF é uma proposta futura.

### Persistência local

- Cadastro: nome, e-mail, senha, confirmação de senha e consentimento para receber promoções, inicialmente desmarcado.
- Validar campos, confirmação e e-mails duplicados; fornecer mensagens claras.
- Login, sessão após recarregar/reabrir, logout e Minha Conta com edição de nome e preferência promocional.
- Endereços e listas de compras podem ser criados, editados e removidos localmente por conta. Listas têm tela de detalhes vazia; pedidos e cartões têm estados vazios. Não cadastrar cartões nem simular pedidos.
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
- Requisitos não funcionais: React, PostgreSQL no estágio futuro, responsividade, usabilidade, identidade visual, segurança de credenciais/pagamento, controle de acesso, proteção de dados, desempenho, compatibilidade, manutenção, consistência de pedidos e comunicação por e-mail conforme consentimento.
- Planejamento posterior: PostgreSQL/Supabase, hospedagem simples na Vercel, Mercado Pago e serviço de frete como Melhor Envio. Nada disso deve ser integrado nesta fase.

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
