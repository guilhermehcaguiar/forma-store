import {
  PASSWORD_MIN_LENGTH,
  assertValid,
  boolean,
  bodyObject,
  isEmail,
  normalizeEmail,
  str,
} from '../../utils/validate.js'

const NAME_MAX_LENGTH = 120

export function parseRegister(body) {
  const data = bodyObject(body)
  const errors = {}

  const name = str(data.name)
  const email = normalizeEmail(data.email)
  const password = typeof data.password === 'string' ? data.password : ''
  const promo = boolean(data.promo)

  if (!name) errors.name = 'Informe seu nome.'
  else if (name.length > NAME_MAX_LENGTH) errors.name = `O nome deve ter até ${NAME_MAX_LENGTH} caracteres.`

  if (!email) errors.email = 'Informe o e-mail.'
  else if (!isEmail(email)) errors.email = 'Informe um e-mail válido.'

  if (!password) errors.password = 'Crie uma senha.'
  else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
  }

  assertValid(errors)
  return { name, email, password, promo }
}

export function parseLogin(body) {
  const data = bodyObject(body)
  const errors = {}

  const email = normalizeEmail(data.email)
  const password = typeof data.password === 'string' ? data.password : ''

  if (!email) errors.email = 'Informe o e-mail.'
  else if (!isEmail(email)) errors.email = 'Informe um e-mail válido.'

  if (!password) errors.password = 'Informe a senha.'

  assertValid(errors)
  return { email, password }
}

export function parseProfile(body) {
  const data = bodyObject(body)
  const errors = {}

  const name = str(data.name)
  const promo = boolean(data.promo)

  if (!name) errors.name = 'Informe seu nome.'
  else if (name.length > NAME_MAX_LENGTH) errors.name = `O nome deve ter até ${NAME_MAX_LENGTH} caracteres.`

  assertValid(errors)
  return { name, promo }
}
