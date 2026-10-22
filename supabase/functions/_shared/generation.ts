// Regras puras da geração: sem rede, sem Deno. Testadas em generation.test.ts.

import { PROVIDERS } from './providers.ts'

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
  /** O que a pessoa pode escolher e os valores aceitos (`models.options`, 0011). O primeiro é o padrão. */
  readonly options: ModelOptions
}

export type ModelOptions = Readonly<Record<string, readonly string[]>>
export type ChosenOptions = Readonly<Record<string, string>>

export type OptionsCheck = { readonly ok: true; readonly values: ChosenOptions } | { readonly ok: false; readonly reason: string }

/** Lê `models.options` do banco: só listas de texto entram; o resto é ignorado. */
export function parseModelOptions(raw: unknown): ModelOptions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw).filter(
      (entry): entry is [string, string[]] =>
        Array.isArray(entry[1]) && entry[1].length > 0 && entry[1].every((value) => typeof value === 'string'),
    ),
  )
}

/**
 * Confere o que a pessoa escolheu contra o catálogo, antes de reservar crédito.
 * Opção que o modelo não aceita, ou valor fora da lista, recusa o pedido.
 */
export function resolveOptions(allowed: ModelOptions, requested: ChosenOptions): OptionsCheck {
  for (const [key, value] of Object.entries(requested)) {
    const accepted = allowed[key]
    if (!accepted) return { ok: false, reason: 'Esse modelo não aceita essa opção.' }
    if (!accepted.includes(value)) return { ok: false, reason: 'Valor de opção não aceito por esse modelo.' }
  }
  return { ok: true, values: requested }
}

export interface GeneratedFile {
  readonly url: string
  readonly contentType: string
}

/** O corpo enviado ao fal.ai: defaults do catálogo, as opções já conferidas, o prompt e a imagem no campo que o modelo espera. */
export function buildProviderInput(
  model: ModelRow,
  prompt: string,
  imageUrl: string | null,
  options: ChosenOptions = {},
): Record<string, unknown> {
  const input: Record<string, unknown> = { ...model.defaults, ...options, prompt }
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
export const GENERATION_TIMEOUT_MS = PROVIDERS.fal.timeoutMs
