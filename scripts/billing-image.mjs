// Renderiza o ícone da Vynkio em PNG: favicon do app e imagem do item no
// checkout do Asaas (campo obrigatório). Roda com: npm run billing:image
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SIZE = 180

const html = `<!doctype html><html><body style="margin:0;background:transparent">
<div style="width:${SIZE}px;height:${SIZE}px;border-radius:40px;background:linear-gradient(135deg,#7c3aed,#3b82f6);display:grid;place-items:center">
  <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 6.5 12 19l7-12.5"/><circle cx="12" cy="5.2" r="1.9" fill="#f5b841" stroke="none"/>
  </svg>
</div></body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } })
await page.setContent(html)
const png = await page.locator('div').screenshot({ omitBackground: true })
await browser.close()

fs.writeFileSync(path.join(ROOT, 'public', 'icon.png'), png)
fs.writeFileSync(
  path.join(ROOT, 'supabase', 'functions', '_shared', 'product-image.ts'),
  `// Ícone da Vynkio em base64, exigido pelo checkout do Asaas no item.\n` +
    `// GERADO por 'npm run billing:image'. Não editar.\n` +
    `export const PRODUCT_IMAGE_BASE64 = '${png.toString('base64')}'\n`,
)
console.log(`icon.png e product-image.ts gerados (${png.length} bytes)`)
