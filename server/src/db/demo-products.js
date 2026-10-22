// Um produto por cor, conforme o modelo existente; estoque por tamanho.
// IDs e datas fixos permitem repetir o seed sem duplicar ou renovar a coleção.
const collection = [
  ['Lavada Preta', 'preta', false, 11990, null, [4, 8, 6, 2], '2026-08-01', 'camisa-preta.png'],
  ['Traço Preto', 'preta', true, 13990, 10990, [0, 5, 3, 1], '2026-08-08'],
  ['Essencial Branca', 'branca', false, 9990, null, [6, 8, 4, 0], '2026-08-15'],
  ['Horizonte Branco', 'branca', true, 12990, 9990, [2, 0, 6, 4], '2026-08-22'],
  ['Essencial Azul', 'azul', false, 10990, null, [3, 6, 4, 2], '2026-09-01'],
  ['Órbita Azul', 'azul', true, 14990, null, [0, 2, 5, 3], '2026-09-07'],
  ['Essencial Areia', 'areia', false, 9990, 7990, [5, 3, 0, 2], '2026-09-14'],
  ['Linha Areia', 'areia', true, 13990, null, [2, 4, 6, 1], '2026-09-21'],
  ['Essencial Verde', 'verde', false, 10990, null, [3, 0, 4, 2], '2026-10-01'],
  ['Botânica Verde', 'verde', true, 15990, 12990, [1, 4, 3, 0], '2026-10-05'],
  ['Essencial Cinza', 'cinza', false, 9990, null, [4, 6, 2, 1], '2026-10-10'],
  ['Concreto Cinza', 'cinza', true, 14990, null, [0, 0, 0, 0], '2026-10-15'],
]

export const demoProducts = collection.map(([name, color, printed, price, promo, stock, date, photo], index) => ({
  id: `f04a0000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  name: `Oversized ${name}`,
  description: `Camisa oversized masculina em algodão, com ombros deslocados, gola canelada e caimento amplo. Cor ${color}; ${printed ? 'estampa gráfica da coleção FORMA' : 'acabamento liso, sem estampa'}. Produto de demonstração acadêmica.${photo ? '' : ' Imagem criada por IA para representar esta peça demonstrativa.'}`,
  color,
  isPrinted: printed,
  priceCentavos: price,
  promoPriceCentavos: promo,
  sizes: ['P', 'M', 'G', 'GG'].map((size, i) => ({ size, stock: stock[i] })),
  createdAt: `${date}T12:00:00.000Z`,
  imageUrl: `/products/${photo ?? `demo-${index + 1}.webp`}`,
}))
