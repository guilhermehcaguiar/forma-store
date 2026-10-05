export const PASSWORD_MIN_LENGTH = 6

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value ?? '').trim())
}

export function validateLogin({ email, password }) {
  const errors = {}

  if (!email.trim()) {
    errors.email = 'Informe o e-mail.'
  } else if (!isValidEmail(email)) {
    errors.email = 'Informe um e-mail válido.'
  }

  if (!password) {
    errors.password = 'Informe a senha.'
  }

  return errors
}

export function validateRegister({ name, email, password, confirmPassword }) {
  const errors = {}

  if (!name.trim()) {
    errors.name = 'Informe seu nome.'
  }

  if (!email.trim()) {
    errors.email = 'Informe o e-mail.'
  } else if (!isValidEmail(email)) {
    errors.email = 'Informe um e-mail válido.'
  }

  if (!password) {
    errors.password = 'Crie uma senha.'
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirme a senha.'
  } else if (password && confirmPassword !== password) {
    errors.confirmPassword = 'As senhas não coincidem.'
  }

  return errors
}
