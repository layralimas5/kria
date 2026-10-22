// Prints reais do app para a landing (`public/landing/app`).
// Roda contra o modo demo: `npx vite --port 5233 --mode demo` e depois `npm run landing:screens`.
// Os dados são os de exemplo do demo (src/demo); nada vem de conta real.
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const BASE = process.env.DEMO_URL ?? 'http://localhost:5233'
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/landing/app')
const QUALITY = 78

/** Área do conteúdo, sem a barra lateral (que tem 256px no desktop). */
const MAIN = { x: 264, y: 40, width: 1176, height: 820 }
/** Barra do prompt do Studio, com o custo em créditos no botão. */
const COMPOSER = { x: 440, y: 400, width: 800, height: 500 }
/** Topo do Studio no modo vídeo: os modelos Kling 3.0 e Veo 3.1 e as criações. */
const VIDEO_MODELS = { x: 264, y: 40, width: 976, height: 610 }
const RESULT_SIZE = { width: 868, height: 560 }

const BRIEFS = {
  ideias: 'Marca de skincare para mulheres de 25 a 35 anos que nunca tiveram rotina de pele.',
  roteiro: 'Reels de 30 segundos mostrando uma rotina de pele de 3 passos antes do café.',
  copy: 'Legenda para lançar um sérum de vitamina C, tom próximo e sem exagero.',
  ugc: 'Cliente contando que voltou a cuidar da pele com o sérum, gravando no carro.',
}

async function navigate(page, route) {
  await page.evaluate((target) => {
    history.pushState({}, '', target)
    dispatchEvent(new PopStateEvent('popstate'))
  }, route)
  await page.waitForTimeout(1200)
}

async function finishOnboarding(page) {
  await page.goto(`${BASE}/inicio`, { waitUntil: 'networkidle' })
  await page.getByText('Utilizar várias ferramentas').click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.waitForURL(/inicio/)
  await page.waitForTimeout(1200)
}

async function generateText(page, tool) {
  await navigate(page, `/assistente/${tool}`)
  await page.getByLabel('Briefing').fill(BRIEFS[tool])
  await page.getByRole('button', { name: 'Gerar' }).click()
  await page.getByText('Escrevendo com o contexto').waitFor({ state: 'detached', timeout: 60000 })
  await page.waitForTimeout(600)
}

/** Recorte do resultado do Vynkio AI, a partir do título que ele escreveu. */
async function resultClip(page) {
  const box = await page.getByRole('heading', { name: /Exemplo do demo/ }).boundingBox()
  if (!box) throw new Error('Resultado do Vynkio AI não apareceu')
  const scrollY = await page.evaluate(() => window.scrollY)
  return { x: 264, y: box.y + scrollY - 24, ...RESULT_SIZE }
}

async function shot(page, name, clip) {
  const file = path.join(OUT, `${name}.jpg`)
  await page.screenshot({ path: file, type: 'jpeg', quality: QUALITY, clip, fullPage: clip !== undefined })
  console.log('ok', path.relative(process.cwd(), file))
}

async function desktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 })
  await finishOnboarding(page)
  await shot(page, 'dashboard')

  await navigate(page, '/estudio?modo=imagem')
  await shot(page, 'imagem', COMPOSER)

  await navigate(page, '/estudio?modo=video')
  await shot(page, 'video', VIDEO_MODELS)

  await navigate(page, '/personas')
  await shot(page, 'personagem', MAIN)

  for (const tool of ['ideias', 'roteiro', 'copy', 'ugc']) {
    await generateText(page, tool)
    await shot(page, tool, await resultClip(page))
  }
  await page.close()
}

async function mobile(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await finishOnboarding(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
  await shot(page, 'dashboard-mobile')
  await page.close()
}

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch()
try {
  await desktop(browser)
  await mobile(browser)
} finally {
  await browser.close()
}
