import { z } from 'zod'
import { CHANNELS } from './assistant'

// Vynkio Content (0012). Espelha as checks de `content_items`.

export const CONTENT_STATUSES = ['idea', 'planned', 'producing', 'review', 'ready', 'published'] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  idea: 'Ideia',
  planned: 'Planejado',
  producing: 'Em produção',
  review: 'Em revisão',
  ready: 'Pronto',
  published: 'Publicado',
}

export const CONTENT_FORMATS = ['reels', 'carrossel', 'post', 'story', 'video', 'shorts', 'anuncio', 'outro'] as const
export type ContentFormat = (typeof CONTENT_FORMATS)[number]

export const CONTENT_FORMAT_LABELS: Record<ContentFormat, string> = {
  reels: 'Reels',
  carrossel: 'Carrossel',
  post: 'Post',
  story: 'Story',
  video: 'Vídeo',
  shorts: 'Shorts',
  anuncio: 'Anúncio',
  outro: 'Outro',
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')

export const contentInputSchema = z.object({
  title: z.string().trim().min(1, 'Dê um título para o conteúdo.').max(120),
  channel: z.enum(CHANNELS).nullable(),
  format: z.enum(CONTENT_FORMATS),
  status: z.enum(CONTENT_STATUSES),
  planned_for: isoDate.nullable(),
  brand_id: z.string().uuid().nullable(),
  project_id: z.string().uuid().nullable(),
  script: z.string().max(10000),
  copy: z.string().max(5000),
  notes: z.string().trim().max(2000),
  asset_ids: z.array(z.string().uuid()).max(20, 'Até 20 imagens e vídeos por conteúdo.'),
})
export type ContentInput = z.infer<typeof contentInputSchema>

/** Na criação também vale de onde o texto saiu (não muda depois). */
export const newContentSchema = contentInputSchema.extend({ source_generation_id: z.string().uuid().nullable() })
export type NewContent = z.infer<typeof newContentSchema>

export const contentItemSchema = newContentSchema.extend({
  id: z.string().uuid(),
  published_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type ContentItem = z.infer<typeof contentItemSchema>

export const CONTENT_COLUMNS =
  'id, title, channel, format, status, planned_for, brand_id, project_id, script, copy, notes, source_generation_id, asset_ids, published_at, created_at, updated_at'

export const EMPTY_CONTENT: ContentInput = {
  title: '',
  channel: null,
  format: 'post',
  status: 'idea',
  planned_for: null,
  brand_id: null,
  project_id: null,
  script: '',
  copy: '',
  notes: '',
  asset_ids: [],
}

/** O próximo e o anterior no fluxo de produção, para mover um card sem arrastar. */
export function neighborStatus(status: ContentStatus, step: 1 | -1): ContentStatus | null {
  return CONTENT_STATUSES[CONTENT_STATUSES.indexOf(status) + step] ?? null
}

/** Data local em `AAAA-MM-DD`, sem o fuso jogar o dia para trás. */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function addDays(iso: string, days: number): string {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number)
  return toIsoDate(new Date(year, month - 1, day + days))
}

/**
 * As semanas do mês para o calendário, começando no domingo. Cada célula é uma
 * data `AAAA-MM-DD`; as de fora do mês vêm com `inMonth: false`.
 */
export function monthGrid(year: number, month: number): { readonly date: string; readonly inMonth: boolean }[][] {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  const weeks: { date: string; inMonth: boolean }[][] = []
  for (let week = 0; week < 6; week += 1) {
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + index)
      return { date: toIsoDate(day), inMonth: day.getMonth() === month }
    })
    if (week > 3 && days.every((day) => !day.inMonth)) break
    weeks.push(days)
  }
  return weeks
}
