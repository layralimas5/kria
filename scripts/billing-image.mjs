// Renderiza o ícone da Vynkio em PNG: favicon do app e imagem do item no
// checkout do Asaas (campo obrigatório). Roda com: npm run billing:image
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SIZE = 180

// Mesma arte do LogoMark do app, sobre o fundo noite da marca.
const mark = fs.readFileSync(path.join(ROOT, 'public', 'logo-mark.svg'), 'utf8')
const html = `<!doctype html><html><body style="margin:0;background:transparent">
<div style="width:${SIZE}px;height:${SIZE}px;border-radius:40px;background:radial-gradient(120% 90% at 30% 15%,#2a1660,#0b0a1a 70%);display:grid;place-items:center">
  <div style="width:${Math.round(SIZE * 0.66)}px;transform:translateY(4%)">${mark}</div>
</div></body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } })
await page.setContent(html)
const png = await page.locator('body > div').screenshot({ omitBackground: true })
await browser.close()

fs.writeFileSync(path.join(ROOT, 'public', 'icon.png'), png)
fs.writeFileSync(
  path.join(ROOT, 'supabase', 'functions', '_shared', 'product-image.ts'),
  `// Ícone da Vynkio em base64, exigido pelo checkout do Asaas no item.\n` +
    `// GERADO por 'npm run billing:image'. Não editar.\n` +
    `export const PRODUCT_IMAGE_BASE64 = '${png.toString('base64')}'\n`,
)
console.log(`icon.png e product-image.ts gerados (${png.length} bytes)`)
