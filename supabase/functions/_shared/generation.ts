// Regras puras da geração: sem rede, sem Deno. Testadas em generation.test.ts.

export type ImageInput = 'image_url' | 'image_urls' | 'start_image_url'

export interface ModelRow {
  readonly slug: string
  readonly name: string
  readonly kind: 'image' | 'video'
  readonly endpoint: string
  readonly image_input: ImageInput | null
  readonly requires_image: boolean
  readonly credits: number
  readonly defaults: Record<string, unknown>
}

export interface GeneratedFile {
  readonly url: string
  readonly contentType: string
}

/** O corpo enviado ao fal.ai: defaults do catálogo, o prompt e a imagem no campo que o modelo espera. */
export function buildProviderInput(model: ModelRow, prompt: string, imageUrl: string | null): Record<string, unknown> {
  const input: Record<string, unknown> = { ...model.defaults, prompt }
  if (!model.image_input || !imageUrl) return input
  input[model.image_input] = model.image_input === 'image_urls' ? [imageUrl] : imageUrl
  return input
}

interface FileLike {
  readonly url?: unknown
  readonly content_type?: unknown
}

function asFile(value: unknown): FileLike | null {
  return value && typeof value === 'object' ? (value as FileLike) : null
}

export const TYPE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

const EXTENSION_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
}

function contentTypeFrom(file: FileLike, url: string, kind: ModelRow['kind']): string {
  if (typeof file.content_type === 'string' && file.content_type in TYPE_EXTENSIONS) return file.content_type
  const extension = new URL(url).pathname.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_TYPES[extension] ?? (kind === 'video' ? 'video/mp4' : 'image/png')
}

/** Acha o arquivo gerado na saída do modelo: `video`, `images[0]` ou `image`. */
export function extractOutput(result: unknown, kind: ModelRow['kind']): GeneratedFile | null {
  if (!result || typeof result !== 'object') return null
  const output = result as { video?: unknown; images?: unknown; image?: unknown }
  const candidate =
    kind === 'video'
      ? asFile(output.video)
      : asFile(Array.isArray(output.images) ? output.images[0] : null) ?? asFile(output.image)
  if (!candidate || typeof candidate.url !== 'string' || !/^https:\/\//.test(candidate.url)) return null
  return { url: candidate.url, contentType: contentTypeFrom(candidate, candidate.url, kind) }
}

export function storagePathFor(userId: string, generationId: string, contentType: string): string {
  return `${userId}/${generationId}.${TYPE_EXTENSIONS[contentType] ?? 'bin'}`
}

// Barreira mínima antes de gastar com o provedor. Os modelos ainda passam
// pelo filtro de segurança do próprio fal (`safety_tolerance`).
const BLOCKED_PATTERNS: readonly RegExp[] = [
  /\b(nud[ea]s?|pelad[ao]s?|naked|nsfw|porn\w*|sexo|sexual|topless|lingerie er[oó]tica)\b/i,
  /\b(crian[cç]as?|menin[ao]s? de \d|menor de idade|child|kid|teen|adolescente)\b/i,
  /\b(deepfake|rosto d[eao] (famos[ao]|celebridade)|igual a? (atriz|ator|cantor[a]?|presidente))\b/i,
]

export type PromptCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string }

export function checkPrompt(prompt: string): PromptCheck {
  const text = prompt.normalize('NFC')
  if (BLOCKED_PATTERNS[0]!.test(text)) return { ok: false, reason: 'Conteúdo sexual não é permitido.' }
  if (BLOCKED_PATTERNS[1]!.test(text)) return { ok: false, reason: 'Não geramos imagens de crianças ou adolescentes.' }
  if (BLOCKED_PATTERNS[2]!.test(text)) return { ok: false, reason: 'Não geramos pessoas reais nem famosos.' }
  return { ok: true }
}

/** Geração aberta há mais que isso é dada como perdida e estornada. */
export const GENERATION_TIMEOUT_MS = 30 * 60 * 1000
