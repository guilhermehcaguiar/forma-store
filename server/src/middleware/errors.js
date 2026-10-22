import { HttpError } from '../utils/httpError.js'

// Erros de conexão/autenticação com o banco são operacionais (503), não bugs.
const PG_CONNECTION_CODES = new Set([
  'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET',
  '08000', '08001', '08003', '08006', '57P03', // classes de conexão do PostgreSQL
  '28P01', '28P00', '3D000', '42501',          // senha/usuário/banco/permissão incorretos
])

const PG_CONSTRAINT_CODES = new Set([
  '23000', '23001', '23502', '23503', '23514',
])

function isPgConnectionError(error) {
  return PG_CONNECTION_CODES.has(error?.code) ||
    /connection terminated|database system is starting/i.test(error?.message ?? '')
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'rota_nao_encontrada',
      message: 'Rota não encontrada.',
    },
  })
}

// eslint-disable-next-line no-unused-vars -- assinatura de erro do Express exige 4 parâmetros
export function errorHandler(error, _req, res, _next) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
      },
    })
  }

  // Corpo JSON inválido ou grande demais (express.json).
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'json_invalido', message: 'O corpo da requisição não é um JSON válido.' },
    })
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'corpo_muito_grande', message: 'O corpo da requisição excede o limite permitido.' },
    })
  }

  // Violação de unicidade vinda do PostgreSQL (ex.: e-mail ou nome de lista).
  if (error?.code === '23505') {
    return res.status(409).json({
      error: { code: 'conflito', message: 'Registro duplicado.' },
    })
  }
  if (PG_CONSTRAINT_CODES.has(error?.code)) {
    return res.status(400).json({
      error: { code: 'dados_invalidos', message: 'Os dados violam uma regra de integridade.' },
    })
  }
  if (isPgConnectionError(error)) {
    return res.status(503).json({
      error: {
        code: 'banco_indisponivel',
        message: 'Banco de dados indisponível. Verifique se o PostgreSQL local está em execução.',
      },
    })
  }

  // Erros de SDK/SQL podem carregar requisições e credenciais no objeto/stack.
  console.error('[forma-api] erro interno não tratado (detalhes omitidos).')
  return res.status(500).json({
    error: { code: 'erro_interno', message: 'Erro interno inesperado. Tente novamente.' },
  })
}
