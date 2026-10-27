import { z } from 'zod'
import type { Model } from './types'

// Formatos (0015): o catálogo vem do banco; o texto dos prompts fica só no servidor.

export const formatChoiceSchema = z.object({ value: z.string(), label: z.string() })
export type FormatChoice = z.infer<typeof formatChoiceSchema>

export const formatFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  choices: z.array(formatChoiceSchema).min(1),
})
export type FormatField = z.infer<typeof formatFieldSchema>

export const formatFlowSchema = z.enum(['single', 'before_after'])
export type FormatFlow = z.infer<typeof formatFlowSchema>

export const formatSchema = z.object({
  slug: z.string(),
  name: z.string(),
  niche: z.string(),
  description: z.string(),
  flow: formatFlowSchema,
  model_slug: z.string(),
  edit_model_slug: z.string().nullable(),
  fields: z.array(formatFieldSchema),
  example_path: z.string().nullable(),
  badge: z.enum(['NOVO', 'TOP']).nullable(),
  position: z.number().int(),
})
export type Format = z.infer<typeof formatSchema>

export const FORMAT_COLUMNS = 'slug, name, niche, description, flow, model_slug, edit_model_slug, fields, example_path, badge, position'

export const uploadSchema = z.object({ id: z.string().uuid(), path: z.string() })
export type Upload = z.infer<typeof uploadSchema>

/** Igual à check de `uploads.content_type` e à policy do Storage. */
export const UPLOAD_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const
export type UploadType = keyof typeof UPLOAD_TYPES
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024

export const FORMAT_NOTE_MAX = 200

export type FileCheck = { readonly ok: true; readonly type: UploadType } | { readonly ok: false; readonly reason: string }

export function checkUploadFile(file: Pick<File, 'type' | 'size'>): FileCheck {
  if (!(file.type in UPLOAD_TYPES)) return { ok: false, reason: 'Envie uma foto em JPG, PNG ou WEBP.' }
  if (file.size > UPLOAD_MAX_BYTES) return { ok: false, reason: 'A foto passa de 10 MB. Envie uma menor.' }
  return { ok: true, type: file.type as UploadType }
}

/** A primeira opção de cada campo, que o servidor também usa quando nada foi escolhido. */
export function defaultChoices(fields: readonly FormatField[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, field.choices[0]!.value]))
}

export interface FormatCost {
  /** Etapa de edição do antes e depois; nulo nos formatos de uma etapa. */
  readonly edit: number | null
  readonly final: number
  readonly total: number
}

/** Quanto o formato custa, a partir dos modelos do banco. Nulo se algum modelo não está no catálogo. */
export function formatCost(format: Pick<Format, 'model_slug' | 'edit_model_slug'>, models: readonly Model[]): FormatCost | null {
  const credits = (slug: string) => models.find((model) => model.slug === slug)?.credits ?? null
  const final = credits(format.model_slug)
  const edit = format.edit_model_slug ? credits(format.edit_model_slug) : null
  if (final === null || (format.edit_model_slug && edit === null)) return null
  return { edit, final, total: final + (edit ?? 0) }
}

/** O formato só pode ser usado se o plano libera todos os modelos dele. */
export function formatAllowed(format: Pick<Format, 'model_slug' | 'edit_model_slug'>, models: readonly Model[], planSlug: string): boolean {
  return [format.model_slug, format.edit_model_slug]
    .filter((slug): slug is string => slug !== null)
    .every((slug) => {
      const model = models.find((item) => item.slug === slug)
      return model !== undefined && (model.allowed_plans === null || model.allowed_plans.includes(planSlug))
    })
}

/** Nichos na ordem em que aparecem no catálogo (que já vem ordenado por posição). */
export function groupByNiche(formats: readonly Format[]): { readonly niche: string; readonly formats: readonly Format[] }[] {
  const groups = new Map<string, Format[]>()
  for (const format of formats) groups.set(format.niche, [...(groups.get(format.niche) ?? []), format])
  return [...groups].map(([niche, items]) => ({ niche, formats: items }))
}
