// Gera as mídias ilustrativas do modo demo em public/demo: retratos em SVG
// (silhueta estilizada, nunca rosto de pessoa real) e um vídeo curto em webm.
// Roda com: npm run demo:assets
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'demo')
fs.mkdirSync(OUT, { recursive: true })

const PALETTES = [
  { sky: ['#f4c7a1', '#8a5a44'], skin: '#e8b996', hair: '#3b2418', shirt: '#c6f432' },
  { sky: ['#f2a7c3', '#5b2a4a'], skin: '#d79f7e', hair: '#1f1512', shirt: '#f7f1e8' },
  { sky: ['#9fd8cf', '#1f4e5a'], skin: '#c58c69', hair: '#2a1d16', shirt: '#24324a' },
  { sky: ['#e9d79a', '#5c5328'], skin: '#f0c7a7', hair: '#b4773f', shirt: '#8c3b2f' },
  { sky: ['#b9b4f2', '#2c2a5e'], skin: '#a86f50', hair: '#120c0a', shirt: '#e86f4c' },
  { sky: ['#a7d3f2', '#24456b'], skin: '#e3ad8b', hair: '#5a3220', shirt: '#f2f2f2' },
  { sky: ['#f5b8a0', '#7a3622'], skin: '#8d5a3d', hair: '#0f0a08', shirt: '#2f6f4f' },
  { sky: ['#cfe8a9', '#3f5a24'], skin: '#efc29f', hair: '#7a4a2a', shirt: '#3b3b46' },
]

function portrait({ sky, skin, hair, shirt }, longHair) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
    <radialGradient id="glow" cx="0.7" cy="0.2" r="0.6"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#sky)"/>
  <rect width="800" height="1000" fill="url(#glow)"/>
  ${longHair ? `<path d="M235 420 C220 250 300 160 400 160 C500 160 580 250 565 420 L590 760 L210 760 Z" fill="${hair}"/>` : ''}
  <path d="M120 1000 C130 820 250 740 400 740 C550 740 670 820 680 1000 Z" fill="${shirt}"/>
  <rect x="352" y="600" width="96" height="160" rx="40" fill="${skin}"/>
  <ellipse cx="400" cy="440" rx="150" ry="185" fill="${skin}"/>
  <ellipse cx="400" cy="440" rx="150" ry="185" fill="url(#shade)"/>
  <path d="M250 420 C245 300 315 238 400 238 C485 238 555 300 550 420 C520 330 470 300 400 300 C330 300 280 330 250 420 Z" fill="${hair}"/>
  <rect y="0" width="800" height="1000" fill="#000" opacity=".06"/>
</svg>`
}

PALETTES.forEach((palette, index) => {
  fs.writeFileSync(path.join(OUT, `img-${index + 1}.svg`), portrait(palette, index % 2 === 0))
})

// Vídeo: zoom lento com respiro de luz sobre o primeiro retrato, 4 segundos.
const svg = portrait(PALETTES[0], true)
const html = `<!doctype html><html><body style="margin:0;overflow:hidden;background:#000">
<div id="s" style="width:400px;height:500px;transform-origin:50% 45%;animation:z 4s ease-in-out forwards">${svg.replace('width="800" height="1000"', 'width="400" height="500"')}</div>
<div style="position:fixed;inset:0;background:radial-gradient(circle at 70% 20%,rgba(255,255,255,.35),transparent 60%);animation:l 2s ease-in-out infinite alternate"></div>
<style>@keyframes z{from{transform:scale(1)}to{transform:scale(1.12) translateY(-8px)}}@keyframes l{from{opacity:.2}to{opacity:1}}</style>
</body></html>`

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 400, height: 500 },
  recordVideo: { dir: OUT, size: { width: 400, height: 500 } },
})
const page = await context.newPage()
// Navega direto para o HTML (fundo escuro desde o 1º quadro, sem o branco do about:blank).
await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
await page.waitForTimeout(4200)
const video = page.video()
await context.close()
await browser.close()
const recorded = await video.path()
fs.renameSync(recorded, path.join(OUT, 'video-1.webm'))
console.log(`demo: ${PALETTES.length} retratos e video-1.webm em public/demo`)
