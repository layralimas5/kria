// Gera as fotos realistas da landing com os mesmos modelos do app: Nano Banana 2 para foto
// do zero e Nano Banana 2 Edição quando a imagem tem `ref` (mesmo personagem, mesma sala).
// Salva em public/landing/showcase/<id>.jpg e registra em src/landing/showcase.generated.json,
// que a landing lê pra trocar o espaço reservado pela foto.
//
// Precisa de FAL_KEY (variável de ambiente ou linha FAL_KEY=... no .env.local).
// Uso:
//   npm run landing:showcase                   gera as que faltam
//   npm run landing:showcase -- marina g-tenis só essas
//   npm run landing:showcase -- --force marina refaz mesmo se já existir
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { MANIFEST, OUT, ROOT, SPECS_FILE, saveJpeg, sizeFor } from './lib/showcase-image.mjs'

const SPECS = JSON.parse(fs.readFileSync(SPECS_FILE, 'utf8'))

const QUEUE = 'https://queue.fal.run'
const IMAGE_ENDPOINT = 'fal-ai/nano-banana-2'
const EDIT_ENDPOINT = 'fal-ai/nano-banana-2/edit'
const POLL_MS = 3000
const TIMEOUT_MS = 10 * 60 * 1000
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
    if (Date.now() - started > TIMEOUT_MS) throw new Error(`${label}: passou de 10 minutos na fila`)
  }
}

function asDataUri(file) {
  return `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`
}

async function generate(browser, spec) {
  const base = { prompt: spec.prompt, num_images: 1, aspect_ratio: spec.aspect, safety_tolerance: '2' }
  const input = spec.ref ? { ...base, image_urls: [asDataUri(path.join(OUT, `${spec.ref}.jpg`))] } : base
  console.log(`  ${spec.id}: gerando${spec.ref ? ` a partir de ${spec.ref}` : ''}...`)
  const result = await run(spec.ref ? EDIT_ENDPOINT : IMAGE_ENDPOINT, input, spec.id)
  const imageUrl = result.images?.[0]?.url
  if (!imageUrl) throw new Error(`${spec.id}: o fal não devolveu imagem`)
  const size = sizeFor(spec.aspect)
  await saveJpeg(browser, imageUrl, path.join(OUT, `${spec.id}.jpg`), size)
  console.log(`  ${spec.id}: pronto`)
  return { src: `/landing/showcase/${spec.id}.jpg`, ...size }
}

const args = process.argv.slice(2)
const force = args.includes('--force')
const only = args.filter((arg) => arg !== '--force')
const unknown = only.filter((id) => !SPECS.some((spec) => spec.id === id))
if (unknown.length) throw new Error(`Imagem não existe em showcase.json: ${unknown.join(', ')}`)

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
const queue = SPECS.filter((spec) => (only.length === 0 || only.includes(spec.id)) && (force || !manifest[spec.id]))
if (queue.length === 0) {
  console.log('Nada a gerar: todas as imagens já existem (use --force pra refazer).')
  process.exit(0)
}

fs.mkdirSync(OUT, { recursive: true })
console.log(`Gerando ${queue.length} imagem(ns) no fal.`)
const browser = await chromium.launch()
const failures = []

/** Primeiro as que saem do zero; depois as que dependem de uma referência já salva. */
async function runRound(specs) {
  const results = await Promise.allSettled(specs.map((spec) => generate(browser, spec)))
  for (const [index, result] of results.entries()) {
    const spec = specs[index]
    if (result.status === 'fulfilled') manifest[spec.id] = result.value
    else failures.push(`${spec.id}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`)
  }
}

await runRound(queue.filter((spec) => !spec.ref))
const withRef = queue.filter((spec) => spec.ref)
const missingRef = withRef.filter((spec) => !manifest[spec.ref])
for (const spec of missingRef) failures.push(`${spec.id}: a referência ${spec.ref} não foi gerada`)
await runRound(withRef.filter((spec) => manifest[spec.ref]))
await browser.close()

fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`landing: ${queue.length - failures.length} imagem(ns) prontas em public/landing/showcase`)
if (failures.length) {
  console.error(`Falharam:\n${failures.join('\n')}`)
  process.exit(1)
}
