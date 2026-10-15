// Erro de aplicação com status HTTP e código legível por máquina.
// O formato de resposta é padronizado em middleware/errors.js.
export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export const badRequest = (code, message, fields) => new HttpError(400, code, message, fields)
export const validationError = (fields) => badRequest('validacao', 'Verifique os campos informados.', fields)
export const unauthorized = (code, message) => new HttpError(401, code, message)
export const forbidden = (code, message) => new HttpError(403, code, message)
export const notFound = (message = 'Recurso não encontrado.') => new HttpError(404, 'nao_encontrado', message)
export const conflict = (code, message) => new HttpError(409, code, message)
