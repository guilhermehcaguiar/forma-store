function getStorage() {
  return window.localStorage
}

export function readJSON(key, fallback = null) {
  try {
    const raw = getStorage().getItem(key)

    if (raw === null || raw === undefined) {
      return fallback
    }

    return JSON.parse(raw)
  } catch {
    // Preserva o conteúdo original para recuperação; nunca apaga na leitura.
    return fallback
  }
}

export function writeJSON(key, value) {
  try {
    getStorage().setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeItem(key) {
  try {
    getStorage().removeItem(key)
    return true
  } catch {
    return false
  }
}

// Uma gravação não deve substituir um documento inválido por dados vazios.
export function readJSONForUpdate(key, fallback) {
  try {
    const raw = getStorage().getItem(key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    throw new Error('Não foi possível ler os dados locais. O conteúdo existente foi preservado.')
  }
}
