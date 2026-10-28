// Gera as fotos realistas do modo demo com os mesmos modelos do app, pela fila do fal:
// Nano Banana 2 (4:5) para retratos e cenas, Nano Banana 2 Edição para as cenas dos
// personagens (mesma pessoa do retrato) e Kling 3.0 para o vídeo da Luna.
// Salva em public/demo/photos e registra em src/demo/demoPhotos.generated.json; o demo
// usa a foto quando existe e cai nas ilustrações SVG enquanto não existe.
//
// Precisa de FAL_KEY (variável de ambiente ou linha FAL_KEY=... no .env.local).
// Uso:
//   npm run demo:photos                   gera as que faltam
//   npm run demo:photos -- luna varanda   só essas
//   npm run demo:photos -- --force luna   refaz mesmo se já existir
// Depois: npm run landing:screens para refazer os prints da LP.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SPECS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/demo/demoPhotos.json'), 'utf8'))
const MANIFEST = path.join(ROOT, 'src/demo/demoPhotos.generated.json')
const OUT = path.join(ROOT, 'public/demo/photos')

const QUEUE = 'https://queue.fal.run'
const IMAGE_ENDPOINT = 'fal-ai/nano-banana-2'
const EDIT_ENDPOINT = 'fal-ai/nano-banana-2/edit'
const VIDEO_ENDPOINT = 'fal-ai/kling-video/v3/standard/image-to-video'
const POLL_MS = 4000
const TIMEOUT_MS = 15 * 60 * 1000
const PHOTO_SIZE = { width: 800, height: 1000 }

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

/** Foto leve (800x1000, jpg) a partir da original do fal, que costuma vir em PNG grande. */
async function saveJpg(browser, imageUrl, target) {
  const page = await browser.newPage({ viewport: PHOTO_SIZE })
  await page.setContent(`<body style="margin:0;background:#000"><img src="${imageUrl}" style="width:${PHOTO_SIZE.width}px;height:${PHOTO_SIZE.height}px;object-fit:cover;display:block"></body>`)
  await page.waitForFunction(() => document.images[0]?.complete && document.images[0].naturalWidth > 0, null, { timeout: 60000 })
  await page.screenshot({ path: target, type: 'jpeg', quality: 86 })
  await page.close()
}

const dataUri = (file) => `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`
const photoFile = (id) => path.join(OUT, `${id}.jpg`)

/** A foto do personagem que serve de referência, já salva (gerada antes nesta rodada ou em outra). */
function referenceOf(spec) {
  const file = photoFile(spec.ref)
  if (!fs.existsSync(file)) throw new Error(`${spec.id}: falta a foto de referência "${spec.ref}" (gere ela antes)`)
  return dataUri(file)
}

async function generatePhoto(browser, spec) {
  console.log(`  ${spec.id}: gerando foto...`)
  const prompt = `${spec.prompt} ${SPECS.style}`
  const result = spec.ref
    ? await run(EDIT_ENDPOINT, { prompt, image_urls: [referenceOf(spec)], num_images: 1, aspect_ratio: '4:5' }, spec.id)
    : await run(IMAGE_ENDPOINT, { prompt, num_images: 1, aspect_ratio: '4:5', safety_tolerance: '2' }, spec.id)
  const imageUrl = result.images?.[0]?.url
  if (!imageUrl) throw new Error(`${spec.id}: o fal não devolveu imagem`)
  await saveJpg(browser, imageUrl, photoFile(spec.id))
  return `demo/photos/${spec.id}.jpg`
}

async function generateVideo(spec) {
  console.log(`  ${spec.id}: animando no Kling...`)
  const result = await run(VIDEO_ENDPOINT, { prompt: spec.prompt, start_image_url: referenceOf(spec), duration: '5', generate_audio: false }, spec.id)
  const videoUrl = result.video?.url
  if (!videoUrl) throw new Error(`${spec.id}: o fal não devolveu vídeo`)
  const response = await fetch(videoUrl)
  if (!response.ok) throw new Error(`${spec.id}: download falhou (${response.status})`)
  fs.writeFileSync(path.join(OUT, `${spec.id}.mp4`), Buffer.from(await response.arrayBuffer()))
  return `demo/photos/${spec.id}.mp4`
}

const args = process.argv.slice(2)
const force = args.includes('--force')
const only = args.filter((arg) => arg !== '--force')
const allIds = [...SPECS.photos.map((spec) => spec.id), SPECS.video.id]
const unknown = only.filter((id) => !allIds.includes(id))
if (unknown.length) throw new Error(`Não existe em demoPhotos.json: ${unknown.join(', ')}`)

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
const wanted = (id) => (only.length === 0 || only.includes(id)) && (force || !manifest[id])
const bases = SPECS.photos.filter((spec) => !spec.ref && wanted(spec.id))
const scenes = SPECS.photos.filter((spec) => spec.ref && wanted(spec.id))
const withVideo = wanted(SPECS.video.id)
if (bases.length + scenes.length === 0 && !withVideo) {
  console.log('Nada a gerar: todas as fotos do demo já existem (use --force pra refazer).')
  process.exit(0)
}

fs.mkdirSync(OUT, { recursive: true })
const failures = []
function collect(specs, results) {
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') manifest[specs[index].id] = result.value
    else failures.push(`${specs[index].id}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`)
  }
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
}

console.log(`Gerando ${bases.length + scenes.length} foto(s)${withVideo ? ' e 1 vídeo de 5s no Kling' : ''}.`)
const browser = await chromium.launch()
// Retratos primeiro: as cenas dos personagens e o vídeo usam eles como referência.
collect(bases, await Promise.allSettled(bases.map((spec) => generatePhoto(browser, spec))))
const late = [...scenes, ...(withVideo ? [SPECS.video] : [])]
collect(late, await Promise.allSettled(late.map((spec) => (spec === SPECS.video ? generateVideo(spec) : generatePhoto(browser, spec)))))
await browser.close()

console.log(`demo: ${bases.length + late.length - failures.length} mídia(s) prontas em public/demo/photos`)
if (failures.length) {
  console.error(`Falharam:\n${failures.join('\n')}`)
  process.exit(1)
}
