// Gera os vídeos ilustrativos dos celulares da landing em public/landing
// (cena animada em 9:16 + pôster jpg). Sem rosto de pessoa real.
// Quando houver vídeos reais gerados no Kria, salvar com o mesmo nome
// (ex.: public/landing/influencer.mp4) e trocar a extensão em src/landing/content.ts.
// Roda com: npm run landing:assets
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'landing')
const WIDTH = 360
const HEIGHT = 640
const DURATION_MS = 6000

const BASE_CSS = `*{margin:0;box-sizing:border-box}html,body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:#000}
.scene{position:absolute;inset:0;overflow:hidden}
.grain{position:absolute;inset:0;opacity:.07;background-image:radial-gradient(#fff 1px,transparent 1px);background-size:3px 3px;mix-blend-mode:overlay}
.vignette{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 40%,transparent 55%,rgba(0,0,0,.55))}`

const SCENES = {
  influencer: `
  <div class="scene" style="background:linear-gradient(170deg,#f6c9a6 0%,#d98a6a 45%,#5b2c2a 100%)">
    <div style="position:absolute;inset:-20%;background:radial-gradient(circle at 75% 18%,rgba(255,240,215,.9),transparent 40%);animation:sun 6s ease-in-out infinite alternate"></div>
    <div id="person" style="position:absolute;inset:0;transform-origin:50% 40%;animation:push 6s ease-in-out forwards">
      <svg viewBox="0 0 360 640" width="360" height="640">
        <rect y="430" width="360" height="210" fill="#3a1c22" opacity=".55"/>
        <path d="M0 470 C90 450 270 450 360 470 L360 640 L0 640 Z" fill="#2a1418" opacity=".7"/>
        <path d="M20 640 C30 530 95 470 180 470 C265 470 330 530 340 640 Z" fill="#c6f432"/>
        <path d="M20 640 C30 530 95 470 180 470 C200 470 220 473 238 480 C170 500 120 560 110 640 Z" fill="#000" opacity=".12"/>
        <rect x="156" y="380" width="48" height="100" rx="22" fill="#c98d6c"/>
        <g style="transform-origin:180px 200px;animation:hair 3s ease-in-out infinite alternate">
          <path d="M96 300 C84 180 134 140 180 140 C226 140 276 180 264 300 C272 400 262 470 236 540 C214 520 146 520 124 540 C98 470 88 400 96 300 Z" fill="#2b1810"/>
          <path d="M180 150 C160 220 156 330 170 470" stroke="#4a2c1d" stroke-width="3" fill="none" opacity=".7"/>
          <path d="M210 160 C230 240 236 360 220 480" stroke="#4a2c1d" stroke-width="3" fill="none" opacity=".5"/>
          <path d="M120 300 C110 380 116 440 134 520" stroke="#140b07" stroke-width="4" fill="none" opacity=".5"/>
        </g>
        <path d="M100 250 C120 180 150 160 180 158" stroke="#ffd9b5" stroke-width="5" fill="none" opacity=".35" stroke-linecap="round"/>
      </svg>
    </div>
    ${bokeh(14, ['#fff3d6', '#ffd2a8'])}
    <div class="vignette"></div><div class="grain"></div>
  </div>
  <style>@keyframes push{from{transform:scale(1.02)}to{transform:scale(1.16) translateY(-10px)}}
  @keyframes hair{from{transform:rotate(-1.5deg)}to{transform:rotate(1.5deg)}}
  @keyframes sun{from{opacity:.55;transform:translateX(0)}to{opacity:1;transform:translateX(-24px)}}</style>`,

  product: `
  <div class="scene" style="background:radial-gradient(120% 80% at 50% 30%,#3a2a5e 0%,#160f2a 60%,#07060d 100%)">
    <div style="position:absolute;left:50%;top:58%;width:420px;height:420px;margin:-210px 0 0 -210px;border-radius:50%;background:conic-gradient(from 0deg,#c6f43255,#7c5cff55,#ff6fb155,#c6f43255);filter:blur(50px);animation:spin 6s linear infinite"></div>
    <div style="position:absolute;left:50%;bottom:120px;width:220px;height:40px;margin-left:-110px;border-radius:50%;background:rgba(0,0,0,.6);filter:blur(10px)"></div>
    <div style="position:absolute;left:50%;bottom:138px;margin-left:-60px;animation:float 3s ease-in-out infinite alternate">
      <svg viewBox="0 0 120 300" width="120" height="300">
        <defs>
          <linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#e9e2ff"/><stop offset=".45" stop-color="#b6a8f0"/><stop offset="1" stop-color="#5b4aa8"/></linearGradient>
          <linearGradient id="cap" x1="0" x2="1"><stop offset="0" stop-color="#2a2a33"/><stop offset=".5" stop-color="#55555f"/><stop offset="1" stop-color="#121218"/></linearGradient>
        </defs>
        <rect x="38" y="10" width="44" height="60" rx="8" fill="url(#cap)"/>
        <rect x="14" y="66" width="92" height="226" rx="26" fill="url(#g)"/>
        <rect x="34" y="150" width="52" height="56" rx="6" fill="#0b0b0f" opacity=".85"/>
        <rect x="42" y="166" width="36" height="5" rx="2" fill="#c6f432"/>
        <rect x="42" y="178" width="26" height="4" rx="2" fill="#fff" opacity=".6"/>
        <rect id="shine" x="-40" y="66" width="26" height="226" fill="#fff" opacity=".45" style="animation:shine 3s ease-in-out infinite"/>
      </svg>
    </div>
    ${bokeh(18, ['#c6f432', '#b6a8f0', '#ff9fd0'])}
    <div class="vignette"></div><div class="grain"></div>
  </div>
  <style>@keyframes spin{to{transform:rotate(360deg)}}
  @keyframes float{from{transform:translateY(6px)}to{transform:translateY(-10px)}}
  @keyframes shine{0%{transform:translateX(0) skewX(-18deg)}60%,100%{transform:translateX(190px) skewX(-18deg)}}</style>`,

  city: `
  <div class="scene" style="background:linear-gradient(180deg,#0b1030 0%,#33195a 55%,#e0567a 100%)">
    <div style="position:absolute;left:50%;top:300px;width:180px;height:180px;margin-left:-90px;border-radius:50%;background:radial-gradient(circle,#ffd29a,#ff7a7a 60%,transparent 70%);animation:sunset 6s ease-in-out forwards"></div>
    <div style="position:absolute;bottom:0;left:0;width:200%;height:300px;animation:pan 6s linear forwards">
      ${skyline('#1a0f33', 300, 0.9)}
    </div>
    <div style="position:absolute;bottom:0;left:0;width:200%;height:240px;animation:pan 6s linear forwards;animation-duration:4s">
      ${skyline('#0a0618', 240, 1)}
    </div>
    ${rain()}
    <div class="vignette"></div><div class="grain"></div>
  </div>
  <style>@keyframes pan{to{transform:translateX(-30%)}}
  @keyframes sunset{to{transform:translateY(60px);opacity:.75}}
  @keyframes drop{to{transform:translateY(700px)}}
  @keyframes blink{50%{opacity:.25}}</style>`,
}

