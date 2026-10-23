# Imagens do catálogo FORMA

Atualização: **23/10/2026**. A coleção demonstrativa tem **30 produtos distintos**,
com uma imagem individual por peça: a foto preta preexistente e **29 representações
geradas por IA**. Nesta rodada foram criadas **18 imagens novas**, usando a
ferramenta integrada `image_gen` (skill `imagegen`), sem CLI/API alternativa,
hotlinks, logos ou marcas de terceiros. São produtos fictícios de um projeto
acadêmico, não fotografias de estoque físico.

## Origem e tratamento

- Os 12 produtos anteriores, seus IDs, descrições e arquivos foram preservados.
  A foto `camisa-preta.png` mantém a versão WebP usada por `srcSet`; os SVGs
  antigos permanecem disponíveis para snapshots de pedidos anteriores.
- As imagens `demo-2.webp` a `demo-12.webp` são as onze representações IA da rodada
  anterior. `demo-13.webp` a `demo-30.webp` foram geradas individualmente nesta rodada.
- Primeiro foi gerada e inspecionada **Solar Terracota**: cor terracota, disco solar
  marfim e três linhas de relevo, camisa inteira e mangas largas visíveis. Só após
  essa inspeção foi produzida a série restante com enquadramento e iluminação
  consistentes. Todas as 18 novas imagens foram inspecionadas em folhas de contato.
- Os novos arquivos foram convertidos para **WebP, 800 × 800 px, qualidade 85**,
  com metadados removidos por ImageMagick. A conversão não recoloriu tecido,
  redesenhou estampas nem criou variantes a partir de uma mesma imagem.
- Hashes SHA-256 e os prompts exatos dos 18 novos arquivos estão no
  [manifesto](../../scripts/catalog-image-manifest.json). Os 30 arquivos referenciados
  pelo catálogo têm conteúdo distinto; o teste de catálogo verifica essa condição.
- O texto alternativo de cada `demo-N.webp` e a descrição da peça identificam
  o uso de IA. Nenhum SVG ou estado de fallback é apresentado como imagem final.

Os originais da ferramenta permanecem na pasta local de geração. As imagens
finais consumidas pela loja estão em `public/products/`; nenhum produto depende
exclusivamente de um arquivo fora do repositório.

## Correspondência entre produto, cor, estampa e arquivo

| Nº | Produto | Cor | Estampa / acabamento visível | Imagem local |
| --- | --- | --- | --- | --- |
| 01 | Oversized Lavada Preta | preta | Lavada, sem estampa; foto preexistente | [camisa-preta.png](../../public/products/camisa-preta.png) |
| 02 | Oversized Traço Preto | preta | Traço contínuo branco | [demo-2.webp](../../public/products/demo-2.webp) |
| 03 | Oversized Essencial Branca | branca | Lisa, sem estampa | [demo-3.webp](../../public/products/demo-3.webp) |
| 04 | Oversized Horizonte Branco | branca | Horizonte azul | [demo-4.webp](../../public/products/demo-4.webp) |
| 05 | Oversized Essencial Azul | azul | Lisa, sem estampa | [demo-5.webp](../../public/products/demo-5.webp) |
| 06 | Oversized Órbita Azul | azul | Órbitas brancas | [demo-6.webp](../../public/products/demo-6.webp) |
| 07 | Oversized Essencial Areia | areia | Lisa, sem estampa | [demo-7.webp](../../public/products/demo-7.webp) |
| 08 | Oversized Linha Areia | areia | Linhas angulares pretas | [demo-8.webp](../../public/products/demo-8.webp) |
| 09 | Oversized Essencial Verde | verde | Lisa, sem estampa | [demo-9.webp](../../public/products/demo-9.webp) |
| 10 | Oversized Botânica Verde | verde | Folhas em creme | [demo-10.webp](../../public/products/demo-10.webp) |
| 11 | Oversized Essencial Cinza | cinza | Mescla lisa, sem estampa | [demo-11.webp](../../public/products/demo-11.webp) |
| 12 | Oversized Concreto Cinza | cinza | Geometria em cinza-escuro | [demo-12.webp](../../public/products/demo-12.webp) |
| 13 | Oversized Solar Terracota | terracota | Sol marfim e três linhas de relevo | [demo-13.webp](../../public/products/demo-13.webp) |
| 14 | Oversized Lavada Terracota | terracota | Lavagem desbotada suave, sem estampa | [demo-14.webp](../../public/products/demo-14.webp) |
| 15 | Oversized Maré Marinho | marinho | Arcos de ondas azul-claros | [demo-15.webp](../../public/products/demo-15.webp) |
| 16 | Oversized Essencial Marinho | marinho | Lisa, sem estampa | [demo-16.webp](../../public/products/demo-16.webp) |
| 17 | Oversized Relevo Bordô | bordô | Picos de montanha em marfim | [demo-17.webp](../../public/products/demo-17.webp) |
| 18 | Oversized Lavada Bordô | bordô | Lavagem vintage, sem estampa | [demo-18.webp](../../public/products/demo-18.webp) |
| 19 | Oversized Trama Mostarda | mostarda | Trama de fitas em carvão | [demo-19.webp](../../public/products/demo-19.webp) |
| 20 | Oversized Essencial Mostarda | mostarda | Lisa, sem estampa | [demo-20.webp](../../public/products/demo-20.webp) |
| 21 | Oversized Vento Petróleo | petróleo | Faixas curvas de vento em marfim | [demo-21.webp](../../public/products/demo-21.webp) |
| 22 | Oversized Lavada Petróleo | petróleo | Lavagem suave, sem estampa | [demo-22.webp](../../public/products/demo-22.webp) |
| 23 | Oversized Duna Caramelo | caramelo | Dunas e pequeno sol em marrom-escuro | [demo-23.webp](../../public/products/demo-23.webp) |
| 24 | Oversized Essencial Caramelo | caramelo | Lisa, sem estampa | [demo-24.webp](../../public/products/demo-24.webp) |
| 25 | Oversized Eclipse Off-white | off-white | Eclipse em carvão e pontos orbitais | [demo-25.webp](../../public/products/demo-25.webp) |
| 26 | Oversized Lavada Off-white | off-white | Lavagem natural, sem estampa | [demo-26.webp](../../public/products/demo-26.webp) |
| 27 | Oversized Mapa Lavanda | lavanda | Ilha topográfica violeta | [demo-27.webp](../../public/products/demo-27.webp) |
| 28 | Oversized Essencial Lavanda | lavanda | Lisa, sem estampa | [demo-28.webp](../../public/products/demo-28.webp) |
| 29 | Oversized Raiz Verde Menta | menta | Raízes e folhas em verde-escuro | [demo-29.webp](../../public/products/demo-29.webp) |
| 30 | Oversized Lavada Verde Menta | menta | Lavagem suave, sem estampa | [demo-30.webp](../../public/products/demo-30.webp) |

