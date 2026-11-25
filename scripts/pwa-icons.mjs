// Ícones do app instalável (docs/app-e-notificacoes.md): tela de início, maskable do Android,
// ícone do iPhone e o selo monocromático da barra de notificação. Roda com: npm run pwa:icons
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'app')
const mark = fs.readFileSync(path.join(ROOT, 'public', 'logo-mark.svg'), 'utf8')
const NIGHT = 'radial-gradient(120% 90% at 30% 15%,#2a1660,#0b0a1a 70%)'

/** Fundo cheio (o sistema recorta), arte ocupando `scale` do lado. */
const filled = (size, scale) => `<div style="width:${size}px;height:${size}px;background:${NIGHT};display:grid;place-items:center">
  <div style="width:${Math.round(size * scale)}px;transform:translateY(4%)">${mark}</div></div>`

/** Selo da barra do Android: só o alfa conta, então a arte vai branca sobre transparente. */
const badge = (size) => `<div style="width:${size}px;height:${size}px;display:grid;place-items:center">
  <div style="width:${Math.round(size * 0.84)}px;filter:brightness(0) invert(1)">${mark}</div></div>`

const ICONS = [
  { file: 'icon-192.png', size: 192, html: filled(192, 0.66) },
  { file: 'icon-512.png', size: 512, html: filled(512, 0.66) },
  // Maskable: área segura é o círculo de 80%, então a arte encolhe.
  { file: 'icon-maskable-512.png', size: 512, html: filled(512, 0.5) },
  { file: 'apple-touch-icon.png', size: 180, html: filled(180, 0.62) },
  { file: 'badge-96.png', size: 96, html: badge(96) },
]

const browser = await chromium.launch()
for (const icon of ICONS) {
  const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } })
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${icon.html}</body></html>`)
  const png = await page.locator('body > div').screenshot({ omitBackground: true })
  fs.writeFileSync(path.join(OUT, icon.file), png)
  await page.close()
  console.log(`${icon.file} (${png.length} bytes)`)
}
await browser.close()
