// Gera os vídeos de avatar da landing com os mesmos modelos do app:
// foto no Nano Banana 2 (9:16) e animação de 5s no Kling, pela fila do fal.
// Salva em public/landing/avatars/<id>.mp4 + <id>.jpg e registra em
// src/landing/avatars.generated.json, que a landing lê pra trocar o vídeo provisório.
//
// Precisa de FAL_KEY (variável de ambiente ou linha FAL_KEY=... no .env.local).
// Uso:
//   npm run landing:avatars                 gera os que faltam
//   npm run landing:avatars -- podcast chef só esses
//   npm run landing:avatars -- --force chef refaz mesmo se já existir
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SPECS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/landing/avatars.json'), 'utf8'))
const MANIFEST = path.join(ROOT, 'src/landing/avatars.generated.json')
const OUT = path.join(ROOT, 'public/landing/avatars')

const QUEUE = 'https://queue.fal.run'
const IMAGE_ENDPOINT = 'fal-ai/nano-banana-2'
const VIDEO_ENDPOINT = 'fal-ai/kling-video/v3/standard/image-to-video'
const POLL_MS = 4000
const TIMEOUT_MS = 15 * 60 * 1000

function readFalKey() {
  if (process.env.FAL_KEY) return process.env.FAL_KEY
  const envFile = path.join(ROOT, '.env.local')
  if (fs.existsSync(envFile)) {
    const line = fs.readFileSync(envFile, 'utf8').split(/\r?\n/).find((row) => row.startsWith('FAL_KEY='))
    const value = line?.slice('FAL_KEY='.length).trim().replace(/^["']|["']$/g, '')
    if (value) return value
  }
  throw new Error('FAL_KEY não encontrada. Crie em fal.ai/dashboard/keys e coloque FAL_KEY=... no .env.local')
}

const KEY = readFalKey()

async function fal(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: { authorization: `Key ${KEY}`, 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`fal ${response.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : {}
}

async function run(endpoint, input, label) {
  const { status_url: statusUrl, response_url: responseUrl } = await fal('POST', `${QUEUE}/${endpoint}`, input)
  const started = Date.now()
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    const { status, error } = await fal('GET', statusUrl)
    if (error) throw new Error(`${label}: ${error}`)
    if (status === 'COMPLETED') return fal('GET', responseUrl)
    if (Date.now() - started > TIMEOUT_MS) throw new Error(`${label}: passou de 15 minutos na fila`)
  }
}

async function download(url, target) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download falhou (${response.status}): ${url}`)
  fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()))
}

/** Pôster leve (540px de largura, jpg) a partir da foto original, que costuma vir em PNG grande. */
async function makePoster(browser, imageUrl, target) {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } })
  await page.setContent(`<body style="margin:0;background:#000"><img src="${imageUrl}" style="width:540px;height:960px;object-fit:cover;display:block"></body>`)
  await page.waitForFunction(() => document.images[0]?.complete && document.images[0].naturalWidth > 0, null, { timeout: 60000 })
  await page.screenshot({ path: target, type: 'jpeg', quality: 80 })
  await page.close()
}

async function generate(browser, spec) {
  console.log(`  ${spec.id}: gerando foto...`)
  const image = await run(IMAGE_ENDPOINT, { prompt: spec.image, num_images: 1, aspect_ratio: '9:16', safety_tolerance: '2' }, `${spec.id} (foto)`)
  const imageUrl = image.images?.[0]?.url
  if (!imageUrl) throw new Error(`${spec.id}: o fal não devolveu imagem`)
  await makePoster(browser, imageUrl, path.join(OUT, `${spec.id}.jpg`))

  console.log(`  ${spec.id}: animando no Kling...`)
  const video = await run(VIDEO_ENDPOINT, { prompt: spec.motion, start_image_url: imageUrl, duration: '5', generate_audio: false }, `${spec.id} (vídeo)`)
  const videoUrl = video.video?.url
  if (!videoUrl) throw new Error(`${spec.id}: o fal não devolveu vídeo`)
  await download(videoUrl, path.join(OUT, `${spec.id}.mp4`))
  console.log(`  ${spec.id}: pronto`)
  return { video: `/landing/avatars/${spec.id}.mp4`, poster: `/landing/avatars/${spec.id}.jpg` }
}

const args = process.argv.slice(2)
const force = args.includes('--force')
const only = args.filter((arg) => arg !== '--force')
const unknown = only.filter((id) => !SPECS.some((spec) => spec.id === id))
if (unknown.length) throw new Error(`Avatar não existe em avatars.json: ${unknown.join(', ')}`)

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
const queue = SPECS.filter((spec) => (only.length === 0 || only.includes(spec.id)) && (force || !manifest[spec.id]))
if (queue.length === 0) {
  console.log('Nada a gerar: todos os avatares já existem (use --force pra refazer).')
  process.exit(0)
}

fs.mkdirSync(OUT, { recursive: true })
console.log(`Gerando ${queue.length} avatar(es): 1 foto + 1 vídeo de 5s no Kling cada.`)
const browser = await chromium.launch()
const results = await Promise.allSettled(queue.map((spec) => generate(browser, spec).then((media) => [spec.id, media])))
await browser.close()

const failures = []
for (const [index, result] of results.entries()) {
  if (result.status === 'fulfilled') {
    const [id, media] = result.value
    manifest[id] = media
  } else {
    failures.push(`${queue[index].id}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`)
  }
}
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`landing: ${results.length - failures.length} avatar(es) prontos em public/landing/avatars`)
if (failures.length) {
  console.error(`Falharam:\n${failures.join('\n')}`)
  process.exit(1)
}
