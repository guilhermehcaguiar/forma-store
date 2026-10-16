import { api } from './api.js'

export const listAdminProducts = async () => (await api.get('/admin/produtos')).products
export const getAdminProduct = async id => (await api.get(`/admin/produtos/${id}`)).product
export async function saveAdminProduct(id, form) {
  return (await (id ? api.put(`/admin/produtos/${id}`, form) : api.post('/admin/produtos', form))).product
}
export function reaisToCentavos(value) {
  const match = String(value).trim().match(/^(\d+)(?:[.,](\d{1,2}))?$/)
  if (!match) throw new Error('Informe os preços em reais, com até duas casas decimais e sem separador de milhar.')
  const amount = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 2147483647) throw new Error('Informe um preço positivo dentro do limite suportado.')
  return amount
}
