# Guia visual — mockups originais do FORMA

Fonte: `referencias/FORMA_Requisitos_e_Mockups.pdf`. As imagens foram renderizadas diretamente do PDF a 180 dpi, sem redesenhar, recolorir ou gerar novas telas. O PDF continua sendo a referência vetorial para detalhes pequenos.

| Imagem | Página do PDF | Tela e composição |
| --- | --- | --- |
| `referencias/mockups/01-home.png` | 5 | Cabeçalho, hero editorial com texto à esquerda, botões e destaques abaixo. |
| `referencias/mockups/02-catalogo.png` | 6 | Título, filtros na lateral esquerda, ordenação acima da grade. |
| `referencias/mockups/03-produto.png` | 7 | Galeria à esquerda, informações, cor, tamanhos e compra à direita. |
| `referencias/mockups/04-carrinho.png` | 8 | Itens à esquerda; resumo, cupom e frete à direita. |
| `referencias/mockups/05-checkout.png` | 9 | Etapas de identificação, endereço e pagamento; resumo à direita. |
| `referencias/mockups/06-minha-conta.png` | 10 | Navegação lateral e conteúdo de perfil, pedidos e favoritos. |
| `referencias/mockups/07-administracao.png` | 11 | Cabeçalho administrativo, indicadores e tabela de produtos. |

## Fidelidade

- Manter a referência minimalista: fundos claros, espaços generosos, texto escuro, azul em destaques e bordas suaves.
- Preservar ordem e proporção dos blocos, alinhamentos e hierarquia de títulos.
- A tipografia do mockup foi desenhada com Helvetica/Helvetica-Bold. No navegador, usar uma pilha compatível como Helvetica, Arial, sans-serif; evitar adicionar uma fonte de aparência diferente sem necessidade.
- Cores complementares da referência: texto `#102430`, fundo de ação escuro `#062D3D`, texto secundário `#73828A`, superfície `#F6F8F9`, linha `#E4EBEE`.
- Adaptar as telas horizontalmente desenhadas para mobile sem perder a identidade. Não há mockup mobile específico no PDF.
- Não reproduzir a moldura do navegador, os círculos coloridos, o endereço `forma.store`, o título externo ou as legendas da página como componentes da aplicação.
- Alguns símbolos do PDF são representações limitadas da fonte; usar ícones SVG equivalentes de busca, coração, usuário e sacola, mantendo posição e peso visual. Não copiar quadrados de caracteres ausentes.
- Login, cadastro e Sobre Nós não têm telas individuais entre esses sete mockups. Criar suas composições com o mesmo sistema visual, sem afirmar que existem referências específicas para elas.

## Dados ilustrativos e etapa atual

Produtos, preços, nomes de clientes, pedidos, indicadores e quantidades exibidos no PDF são ilustrações do escopo final. **Não criá-los no código agora.** Usar catálogo e carrinho vazios, contadores somente reais e perfil vinculado ao cadastro local.

Atualização autorizada pelo aluno em 05/10/2026: **imagens nos banners e nas áreas institucionais estão permitidas**, substituindo a restrição anterior. O hero principal deve usar a foto original `hero-editorial.png`. As áreas de produtos permanecem vazias, sem cards, fotografias de produtos ou preços fictícios. Essa autorização não permite criar banners extras, gradientes ou elementos decorativos ausentes das referências aprovadas.

## Telas internas autorizadas em 05/10/2026

- Minha Conta segue `06-minha-conta.png`: navegação lateral completa, saudação,
  três resumos, pedido recente, bloco azul claro de favoritos e endereço principal.
  Contagens refletem somente o estado real desta etapa, sem exemplos do PDF.
- Cada opção do menu possui rota própria. Pedidos, favoritos e cartões ficam
  vazios; dados pessoais mantêm o formulário existente. Endereços e listas têm
  formulários locais, edição, remoção com confirmação e detalhes de lista.
- O coração do cabeçalho abre uma página independente de **Favoritos**; o ícone
  de usuário abre **Minha Conta**. A opção de favoritos também existe no perfil.
- Produto preserva a divisão entre área de imagem e informação, com estado vazio
  sem fotografia, preço ou medidas inventadas. Checkout preserva as três etapas
  e o resumo lateral, com finalização desabilitada e sem integração de pagamento.
- Administração reproduz os resumos e a tabela vazia, com navegação entre visão
  geral, produtos, promoções e pedidos. É uma prévia visual pública, identificada
  como demonstração; operações administrativas continuam para uma etapa futura.
- Não existem mockups individuais das subseções. Elas usam tipografia, cores,
  bordas, botões e espaçamentos da referência de Minha Conta.
- No celular, navegação da conta em duas colunas e conteúdo abaixo; formulários,
  resumos e etapas empilhados. Botões comuns têm hover azul com texto branco;
  ações de sair têm destaque vermelho suave; desabilitados não recebem hover.

## Composição do banner principal

- Seguir visualmente `01-home.png`: texto à esquerda (aproximadamente 46%) e foto à direita (54%), fundo `#E9F1FA`, título em duas linhas e botões abaixo do texto de apoio.
- Proporção externa aproximada do banner desktop: 3,25:1. A margem do banner é menor que a do restante do conteúdo, como na referência.
- Usar `<img>` com dimensões intrínsecas 1536 × 1024, texto alternativo pertinente, `object-fit: cover` e `object-position: 50% 50%` no desktop. O recorte central corresponde ao enquadramento do PDF, sem distorção.
- No mobile, empilhar texto e fotografia; manter a foto visível, com proporção 4:3 e `object-position: 65% 50%`, preservando o modelo e a camisa. Essa adaptação é necessária porque não há mockup mobile.
- Manter “O básico, sem ser comum.”, “Explorar peças” e “Conheça a FORMA” como conteúdo React real, com os links para catálogo e Sobre Nós.
- Não usar a imagem completa de `01-home.png` como banner nem copiar as legendas ou a moldura de navegador.

## Imagens originais

`referencias/imagens-originais/hero-editorial.png` e `camisa-preta.png` são os arquivos originais usados para compor as fotografias presentes no PDF. A foto editorial está autorizada no banner principal e foi copiada para `src/assets/hero-editorial.png`. A foto da camisa preta continua somente como referência para uma futura etapa de produtos. Conferir a diagramação e os recortes nas telas e no PDF; copiar apenas arquivos efetivamente utilizados para os assets da aplicação.
