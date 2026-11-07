// Vynkio Multiplicador (0017): projeto, takes, variações e a linha do tempo da montagem.
// O contrato do roteiro é o mesmo do servidor (`_shared/multiplierScript.ts`).

import { z } from 'zod'
import {
  LIMITS,
  normalizeAnalysis,
  normalizeScript,
  scriptDuration,
  type Beat,
  type MaterialAnalysis,
  type TakeInfo,
  type TakeKind,
  type VariationScript,
} from '../../supabase/functions/_shared/multiplierScript'

export { LIMITS, normalizeAnalysis, normalizeScript, scriptDuration }
export type { Beat, MaterialAnalysis, TakeInfo, TakeKind, VariationScript }

export const PLATFORMS = ['instagram', 'tiktok', 'shorts', 'youtube', 'anuncio', 'facebook'] as const
export type MultiplierPlatform = (typeof PLATFORMS)[number]
export const PLATFORM_LABELS: Record<MultiplierPlatform, string> = {
  instagram: 'Instagram Reels',
  tiktok: 'TikTok',
  shorts: 'YouTube Shorts',
  youtube: 'YouTube',
  anuncio: 'Anúncio (Meta Ads)',
  facebook: 'Facebook',
}

export const OBJECTIVES = ['vendas', 'engajamento', 'alcance', 'leads', 'lancamento', 'autoridade'] as const
export type MultiplierObjective = (typeof OBJECTIVES)[number]
export const OBJECTIVE_LABELS: Record<MultiplierObjective, string> = {
  vendas: 'Vender',
  engajamento: 'Engajamento',
  alcance: 'Alcance',
  leads: 'Captar contatos',
  lancamento: 'Lançamento',
  autoridade: 'Autoridade',
}

export const ASPECTS = ['9:16', '1:1', '4:5', '16:9'] as const
export type Aspect = (typeof ASPECTS)[number]

/** Tamanho de saída. 1080 no lado menor: o padrão das redes. */
export const ASPECT_SIZES: Record<Aspect, { readonly width: number; readonly height: number; readonly label: string }> = {
  '9:16': { width: 1080, height: 1920, label: 'Vertical 9:16 (Reels, TikTok, Shorts)' },
  '1:1': { width: 1080, height: 1080, label: 'Quadrado 1:1 (feed)' },
  '4:5': { width: 1080, height: 1350, label: 'Retrato 4:5 (feed)' },
  '16:9': { width: 1920, height: 1080, label: 'Horizontal 16:9 (YouTube)' },
}

const takeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  kind: z.enum(['video', 'image']),
  duration: z.number().min(0.5).max(600),
  note: z.string().max(300).default(''),
})

export const projectSchema = z.object({
  id: z.string().uuid(),
  brand_id: z.string().uuid().nullable(),
  name: z.string(),
  product_name: z.string(),
  product_description: z.string(),
  audience: z.string(),
  platform: z.enum(PLATFORMS),
  objective: z.enum(OBJECTIVES),
  aspect: z.enum(ASPECTS),
  transcript: z.string(),
  takes: z.array(takeSchema),
  rights_confirmed: z.boolean(),
  analysis: z.unknown().transform((value) => (value === null || value === undefined ? null : normalizeAnalysis(value))),
  created_at: z.string(),
  updated_at: z.string(),
})
export type MultiplierProject = z.infer<typeof projectSchema>

export const PROJECT_COLUMNS =
  'id, brand_id, name, product_name, product_description, audience, platform, objective, aspect, transcript, takes, rights_confirmed, analysis, created_at, updated_at'

export type ProjectInput = Pick<
  MultiplierProject,
  'name' | 'product_name' | 'product_description' | 'audience' | 'platform' | 'objective' | 'aspect' | 'transcript' | 'rights_confirmed'
> & { readonly brand_id: string | null; readonly takes: readonly TakeInfo[] }

export const RENDER_STATUSES = ['pending', 'rendered', 'failed'] as const

export const variationRowSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  generation_id: z.string().uuid(),
  position: z.number().int(),
  script: z.unknown(),
  edited: z.boolean(),
  render_status: z.enum(RENDER_STATUSES),
  rendered_at: z.string().nullable(),
  created_at: z.string(),
})

export interface Variation {
  readonly id: string
  readonly projectId: string
  readonly batchId: string
  readonly position: number
  readonly script: VariationScript
  readonly edited: boolean
  readonly renderStatus: (typeof RENDER_STATUSES)[number]
  readonly createdAt: string
}

export const VARIATION_COLUMNS = 'id, project_id, generation_id, position, script, edited, render_status, rendered_at, created_at'

/** Lê a linha do banco ajustando o roteiro aos takes atuais. Roteiro que não serve mais fica de fora. */
export function toVariation(row: z.infer<typeof variationRowSchema>, takes: readonly TakeInfo[]): Variation | null {
  const script = normalizeScript(row.script, takes)
  if (!script) return null
  return {
    id: row.id,
    projectId: row.project_id,
    batchId: row.generation_id,
    position: row.position,
    script,
    edited: row.edited,
    renderStatus: row.render_status,
    createdAt: row.created_at,
  }
}

export interface Batch {
  readonly id: string
  readonly createdAt: string
  readonly variations: readonly Variation[]
}

