// Tamanho e recorte das fotos da landing, usados pela geração no fal e pela importação manual.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const SPECS_FILE = path.join(ROOT, 'src/landing/showcase.json')
export const MANIFEST = path.join(ROOT, 'src/landing/showcase.generated.json')
export const OUT = path.join(ROOT, 'public/landing/showcase')

/** Paisagem larga ocupa a tela inteira; o resto aparece em coluna ou card. */
const WIDE_WIDTH = 1600
const DEFAULT_WIDTH = 900

export function sizeFor(aspect) {
  const [w, h] = aspect.split(':').map(Number)
  const width = w / h >= 1.5 ? WIDE_WIDTH : DEFAULT_WIDTH
  return { width, height: Math.round((width * h) / w) }
}

/** Recorta no centro para a proporção da landing e salva um jpg leve. */
export async function saveJpeg(browser, imageUrl, target, { width, height }) {
  const page = await browser.newPage({ viewport: { width, height } })
  await page.setContent(`<body style="margin:0;background:#000"><img src="${imageUrl}" style="width:${width}px;height:${height}px;object-fit:cover;display:block"></body>`)
  await page.waitForFunction(() => document.images[0]?.complete && document.images[0].naturalWidth > 0, null, { timeout: 60000 })
  await page.screenshot({ path: target, type: 'jpeg', quality: 82 })
  await page.close()
}
