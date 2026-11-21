// Capa do checkout dos planos (1200x480, a proporção 5:2 do topo de /assinar/:plan): a marca do Vynkio
// com fotos reais geradas na plataforma (as mesmas da landing). Gera public/checkout/vynkio-capa.jpg.
//   npm run checkout:cover
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(import.meta.dirname, '..')
const url = (...parts) => pathToFileURL(path.join(ROOT, ...parts)).href
const font = (pkg, file) => url('node_modules/@fontsource-variable', pkg, 'files', file)
const photo = (name) => url('public/landing/showcase', name)

const PHOTOS = ['marina-cafe.jpg', 'g-perfume.jpg', 'g-brigadeiro.jpg', 'marina-praia.jpg', 'g-tenis.jpg', 'g-podcast.jpg']

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Space Grotesk'; src: url(${font('space-grotesk', 'space-grotesk-latin-wght-normal.woff2')}); font-weight: 300 700; }
@font-face { font-family: 'Geist'; src: url(${font('geist', 'geist-latin-wght-normal.woff2')}); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 480px; overflow: hidden; background: #0b0a1a; color: #fafafa; font-family: 'Geist', sans-serif; position: relative; }
.glow { position: absolute; border-radius: 9999px; filter: blur(120px); }
.text { position: absolute; left: 72px; top: 0; bottom: 0; width: 560px; display: flex; flex-direction: column; justify-content: center; }
.brand { display: flex; align-items: center; gap: 12px; }
.brand img { height: 34px; }
.brand span { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 32px; letter-spacing: -0.045em; }
h1 { margin-top: 26px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 52px; line-height: 1.02; letter-spacing: -0.045em; }
h1 span { display: block; background: linear-gradient(90deg, #a78bfa, #c4b5fd, #3b82f6); -webkit-background-clip: text; color: transparent; }
p { margin-top: 18px; font-size: 19px; color: #a1a1aa; }
.grid { position: absolute; right: -30px; top: -40px; display: grid; grid-template-columns: repeat(3, 170px); gap: 14px; transform: rotate(-8deg); }
.grid img { width: 170px; height: 230px; object-fit: cover; border-radius: 18px; border: 1px solid #ffffff1f; box-shadow: 0 20px 40px #00000080; }
.grid img:nth-child(3n + 2) { margin-top: 40px; }
.fade { position: absolute; inset: 0 auto 0 0; width: 720px; background: linear-gradient(90deg, #0b0a1a 70%, transparent); }
</style></head><body>
<div class="grid">${PHOTOS.map((name) => `<img src="${photo(name)}" alt="">`).join('')}</div>
<div class="fade"></div>
<div class="glow" style="width:640px;height:420px;left:-160px;top:-240px;background:#7c3aed55"></div>
<div class="glow" style="width:420px;height:320px;left:300px;bottom:-240px;background:#3b82f633"></div>
<div class="text">
  <div class="brand"><img src="${url('public/logo-mark.svg')}" alt=""><span>vynkio</span></div>
  <h1>Tudo para criar com IA.<span>Em um só lugar.</span></h1>
  <p>Fotos, vídeos e conteúdo com os seus personagens.</p>
</div>
</body></html>`

const out = path.join(ROOT, 'public/checkout/vynkio-capa.jpg')
mkdirSync(path.dirname(out), { recursive: true })
// Arquivo local, não setContent: em about:blank o navegador recusa fontes e imagens file://.
const tmp = mkdtempSync(path.join(tmpdir(), 'vynkio-capa-'))
const htmlFile = path.join(tmp, 'capa.html')
writeFileSync(htmlFile, HTML)
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 480 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(htmlFile).href)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState('load')
  await page.screenshot({ path: out, type: 'jpeg', quality: 86 })
  console.log(`capa: ${out}`)
} finally {
  await browser.close()
  rmSync(tmp, { recursive: true, force: true })
}
