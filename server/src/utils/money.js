// Padrão monetário do FORMA: todo valor é armazenado e trafegado em CENTAVOS
// (inteiro), nunca em ponto flutuante. Ex.: R$ 49,90 → 4990.
// Documentado em docs/forma/API_CONTRATOS.md.

export function assertCentavos(value, label = 'valor') {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} deve ser um inteiro de centavos não negativo.`)
  }
}

// Aceita número (49.9) ou texto ("49,90", "R$ 49,90", "49.90") e devolve centavos.
// Aceita no máximo um separador decimal; separador de milhar não é suportado.
export function toCentavos(input, label = 'valor') {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new TypeError(`${label} inválido: ${input}`)
    const centavos = Math.round(input * 100)
    assertCentavos(centavos, label) // rejeita negativos e valores sem exatidão em centavos
    return centavos
  }

  if (typeof input !== 'string') throw new TypeError(`${label} inválido: ${input}`)

  const cleaned = input.replace(/[R$\s]/g, '')
  const match = cleaned.match(/^(\d+)(?:[.,](\d{1,2}))?$/)
  if (!match) throw new TypeError(`${label} inválido: ${input}`)

  const reais = BigInt(match[1])
  const centavos = (match[2] ?? '').padEnd(2, '0')
  const total = reais * 100n + BigInt(centavos === '' ? 0 : centavos)

  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new TypeError(`${label} acima do limite suportado.`)
  return Number(total)
}

// Centavos → texto fixo com duas casas ("4990" → "49.90"), sem passar por float.
export function fromCentavos(centavos) {
  assertCentavos(centavos)
  const reais = Math.trunc(centavos / 100)
  const resto = String(centavos % 100).padStart(2, '0')
  return `${reais}.${resto}`
}

// Somente para exibição/logs; a API continua trafegando centavos.
export function formatBRL(centavos) {
  assertCentavos(centavos)
  // Intl usa espaço não separável (U+00A0); normalizamos para o espaço comum.
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(centavos / 100)
    .replace(/\u00a0/g, ' ')
}
