import { assertValid, bodyObject, str } from '../../utils/validate.js'

// Mesmas regras do front (src/services/account.js): obrigatórios, CEP de 8
// dígitos e UF válida. "complement" é opcional e gravado como texto vazio.
const REQUIRED_FIELDS = ['label', 'recipient', 'street', 'number', 'district', 'city', 'state', 'cep']

const STATES = new Set(
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '),
)

export function parseAddress(body) {
  const data = bodyObject(body)
  const errors = {}

  const values = {
    label: str(data.label),
    recipient: str(data.recipient),
    street: str(data.street),
    number: str(data.number),
    complement: str(data.complement),
    district: str(data.district),
    city: str(data.city),
    state: str(data.state).toUpperCase(),
    cep: str(data.cep).replace(/\D/g, ''),
  }

  for (const field of REQUIRED_FIELDS) {
    if (!values[field]) errors[field] = 'Campo obrigatório.'
  }
  for (const field of [...REQUIRED_FIELDS, 'complement']) {
    if (data[field] != null && typeof data[field] !== 'string') errors[field] = 'Informe um texto válido.'
    else if (values[field].length > 500) errors[field] = 'Use até 500 caracteres.'
  }

  if (values.state && !STATES.has(values.state)) {
    errors.state = 'Informe uma UF válida, como SP ou PE.'
  }
  if (values.cep && !/^\d{8}$/.test(values.cep)) {
    errors.cep = 'Informe um CEP com 8 dígitos.'
  }

  assertValid(errors)
  return values
}
