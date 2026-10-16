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

  const name = typeof data.name === 'string' ? data.name.trim() : ''
  const promo = boolean(data.promo)

  if (!name) errors.name = 'Informe seu nome.'
  else if (name.length > NAME_MAX_LENGTH) errors.name = `O nome deve ter até ${NAME_MAX_LENGTH} caracteres.`

  if (data.promo !== undefined && ![true, false, 'true', 'false'].includes(data.promo)) errors.promo = 'Informe uma preferência válida.'
  if (['email', 'password', 'newPassword'].some(key => key in data)) errors.credentials = 'Use a operação de alteração de e-mail ou senha com sua senha atual.'
  assertValid(errors)
  return { name, promo }
}

function currentPassword(data, errors) {
  const password = typeof data.currentPassword === 'string' ? data.currentPassword : ''
  if (!password || password.length > 1024) errors.currentPassword = 'Informe sua senha atual (até 1024 caracteres).'
  return password
}

export function parseEmailChange(body) {
  const data = bodyObject(body), errors = {}
  const email = typeof data.email === 'string' ? normalizeEmail(data.email) : ''
  if (!isEmail(email) || email.length > 254) errors.email = 'Informe um e-mail válido com até 254 caracteres.'
  const password = currentPassword(data, errors)
  assertValid(errors)
  return { email, currentPassword: password }
}

export function parsePasswordChange(body) {
  const data = bodyObject(body), errors = {}
  const password = currentPassword(data, errors)
  const newPassword = typeof data.newPassword === 'string' ? data.newPassword : ''
  if (newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > 128) errors.newPassword = `Use uma nova senha entre ${PASSWORD_MIN_LENGTH} e 128 caracteres.`
  else if (newPassword === password) errors.newPassword = 'A nova senha deve ser diferente da atual.'
  if (data.confirmPassword !== newPassword) errors.confirmPassword = 'As senhas não coincidem.'
  assertValid(errors)
  return { currentPassword: password, newPassword }
}