function bokeh(count, colors) {
  return Array.from({ length: count }, (_, i) => {
    const size = 6 + ((i * 37) % 22)
    const left = (i * 53) % WIDTH
    const top = (i * 97) % HEIGHT
    const color = colors[i % colors.length]
    const delay = (i % 5) * 0.4
    return `<span style="position:absolute;left:${left}px;top:${top}px;width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:.5;filter:blur(${size / 4}px);animation:b${i % 3} ${4 + (i % 3)}s ease-in-out ${delay}s infinite alternate"></span>`
  }).join('') + `<style>@keyframes b0{to{transform:translate(12px,-40px);opacity:.15}}@keyframes b1{to{transform:translate(-16px,-24px);opacity:.8}}@keyframes b2{to{transform:translate(8px,30px);opacity:.25}}</style>`
}

function skyline(color, height, windowOpacity) {
  let x = 0
  let shapes = ''
  let i = 0
  while (x < WIDTH * 2) {
    const w = 30 + ((i * 41) % 46)
    const h = height * (0.35 + ((i * 29) % 60) / 100)
    shapes += `<rect x="${x}" y="${height - h}" width="${w}" height="${h}" fill="${color}"/>`
    for (let wy = height - h + 12; wy < height - 10; wy += 16) {
      for (let wx = x + 6; wx < x + w - 8; wx += 12) {
        if ((wx * 7 + wy * 3 + i) % 5 === 0) {
          const neon = (wx + wy) % 3 === 0 ? '#c6f432' : '#ffcf8a'
          shapes += `<rect x="${wx}" y="${wy}" width="5" height="7" fill="${neon}" opacity="${windowOpacity}" style="animation:blink ${2 + (wx % 3)}s step-end infinite"/>`
        }
      }
    }
    x += w + 4
    i += 1
  }
  return `<svg width="${WIDTH * 2}" height="${height}" viewBox="0 0 ${WIDTH * 2} ${height}">${shapes}</svg>`
}

function rain() {
  return Array.from({ length: 40 }, (_, i) => {
    const left = (i * 31) % WIDTH
    const delay = ((i * 13) % 20) / 10
    return `<span style="position:absolute;left:${left}px;top:-60px;width:1px;height:40px;background:linear-gradient(transparent,rgba(255,255,255,.5));transform:rotate(8deg);animation:drop ${1 + (i % 4) * 0.2}s linear ${delay}s infinite"></span>`
  }).join('')
}

async function render(browser, name, body) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    recordVideo: { dir: OUT, size: { width: WIDTH, height: HEIGHT } },
  })
  const page = await context.newPage()
  await page.setContent(`<!doctype html><html><head><style>${BASE_CSS}</style></head><body>${body}</body></html>`)
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 78 })
  await page.waitForTimeout(DURATION_MS)
  const video = page.video()
  await context.close()
  if (!video) throw new Error(`Playwright não gravou o vídeo de ${name}`)
  fs.renameSync(await video.path(), path.join(OUT, `${name}.webm`))
}

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
for (const [name, body] of Object.entries(SCENES)) await render(browser, name, body)
await browser.close()
console.log(`landing: ${Object.keys(SCENES).length} vídeos e pôsteres em public/landing`)
