// Roteiro de uma variação do Multiplicador: o mesmo contrato no servidor (saída do Claude) e no
// navegador (edição e montagem). Sem dependências, para os dois lados importarem este arquivo.
// Testado em multiplierScript.test.ts.

export type TakeKind = 'video' | 'image'

/** O que o banco guarda de cada arquivo. O arquivo em si fica no aparelho da pessoa. */
export interface TakeInfo {
  readonly id: string
  readonly name: string
  readonly kind: TakeKind
  /** Segundos. Foto usa a duração padrão de exibição. */
  readonly duration: number
  /** O que aparece no take, descrito pela pessoa: é o que o Claude sabe do vídeo. */
  readonly note: string
}

/** Uma cena: um trecho de um take com o texto que aparece na tela. */
export interface Beat {
  /** Número do take, começando em 1. */
  readonly take: number
  readonly start: number
  readonly duration: number
  readonly text: string
}

export interface VariationScript {
  readonly angle: string
  readonly hook: string
  readonly beats: readonly Beat[]
  readonly cta: string
  readonly caption: string
}

export interface MaterialAnalysis {
  readonly benefits: readonly string[]
  readonly limitations: readonly string[]
  readonly opportunities: readonly string[]
}

export const LIMITS = {
  maxTakes: 12,
  maxBeats: 8,
  minBeat: 1,
  maxBeat: 8,
  maxVideoSeconds: 60,
  imageSeconds: 3,
  angle: 40,
  hook: 90,
  beatText: 120,
  cta: 90,
  caption: 2200,
  analysisItem: 200,
  analysisItems: 6,
} as const

const round = (value: number) => Math.round(value * 10) / 10

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Ajusta a cena ao take: trecho dentro do arquivo, duração entre 1 e 8 segundos. Nulo se não tem conserto. */
function normalizeBeat(raw: unknown, takes: readonly TakeInfo[]): Beat | null {
  if (!isRecord(raw)) return null
  const index = number(raw.take)
  if (index === null || !Number.isInteger(index) || index < 1 || index > takes.length) return null
  const take = takes[index - 1]!
  const wanted = number(raw.duration) ?? 3
  const label = text(raw.text, LIMITS.beatText)
  if (take.kind === 'image') {
    return { take: index, start: 0, duration: round(Math.min(Math.max(wanted, LIMITS.minBeat), LIMITS.maxBeat)), text: label }
  }
  if (take.duration < LIMITS.minBeat) return null
  const start = round(Math.min(Math.max(number(raw.start) ?? 0, 0), take.duration - LIMITS.minBeat))
  const duration = round(Math.min(Math.max(wanted, LIMITS.minBeat), LIMITS.maxBeat, take.duration - start))
  return { take: index, start, duration, text: label }
}

/** Duração total da variação em segundos (sem o cartão final do CTA). */
export function scriptDuration(script: Pick<VariationScript, 'beats'>): number {
  return round(script.beats.reduce((sum, beat) => sum + beat.duration, 0))
}

/**
 * Valida e ajusta um roteiro vindo do Claude ou da edição. Corta o que passa dos limites,
 * descarta cena que aponta para take inexistente e recusa roteiro sem gancho ou sem cena.
 */
export function normalizeScript(raw: unknown, takes: readonly TakeInfo[]): VariationScript | null {
  if (!isRecord(raw) || !Array.isArray(raw.beats)) return null
  const hook = text(raw.hook, LIMITS.hook)
  if (!hook) return null
  const beats: Beat[] = []
  let total = 0
  for (const item of raw.beats.slice(0, LIMITS.maxBeats)) {
    const beat = normalizeBeat(item, takes)
    if (!beat) continue
    if (total + beat.duration > LIMITS.maxVideoSeconds) break
    beats.push(beat)
    total += beat.duration
  }
  if (beats.length === 0) return null
  return {
    angle: text(raw.angle, LIMITS.angle) || 'Variação',
    hook,
    beats,
    cta: text(raw.cta, LIMITS.cta),
    caption: typeof raw.caption === 'string' ? raw.caption.trim().slice(0, LIMITS.caption) : '',
  }
}

function list(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => text(item, LIMITS.analysisItem))
    .filter((item) => item.length > 0)
    .slice(0, LIMITS.analysisItems)
}

export function normalizeAnalysis(raw: unknown): MaterialAnalysis {
  const source = isRecord(raw) ? raw : {}
  return { benefits: list(source.benefits), limitations: list(source.limitations), opportunities: list(source.opportunities) }
}
