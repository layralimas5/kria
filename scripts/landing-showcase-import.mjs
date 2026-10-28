// Importa as fotos da landing geradas por fora (Gemini, que usa o Nano Banana) e salvas em
// fotos-lp/<id>.png|jpg|jpeg|webp. Recorta na proporção de showcase.json, salva em
// public/landing/showcase e registra no manifesto, como a geração pelo fal.
// Uso:
//   npm run landing:showcase:import            importa tudo que estiver na pasta
//   npm run landing:showcase:import -- --list  só mostra o que falta
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { MANIFEST, OUT, ROOT, SPECS_FILE, saveJpeg, sizeFor } from './lib/showcase-image.mjs'

const INBOX = path.join(ROOT, 'fotos-lp')
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
const EXTENSIONS = Object.keys(MIME)

/** A página de recorte não abre file://; a foto vai embutida. */
function asDataUri(file) {
  return `data:${MIME[path.extname(file).toLowerCase()]};base64,${fs.readFileSync(file).toString('base64')}`
}

const specs = JSON.parse(fs.readFileSync(SPECS_FILE, 'utf8'))
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
const files = fs.existsSync(INBOX) ? fs.readdirSync(INBOX) : []

function findFile(id) {
  const name = files.find((file) => EXTENSIONS.includes(path.extname(file).toLowerCase()) && path.basename(file, path.extname(file)) === id)
  return name ? path.join(INBOX, name) : null
}

const found = specs.map((spec) => ({ spec, file: findFile(spec.id) }))
const missing = found.filter(({ spec, file }) => !file && !manifest[spec.id]).map(({ spec }) => spec.id)

const knownIds = new Set(specs.map((spec) => spec.id))
const strays = files.filter((file) => EXTENSIONS.includes(path.extname(file).toLowerCase()) && !knownIds.has(path.basename(file, path.extname(file))))
if (strays.length) console.warn(`Nome que não bate com nenhuma foto (ignorado): ${strays.join(', ')}`)

if (process.argv.includes('--list')) {
  console.log(missing.length ? `Faltam ${missing.length}: ${missing.join(', ')}` : 'Nenhuma foto faltando.')
  process.exit(0)
}

const queue = found.filter(({ file }) => file)
if (queue.length === 0) {
  console.log(`Nenhuma foto em ${INBOX}. Salve como <id>.png (ids em fotos-lp/PROMPTS.md).`)
  process.exit(0)
}

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
for (const { spec, file } of queue) {
  const size = sizeFor(spec.aspect)
  await saveJpeg(browser, asDataUri(file), path.join(OUT, `${spec.id}.jpg`), size)
  manifest[spec.id] = { src: `/landing/showcase/${spec.id}.jpg`, ...size }
  console.log(`  ${spec.id}: importada`)
}
await browser.close()

fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
const stillMissing = specs.filter((spec) => !manifest[spec.id]).map((spec) => spec.id)
console.log(`landing: ${queue.length} foto(s) importadas.${stillMissing.length ? ` Faltam ${stillMissing.length}: ${stillMissing.join(', ')}` : ' Todas prontas.'}`)
