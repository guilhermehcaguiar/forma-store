import { BlockList, isIP } from 'node:net'

const privateAddresses = new BlockList()
for (const [address, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.168.0.0',16],['192.0.2.0',24],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]]) privateAddresses.addSubnet(address,prefix,'ipv4')
for (const [address, prefix] of [['::',128],['::1',128],['fc00::',7],['fe80::',10],['ff00::',8],['2001:db8::',32]]) privateAddresses.addSubnet(address,prefix,'ipv6')

function publicCallbackHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '')
  const version = isIP(host)
  if (version) return !privateAddresses.check(host,version === 4 ? 'ipv4' : 'ipv6')
  return hostname.includes('.') && !/(?:^|\.)(?:localhost|local|invalid)$/.test(hostname)
}

// Exemplos são deliberadamente não utilizáveis: não habilitam integrações.
export function isConfiguredCredential(value) {
  return typeof value === 'string' && Boolean(value.trim()) && !/fictici|placeholder|troque|change.?me|example\.invalid/i.test(value)
}

export function mercadoPagoPublicKey(key = process.env.MERCADOPAGO_PUBLIC_KEY ?? '') {
  // Public Keys são prefixo + UUID. Access Tokens não podem passar por esta saída.
  return /^(?:TEST|APP_USR)-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key) ? key : null
}

export function safeHttpUrl(value, { externalHttps = false } = {}) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null
    if (externalHttps && (url.protocol !== 'https:' || !publicCallbackHost(url.hostname))) return null
    return url
  } catch { return null }
}
