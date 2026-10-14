import { assertValid, bodyObject, str } from '../../utils/validate.js'

const NAME_MAX_LENGTH = 80

// Mesma regra do front (src/services/account.js): nome obrigatório, até 80
// caracteres e único por conta (índice lists_user_name_unique_idx).
export function parseList(body) {
  const data = bodyObject(body)
  const errors = {}

  const name = str(data.name)

  if (!name) errors.name = 'Informe um nome para a lista.'
  else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `Informe um nome de até ${NAME_MAX_LENGTH} caracteres para a lista.`
  }

  assertValid(errors)
  return { name }
}