## Prompts reproduzíveis

Para as onze imagens da rodada anterior (02–12), o prompt é o texto abaixo,
substituindo `{subject}` pelo campo correspondente no manifesto:

```text
Use case: product-mockup. Asset type: academic FORMA clothing catalog photo. Primary request: {subject}. Photorealistic ghost mannequin studio front view, whole shirt visible, consistent light neutral pale blue-grey seamless background, diffuse softbox lighting, fine heavyweight cotton texture, dropped shoulders and wide boxy silhouette, ribbed crew neck, natural folds. Square image, shirt centered filling 80 percent of frame, generous margins around sleeves and hem. Only one shirt. No person, no hanger, no props, no text, no branding, no watermark.
```

A amostra 13 tem seu prompt completo no campo `prompt` do manifesto. Para a série
14–30, o texto abaixo foi combinado com o `subject` específico de cada produto;
o resultado exato também foi gravado em `prompt`:

```text
Use case: product-mockup. Asset type: square FORMA academic clothing catalog image. Primary request: {subject}. Photorealistic ghost mannequin studio front view, broad boxy men's oversized silhouette, dropped shoulders, wide short sleeves, ribbed crew neck, natural folds, visible heavyweight cotton grain. Whole shirt visible with generous margins around sleeves and hem, perfectly centered filling 78 percent of square frame. Pale blue-grey seamless background, diffuse softbox lighting, soft grounded shadow. Only one shirt; no person, visible mannequin parts, hanger, props, text, brand logos or watermark. The specified cloth color and print, if present, must be clearly visible. Generate one image.
```

Cada estampa foi solicitada como composição original abstrata, botânica ou
geométrica, sem lettering. Uma geração nova com o mesmo prompt pode produzir
variações; os hashes identificam os arquivos efetivamente usados nesta entrega.

## Preservação e evidências

O seed insere apenas produtos ausentes. A conversão de placeholders legados é
limitada à URL/descrição conhecida **e a produtos sem edição administrativa**
(`admin_version=1`); descrições personalizadas, uploads, preços, promoções,
status e tamanhos editados são preservados. Os arquivos antigos não foram
apagados, evitando quebrar snapshots históricos.

As folhas de contato da amostra e da série estão em `.tmp/catalog30/`.
Capturas da vitrine, detalhe e administração desta rodada ficam em
`.tmp/forma-final-20261023/browser/`, ignoradas pelo Git, para consulta na futura
elaboração do PDF. Nesta rodada não foi criado PDF nem relatório final.
