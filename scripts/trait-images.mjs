// Gera a foto de cada opção visual do construtor de persona (corte de cabelo, rosto, barba,
// corpo e roupa) com o Nano Banana 2 pela fila do fal, no lugar das ilustrações de manequim.
// Salva em public/traits/<grupo>-<valor>.jpg (320x320) e reescreve src/domain/traitImages.ts.
//
// Precisa de FAL_KEY (variável de ambiente ou linha FAL_KEY=... no .env.local).
// Custo: cerca de US$ 0,06 por foto (0.5K), 38 fotos no total.
// Uso:
//   npm run traits:images                    gera as que faltam
//   npm run traits:images -- hairstyle-chanel refaz só essa
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { PERSONA_TRAIT_GROUPS } from '../src/domain/personaTraits.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public/traits')
const MANIFEST = path.join(ROOT, 'src/domain/traitImages.ts')
const QUEUE = 'https://queue.fal.run'
const ENDPOINT = 'fal-ai/nano-banana-2'
const POLL_MS = 3000
const TIMEOUT_MS = 10 * 60 * 1000
const SIZE = 320
const PARALLEL = 4

const STYLE =
  'Photorealistic photo of a fictional adult (not a celebrity), natural skin texture, real camera look, soft studio key light, ' +
  'plain dark charcoal background, centered subject, no text, no watermark, no logo.'

// Quem aparece em cada opção: só muda a característica, o resto fica neutro.
const MASCULINE = new Set(['hairstyle-crespo', 'hairstyle-curto', 'hairstyle-raspado', 'hairstyle-careca', 'build-atletico', 'build-musculoso', 'outfit-streetwear', 'outfit-executivo'])

function promptFor(group, option) {
  const key = `${group.id}-${option.value}`
  const person = group.id === 'facialHair' || MASCULINE.has(key) ? 'Brazilian man in his early 30s' : 'Brazilian woman in her late 20s'
  if (group.id === 'hairstyle') return `Head-and-shoulders portrait of a ${person} with ${option.prompt}, plain grey t-shirt, calm expression. ${STYLE}`
  if (group.id === 'faceShape') return `Close-up portrait of a ${person} with a ${option.prompt}, hair pulled back so the face outline is clear, plain grey t-shirt. ${STYLE}`
  if (group.id === 'facialHair') return `Close-up portrait of a ${person} with short dark hair, ${option.prompt}, plain grey t-shirt. ${STYLE}`
  if (group.id === 'build') return `Full-body photo of a ${person} with a ${option.prompt}, standing relaxed, plain grey fitted t-shirt and black shorts. ${STYLE}`
  return `Full-body fashion photo of a ${person} wearing a ${option.prompt}, standing relaxed. ${STYLE}`
}

function readFalKey() {
  if (process.env.FAL_KEY) return process.env.FAL_KEY
  const envFile = path.join(ROOT, '.env.local')
  if (fs.existsSync(envFile)) {
    const line = fs.readFileSync(envFile, 'utf8').split(/\r?\n/).find((row) => row.startsWith('FAL_KEY='))
    const value = line?.slice('FAL_KEY='.length).trim().replace(/^["']|["']$/g, '')
    if (value) return value
  }
  throw new Error('FAL_KEY não encontrada. Coloque FAL_KEY=... no .env.local (a mesma chave cadastrada no Supabase).')
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

async function run(input, label) {
  const { status_url: statusUrl, response_url: responseUrl } = await fal('POST', `${QUEUE}/${ENDPOINT}`, input)
  const started = Date.now()
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    const { status, error } = await fal('GET', statusUrl)
    if (error) throw new Error(`${label}: ${error}`)
    if (status === 'COMPLETED') return fal('GET', responseUrl)
    if (Date.now() - started > TIMEOUT_MS) throw new Error(`${label}: passou de 10 minutos na fila`)
  }
}

async function saveJpg(browser, imageUrl, target) {
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } })
  await page.setContent(`<body style="margin:0;background:#000"><img src="${imageUrl}" style="width:${SIZE}px;height:${SIZE}px;object-fit:cover;object-position:center 30%;display:block"></body>`)
  await page.waitForFunction(() => document.images[0]?.complete && document.images[0].naturalWidth > 0, null, { timeout: 60000 })
  await page.screenshot({ path: target, type: 'jpeg', quality: 84 })
  await page.close()
}

function writeManifest() {
  const files = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((file) => file.endsWith('.jpg')).sort() : []
  const entries = files.map((file) => `  '${file.slice(0, -4)}': '/traits/${file}',`).join('\n')
  const body = [
    '// GERADO por `npm run traits:images`. Não editar à mão.',
    '// Foto de cada opção visual do construtor de persona, em public/traits.',
    '// Opção sem foto aqui aparece com a ilustração de TraitArt.',
    '',
    `export const TRAIT_IMAGES: Readonly<Record<string, string>> = {${entries ? `\n${entries}\n` : ''}}`,
    '',
  ].join('\n')
  fs.writeFileSync(MANIFEST, body)
}

const only = process.argv.slice(2)
const jobs = PERSONA_TRAIT_GROUPS.filter((group) => group.display === 'photos').flatMap((group) =>
  group.options.map((option) => ({ key: `${group.id}-${option.value}`, prompt: promptFor(group, option) })),
)
const unknown = only.filter((key) => !jobs.some((job) => job.key === key))
if (unknown.length) throw new Error(`Opção desconhecida: ${unknown.join(', ')}`)
const pending = jobs.filter((job) => (only.length ? only.includes(job.key) : !fs.existsSync(path.join(OUT, `${job.key}.jpg`))))

fs.mkdirSync(OUT, { recursive: true })
console.log(`${pending.length} foto(s) para gerar (cerca de US$ ${(pending.length * 0.06).toFixed(2)})`)
const browser = await chromium.launch()
const failures = []
try {
  for (let index = 0; index < pending.length; index += PARALLEL) {
    await Promise.all(
      pending.slice(index, index + PARALLEL).map(async (job) => {
        try {
          const result = await run({ prompt: job.prompt, num_images: 1, aspect_ratio: '1:1', resolution: '0.5K', safety_tolerance: '2' }, job.key)
          const imageUrl = result.images?.[0]?.url
          if (!imageUrl) throw new Error(`${job.key}: o fal não devolveu imagem`)
          await saveJpg(browser, imageUrl, path.join(OUT, `${job.key}.jpg`))
          console.log('ok', job.key)
        } catch (error) {
          failures.push(job.key)
          console.error('falhou', job.key, error instanceof Error ? error.message : error)
        }
      }),
    )
  }
} finally {
  await browser.close()
  writeManifest()
}
if (failures.length) {
  console.error(`Faltaram ${failures.length}: ${failures.join(' ')}. Rode de novo para tentar só essas.`)
  process.exitCode = 1
}
