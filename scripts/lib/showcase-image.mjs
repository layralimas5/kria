// Tamanho e recorte das fotos da landing, usados pela geração no fal e pela importação manual.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const SPECS_FILE = path.join(ROOT, 'src/landing/showcase.json')
export const MANIFEST = path.join(ROOT, 'src/landing/showcase.generated.json')
export const OUT = path.join(ROOT, 'public/landing/showcase')

// Receita contra a cara de IA. Fica fora do showcase.json porque a galeria mostra o prompt ao visitante.
const PEOPLE =
  ' Aparência de pessoa comum, não de modelo: rosto levemente assimétrico, pele com poros, pequenas manchas e' +
  ' marcas de expressão, fios de cabelo soltos e fora do lugar, corpo de proporção normal.'
const REAL =
  ' Precisa parecer uma foto real tirada por uma pessoa, não uma imagem gerada: luz natural do próprio lugar,' +
  ' sem brilho dourado contornando o cabelo, sem pele lisa de retoque, sem cores saturadas, sem efeito HDR,' +
  ' exposição um pouco imperfeita, leve ruído de câmera e foco natural.' +
  " Sem texto, sem letreiro legível, sem logotipo, sem marca d'água e sem moldura."

/** Prompt completo que vai para o modelo: a cena do showcase.json mais a receita de foto real. */
export function promptFor(spec) {
  return `${spec.prompt}${spec.people ? PEOPLE : ''}${REAL}`
}

/** Paisagem larga ocupa a tela inteira; o resto aparece em coluna ou card. */
const WIDE_WIDTH = 1600
const DEFAULT_WIDTH = 900

export function sizeFor(aspect) {
  const [w, h] = aspect.split(':').map(Number)
  const width = w / h >= 1.5 ? WIDE_WIDTH : DEFAULT_WIDTH
  return { width, height: Math.round((width * h) / w) }
}

/** Maior recorte central na proporção pedida que cabe na foto original, sem ampliar. */
export function sourceCropSize(aspect, natural) {
  const [w, h] = aspect.split(':').map(Number)
  const width = Math.min(natural.width, Math.floor((natural.height * w) / h))
  return { width, height: Math.round((width * h) / w) }
}

/** Lê largura e altura originais da foto. */
export async function naturalSize(browser, imageUrl) {
  const page = await browser.newPage()
  await page.setContent(`<img src="${imageUrl}">`)
  await page.waitForFunction(() => document.images[0]?.complete && document.images[0].naturalWidth > 0, null, { timeout: 60000 })
  const size = await page.evaluate(() => ({ width: document.images[0].naturalWidth, height: document.images[0].naturalHeight }))
  await page.close()
  return size
}

// Máscara de nitidez leve: devolve o contraste fino que a redução e o jpg tiram.
const SHARPEN_FILTER =
  '<svg width="0" height="0" style="position:absolute"><filter id="sharpen" color-interpolation-filters="sRGB">' +
  '<feConvolveMatrix order="3" preserveAlpha="true" kernelMatrix="0 -0.16 0 -0.16 1.64 -0.16 0 -0.16 0"/></filter></svg>'

/** Recorta no centro para a proporção da landing, aplica nitidez leve e salva em jpg de alta qualidade. */
export async function saveJpeg(browser, imageUrl, target, { width, height }) {
  const page = await browser.newPage({ viewport: { width, height } })
  await page.setContent(
    `<body style="margin:0;background:#000">${SHARPEN_FILTER}<img src="${imageUrl}" style="width:${width}px;height:${height}px;object-fit:cover;display:block;filter:url(#sharpen)"></body>`,
  )
  await page.waitForFunction(() => document.images[0]?.complete && document.images[0].naturalWidth > 0, null, { timeout: 60000 })
  await page.screenshot({ path: target, type: 'jpeg', quality: 90 })
  await page.close()
}
