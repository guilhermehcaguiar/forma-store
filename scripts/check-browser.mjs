// Verificação geral opcional no Chromium instalado, sem dependências adicionais.
// Execute com o Vite ativo: node scripts/check-browser.mjs
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const origin = process.env.FORMA_BROWSER_ORIGIN ?? 'http://127.0.0.1:5187'
const browserEmail = `browser-${crypto.randomUUID()}@example.test`
const output = resolve('.tmp/browser-check')
await mkdir(output, { recursive: true })
const browser = spawn(process.env.FORMA_BROWSER ?? '/usr/bin/brave', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9229', `--user-data-dir=${output}/profile`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const pause = ms => new Promise(done => setTimeout(done, ms))
let socket
const pending = new Map()
let nextId = 0
const errors = []

try {
  let pages
  for (let i = 0; i < 100; i++) {
    try { pages = await (await fetch('http://127.0.0.1:9229/json')).json(); break } catch { await pause(100) }
  }
  assert.ok(pages, 'Não foi possível iniciar o Chromium headless.')
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl)
  await new Promise((done, reject) => { socket.onopen = done; socket.onerror = reject })
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
    const handler = pending.get(message.id)
    if (handler) {
      pending.delete(message.id)
      if (message.error) handler.reject(message.error)
      else handler.resolve(message.result)
    }
  }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails))
    return response.result.value
  }
  const waitFor = async expression => {
    for (let i = 0; i < 100; i++) {
      try { if (await evaluate(`Boolean(${expression})`)) return } catch { /* página carregando */ }
      await pause(100)
    }
    throw new Error(`Tempo esgotado: ${expression}. Estado: ${await evaluate('JSON.stringify({url: location.href, text: document.body.innerText})')}. Exceções: ${JSON.stringify(errors)}`)
  }
  const navigate = async path => {
    await send('Page.navigate', { url: `${origin}${path}` })
    await pause(250)
    await waitFor('document.querySelector("main h1") !== null')
    if (path.startsWith('/minha-conta/')) await waitFor('!document.body.innerText.includes("Carregando seus dados...")')
  }
  const fill = async (id, value) => {
    await waitFor(`document.getElementById(${JSON.stringify(id)})`)
    return evaluate(`(() => {
    const input = document.getElementById(${JSON.stringify(id)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`)
  }
  const submit = id => evaluate(`document.getElementById(${JSON.stringify(id)}).closest('form').requestSubmit()`)
  await send('Runtime.enable')
  await navigate('/login')
  await evaluate('localStorage.clear()')
  await navigate('/minha-conta')
  await waitFor('location.pathname === "/login" && document.getElementById("register-name")')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await navigate('/')
  await waitFor('document.querySelector(".hero__image")?.complete && document.querySelector(".hero__image")?.naturalWidth > 0')
  const visitorShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await writeFile(`${output}/home-visitor-1440.png`, Buffer.from(visitorShot.data, 'base64'))
  await evaluate(`document.querySelector('.hero__actions a[href="/catalogo"]').click()`)
  await waitFor('location.pathname === "/catalogo"')
  await navigate('/')
  await evaluate(`document.querySelector('.hero__actions a[href="/sobre"]').click()`)
  await waitFor('location.pathname === "/sobre"')
  await navigate('/login')
  assert.equal(await evaluate('document.querySelector("input[name=promo]").checked'), false)
  await submit('register-name')
  await waitFor('document.querySelectorAll(".field__error").length === 4')
  await fill('register-name', 'Aluno Navegador')
  await fill('register-email', browserEmail)
  await fill('register-password', 'teste123')
  await fill('register-confirm-password', 'diferente')
  await submit('register-name')
  await waitFor('document.getElementById("register-confirm-password-error")?.textContent.includes("não coincidem")')
  await fill('register-confirm-password', 'teste123')
  await submit('register-name')
  await waitFor('location.pathname === "/minha-conta" && document.querySelector(".account-stats")')
  await navigate('/minha-conta/dados')
  assert.equal(await evaluate('localStorage.getItem("forma:apiToken")?.length > 0'), true)
  assert.equal(await evaluate('Array.from({length: localStorage.length}, (_, i) => localStorage.getItem(localStorage.key(i))).some(value => value?.includes("teste123"))'), false)
  await fill('account-name', 'Nome Atualizado')
  await evaluate('document.querySelector(".account-form input[type=checkbox]").click()')
  await submit('account-name')
  await waitFor('document.querySelector(".form-success") !== null')
  assert.ok(await evaluate('document.querySelector(".header__account-link").textContent.includes("Nome")'))
  await navigate('/minha-conta/dados')
  assert.equal(await evaluate('document.getElementById("account-name").value'), 'Nome Atualizado')
  assert.equal(await evaluate('document.querySelector(".account-form input[type=checkbox]").checked'), true)

  const widths = [1440, 1280, 1024, 901, 768, 390, 320]
  // O coração abre Favoritos; o ícone de usuário continua abrindo Minha Conta.
  await evaluate(`document.querySelector('.header__account a[href="/favoritos"]').click()`)
  await waitFor('location.pathname === "/favoritos"')
  assert.equal(await evaluate('document.querySelector("main h1").textContent'), 'Favoritos')
  assert.equal(await evaluate('document.querySelector(".account-sidebar")'), null)
  await evaluate('document.querySelector(".header__account-link").click()')
  await waitFor('location.pathname === "/minha-conta"')
  await navigate('/minha-conta/enderecos')
  await waitFor('Array.from(document.querySelectorAll("button")).some(b => b.textContent === "Novo endereço")')
  await evaluate('Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Novo endereço").click()')
  for (const [field, value] of Object.entries({ label: 'Casa', recipient: 'Aluno', cep: '50000000', street: 'Rua de teste', number: '120', district: 'Centro', city: 'Recife', state: 'PE' })) await fill('address-' + field, value)
  await submit('address-label')
  await waitFor('document.querySelector(".saved-item")?.textContent.includes("Rua de teste")')
  await navigate('/minha-conta/enderecos')
  await waitFor('document.querySelector(".saved-item")?.textContent.includes("Rua de teste")')
  await evaluate('Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Editar").click()')
  await fill('address-number', '121')
  await submit('address-label')
  await waitFor('document.querySelector(".saved-item")?.textContent.includes("121")')
  await navigate('/minha-conta/listas')
  await waitFor('Array.from(document.querySelectorAll("button")).some(b => b.textContent === "Nova lista")')
  await evaluate('Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Nova lista").click()')
  await fill('list-name', 'Escolhas para a aula')
  await submit('list-name')
  await waitFor('document.querySelector(".saved-item")?.textContent.includes("Escolhas para a aula")')
  await waitFor('Array.from(document.querySelectorAll("button")).some(b => b.textContent === "Renomear")')
  await evaluate('Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Renomear").click()')
  await fill('list-name', 'Escolhas atualizadas')
  await submit('list-name')
  await waitFor('document.querySelector(".saved-item")?.textContent.includes("Escolhas atualizadas")')
  await evaluate('document.querySelector(".saved-item a").click()')
  await waitFor('document.querySelector(".account-content h2")?.textContent === "Escolhas atualizadas"')
  assert.ok(await evaluate('document.body.innerText.includes("Esta lista ainda está vazia")'))
  await navigate('/minha-conta/listas')
  await waitFor('Array.from(document.querySelectorAll("button")).some(b => b.textContent === "Remover")')
  await evaluate('Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Remover").click()')
  await evaluate('Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Confirmar remoção").click()')
  await waitFor('document.querySelector(".saved-item") === null')
  const routes = ['/', '/catalogo', '/carrinho', '/sobre', '/favoritos', '/minha-conta', '/minha-conta/dados', '/minha-conta/pedidos', '/minha-conta/favoritos', '/minha-conta/listas', '/minha-conta/enderecos', '/minha-conta/cartoes', '/minha-conta/listas/inexistente', '/minha-conta/pedidos/inexistente', '/produto', '/checkout', '/administracao', '/administracao/produtos', '/administracao/promocoes', '/administracao/pedidos']
  for (const width of widths) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
    for (const route of routes) {
      await navigate(route)
      const dimensions = await evaluate('({ width: innerWidth, scroll: document.documentElement.scrollWidth, images: document.images.length })')
      assert.ok(dimensions.scroll <= width, `Overflow em ${route} a ${width}px: ${dimensions.scroll}`)
      assert.ok(await evaluate("Array.from(document.querySelectorAll('main img')).every(img => img.alt.length > 0)"), `Imagem sem texto alternativo em ${route}`)
      if (width > 900) {
        assert.ok(await evaluate(`document.querySelector('.nav-menu').getBoundingClientRect().right <= document.querySelector('.header__account').getBoundingClientRect().left`), `Sobreposição da navegação a ${width}px`)
      }
      if (route === '/') {
        await waitFor('document.querySelector(".hero__image")?.complete && document.querySelector(".hero__image")?.naturalWidth > 0')
        const hero = await evaluate(`(() => {
          const image = document.querySelector('.hero__image');
          const style = getComputedStyle(image);
          const media = image.getBoundingClientRect();
          const banner = document.querySelector('.hero').getBoundingClientRect();
          return { alt: image.alt, fit: style.objectFit, imageWidth: media.width, bannerWidth: banner.width };
        })()`)
        assert.ok(hero.alt.length > 0)
        assert.equal(hero.fit, 'cover')
        if (width >= 1024) assert.ok(Math.abs(hero.imageWidth / hero.bannerWidth - 0.54) < 0.01)
      }
      if (width === 1440 || width === 390) {
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
        await writeFile(`${output}/${route.replaceAll('/', '-').slice(1) || 'home'}-${width}.png`, Buffer.from(shot.data, 'base64'))
      }
    }
    if (width <= 900) {
      for (const [path, action, input] of [['enderecos', 'Novo endereço', 'address-label'], ['listas', 'Nova lista', 'list-name']]) {
        await navigate('/minha-conta/' + path)
        await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent === ${JSON.stringify(action)}).click()`)
        await waitFor(`document.getElementById(${JSON.stringify(input)}) !== null`)
        assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `Overflow no formulário de ${path} a ${width}px`)
        if (width === 390) {
          const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
          await writeFile(`${output}/${path}-form-390.png`, Buffer.from(shot.data, 'base64'))
        }
      }
      await evaluate('document.querySelector(".header__toggle").click()')
      assert.equal(await evaluate('document.querySelector(".header__toggle").getAttribute("aria-expanded")'), 'true')
      await evaluate(`document.querySelector('.nav-menu a[href="/catalogo"]').click()`)
      await waitFor('location.pathname === "/catalogo"')
      assert.equal(await evaluate('document.querySelector(".header__toggle").getAttribute("aria-expanded")'), 'false')
    }
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await navigate('/minha-conta')
  await evaluate('document.querySelector(".header__account button:not(:disabled)").click()')
  await waitFor('location.pathname === "/login"')
  assert.equal(await evaluate('localStorage.getItem("forma:apiToken")'), null)
  await navigate('/login')
  await fill('register-name', 'Duplicado')
  await fill('register-email', browserEmail.toUpperCase())
  await fill('register-password', 'teste123')
  await fill('register-confirm-password', 'teste123')
  await submit('register-name')
  await waitFor('document.getElementById("register-email-error")?.textContent.includes("já está cadastrado")')
  await fill('login-email', browserEmail)
  await fill('login-password', 'incorreta')
  await submit('login-email')
  await waitFor('document.querySelector(".form-alert")?.textContent.includes("inválidos")')
  for (const width of widths) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `Overflow no login a ${width}px`)
    if (width === 1440 || width === 390) {
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      await writeFile(`${output}/login-${width}.png`, Buffer.from(shot.data, 'base64'))
    }
  }
  await navigate('/favoritos')
  await waitFor('location.pathname === "/login"')
  await fill('login-email', browserEmail)
  await fill('login-password', 'teste123')
  await submit('login-email')
  await waitFor('location.pathname === "/favoritos"')
  assert.deepEqual(errors, [])
  console.log(`OK: autenticação, sessão, perfil, endereços (criar/editar/recarregar), listas (criar/renomear/abrir/remover), coração abre Favoritos, links do banner, menu mobile e ${routes.length} rotas em ${widths.length} larguras. Catálogo com imagens locais e texto alternativo. Sem overflow, sobreposição no cabeçalho ou exceções JS.`)
  console.log(`Capturas em ${output}`)
  await send('Browser.close')
} finally {
  socket?.close()
  browser.kill()
}
