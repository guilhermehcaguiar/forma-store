# Imagens do catálogo — 22/10/2026

As onze peças que usavam SVG agora têm imagens individuais geradas pela ferramenta
integrada `image_gen`, conforme a skill imagegen. São representações criadas por IA
de produtos fictícios de um projeto acadêmico, não fotografias de estoque físico.
Nenhuma imagem de terceiros foi baixada nem houve uso de hotlinks. A camisa preta
e o hero preexistentes foram preservados, com versões WebP do mesmo conteúdo.

Arquivos finais: `public/products/demo-2.webp` a `demo-12.webp`,
`public/products/camisa-preta.webp` e `src/assets/hero-editorial.webp`.
As onze imagens geradas têm 800 × 800 px, WebP qualidade 85, metadados removidos;
o hero tem até 1600 px. A conversão foi feita com ImageMagick, sem recolorir,
repetir ou alterar estampas. Revisão visual em folha de contato, vitrine,
detalhe, carrinho e administração; `object-fit: contain` preserva manga e barra.
As imagens são lazy, exceto a principal do detalhe. A primeira peça mantém o
PNG como fallback e usa a versão WebP por `srcSet`.

O texto alternativo e a descrição identificam as representações por IA. Os SVG
antigos permanecem disponíveis porque podem constar em snapshots de pedidos.
O seed troca somente a URL SVG exata conhecida, com cor/estampa correspondentes;
preserva uploads, descrições personalizadas e demais alterações administrativas.

## Prompts utilizados

Um chamado integrado por peça. O prompt exato é a concatenação abaixo,
substituindo `{subject}` pelo campo `subject` de
[`scripts/catalog-image-manifest.json`](../../scripts/catalog-image-manifest.json).
O manifesto relaciona cada subject ao produto e ao arquivo final.

```text
Use case: product-mockup. Asset type: academic FORMA clothing catalog photo. Primary request: {subject}. Photorealistic ghost mannequin studio front view, whole shirt visible, consistent light neutral pale blue-grey seamless background, diffuse softbox lighting, fine heavyweight cotton texture, dropped shoulders and wide boxy silhouette, ribbed crew neck, natural folds. Square image, shirt centered filling 80 percent of frame, generous margins around sleeves and hem. Only one shirt. No person, no hanger, no props, no text, no branding, no watermark.
```

| Arquivo | Peça e elementos |
|---|---|
| demo-2.webp | Traço Preto: preta com traço contínuo branco |
| demo-3.webp | Essencial Branca: branca lisa |
| demo-4.webp | Horizonte Branco: branca com horizonte azul |
| demo-5.webp | Essencial Azul: azul lisa |
| demo-6.webp | Órbita Azul: azul com órbitas brancas |
| demo-7.webp | Essencial Areia: bege lisa |
| demo-8.webp | Linha Areia: bege com linhas angulares pretas |
| demo-9.webp | Essencial Verde: verde oliva lisa |
| demo-10.webp | Botânica Verde: verde oliva com folhas creme |
| demo-11.webp | Essencial Cinza: cinza mescla lisa |
| demo-12.webp | Concreto Cinza: cinza com geometria de concreto |