/** Agrupa as variações por lote, do mais novo para o mais antigo. */
export function groupBatches(variations: readonly Variation[]): Batch[] {
  const batches = new Map<string, Variation[]>()
  for (const variation of variations) batches.set(variation.batchId, [...(batches.get(variation.batchId) ?? []), variation])
  return [...batches.entries()]
    .map(([id, items]) => ({
      id,
      createdAt: items.reduce((oldest, item) => (item.createdAt < oldest ? item.createdAt : oldest), items[0]!.createdAt),
      variations: [...items].sort((a, b) => a.position - b.position),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** O que falta para pedir roteiros; vazio quando está pronto. */
export function missingForScripts(project: Pick<MultiplierProject, 'takes' | 'rights_confirmed' | 'product_name' | 'product_description'>): string[] {
  const missing: string[] = []
  if (project.takes.length === 0) missing.push('Adicione pelo menos um vídeo ou foto.')
  if (!project.product_name.trim() && !project.product_description.trim()) missing.push('Diga qual é o produto e o que ele faz.')
  if (!project.rights_confirmed) missing.push('Confirme que você tem direito de uso sobre os arquivos.')
  return missing
}

// ---------------------------------------------------------------- arquivos

export const ACCEPTED_FILES = {
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
  image: ['image/jpeg', 'image/png', 'image/webp'],
  music: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/ogg', 'audio/webm'],
} as const

export const MAX_FILE_BYTES = { video: 500 * 1024 * 1024, image: 20 * 1024 * 1024, music: 30 * 1024 * 1024 } as const
export const MAX_VIDEO_SECONDS = 180

export function takeKindOf(type: string): TakeKind | null {
  if ((ACCEPTED_FILES.video as readonly string[]).includes(type)) return 'video'
  if ((ACCEPTED_FILES.image as readonly string[]).includes(type)) return 'image'
  return null
}

/** O mesmo arquivo reaberto em outra sessão: casa pelo nome. */
export function matchTake(takes: readonly TakeInfo[], fileName: string): TakeInfo | undefined {
  return takes.find((take) => take.name === fileName)
}

// --------------------------------------------------------- linha do tempo

export const RENDER_STYLES = ['impacto', 'legenda', 'destaque'] as const
export type RenderStyle = (typeof RENDER_STYLES)[number]
export const RENDER_STYLE_LABELS: Record<RenderStyle, { readonly name: string; readonly description: string }> = {
  impacto: { name: 'Impacto', description: 'Texto grande no alto, com faixa roxa. Bom para gancho forte.' },
  legenda: { name: 'Legenda', description: 'Texto discreto embaixo, em cápsula escura. Cara de vídeo de criador.' },
  destaque: { name: 'Destaque', description: 'Texto amarelo com contorno, no centro. Bom para anúncio.' },
}

export const END_CARD_SECONDS = 2.5
export const HOOK_MAX_SECONDS = 3

export interface Segment {
  readonly takeId: string
  readonly kind: TakeKind
  /** Onde começa no vídeo final. */
  readonly at: number
  /** Trecho do arquivo de origem. */
  readonly from: number
  readonly duration: number
}

export interface Overlay {
  readonly kind: 'hook' | 'beat' | 'cta'
  readonly text: string
  readonly at: number
  readonly duration: number
}

export interface Timeline {
  readonly width: number
  readonly height: number
  readonly duration: number
  readonly segments: readonly Segment[]
  readonly overlays: readonly Overlay[]
  /** O cartão final com o CTA começa aqui (igual ao fim das cenas). */
  readonly endCardAt: number
}

/**
 * Monta a linha do tempo de uma variação: as cenas em sequência, o gancho por cima do começo,
 * o texto de cada cena depois do gancho e um cartão final com o CTA.
 */
export function buildTimeline(script: VariationScript, takes: readonly TakeInfo[], aspect: Aspect): Timeline {
  const { width, height } = ASPECT_SIZES[aspect]
  const segments: Segment[] = []
  const overlays: Overlay[] = []
  let at = 0
  for (const beat of script.beats) {
    const take = takes[beat.take - 1]
    if (!take) continue
    segments.push({ takeId: take.id, kind: take.kind, at, from: beat.start, duration: beat.duration })
    at += beat.duration
  }
  const scenes = at
  const hookDuration = Math.min(HOOK_MAX_SECONDS, scenes)
  overlays.push({ kind: 'hook', text: script.hook, at: 0, duration: hookDuration })
  script.beats.forEach((beat, index) => {
    const segment = segments[index]
    if (!segment || !beat.text) return
    const start = Math.max(segment.at, hookDuration)
    const end = segment.at + segment.duration
    if (end - start >= 0.8) overlays.push({ kind: 'beat', text: beat.text, at: start, duration: end - start })
  })
  const hasCta = script.cta.trim().length > 0
  if (hasCta) overlays.push({ kind: 'cta', text: script.cta, at: scenes, duration: END_CARD_SECONDS })
  return { width, height, duration: scenes + (hasCta ? END_CARD_SECONDS : 0), segments, overlays, endCardAt: scenes }
}

/** Texto que deve estar na tela num instante. */
export function overlaysAt(timeline: Pick<Timeline, 'overlays'>, time: number): Overlay[] {
  return timeline.overlays.filter((overlay) => time >= overlay.at && time < overlay.at + overlay.duration)
}

/** Cena que está na tela num instante; nula no cartão final. */
export function segmentAt(timeline: Pick<Timeline, 'segments'>, time: number): Segment | null {
  return timeline.segments.find((segment) => time >= segment.at && time < segment.at + segment.duration) ?? null
}

/** Quebra o texto em linhas que cabem na largura, sem cortar palavra. */
export function wrapText(text: string, maxWidth: number, measure: (value: string) => number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word
    if (line && measure(candidate) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Nome do arquivo baixado: projeto, número e ângulo, sem acento nem espaço. */
export function exportFileName(projectName: string, variation: Pick<Variation, 'position' | 'script'>, extension: string): string {
  const slug = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
  return `${slug(projectName) || 'vynkio'}-${String(variation.position).padStart(2, '0')}-${slug(variation.script.angle) || 'variacao'}.${extension}`
}
