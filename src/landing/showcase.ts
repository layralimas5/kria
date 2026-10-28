// Fotos realistas da landing, geradas com os modelos do app por `npm run landing:showcase`.
// Os prompts ficam em showcase.json; o manifesto showcase.generated.json diz quais já existem.
import generatedMedia from './showcase.generated.json'
import showcaseSpecs from './showcase.json'

const ASPECTS = ['16:9', '4:3', '1:1', '4:5', '3:4', '9:16'] as const
export type ShowcaseAspect = (typeof ASPECTS)[number]

interface ShowcaseSpec {
  readonly id: string
  readonly title: string
  readonly category: string
  readonly aspect: string
  readonly prompt: string
  readonly ref?: string
}

interface GeneratedImage {
  readonly src: string
  readonly width: number
  readonly height: number
}

export interface ShowcaseImage {
  readonly id: string
  readonly title: string
  readonly category: string
  readonly aspect: ShowcaseAspect
  readonly prompt: string
  /** `null` enquanto a foto não foi gerada. */
  readonly media: GeneratedImage | null
}

function isAspect(value: string): value is ShowcaseAspect {
  return (ASPECTS as readonly string[]).includes(value)
}

export function toShowcaseImage(spec: ShowcaseSpec, media: GeneratedImage | undefined): ShowcaseImage {
  if (!isAspect(spec.aspect)) throw new Error(`Imagem ${spec.id}: proporção "${spec.aspect}" não é usada na landing`)
  return { id: spec.id, title: spec.title, category: spec.category, aspect: spec.aspect, prompt: spec.prompt, media: media ?? null }
}

const GENERATED: Readonly<Record<string, GeneratedImage | undefined>> = generatedMedia
const SPECS: readonly ShowcaseSpec[] = showcaseSpecs

export const SHOWCASE: readonly ShowcaseImage[] = SPECS.map((spec) => toShowcaseImage(spec, GENERATED[spec.id]))

/** Em produção, as seções de foto só aparecem com todas geradas; no dev, mostram o espaço reservado. */
export const SHOWCASE_VISIBLE = import.meta.env.DEV || SHOWCASE.every((image) => image.media !== null)

export function showcase(id: string): ShowcaseImage {
  const found = SHOWCASE.find((image) => image.id === id)
  if (!found) throw new Error(`Imagem "${id}" não está em showcase.json`)
  return found
}

export function showcaseByPrefix(prefix: string): readonly ShowcaseImage[] {
  return SHOWCASE.filter((image) => image.id.startsWith(prefix))
}
