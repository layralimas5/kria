// Multiplicador: projetos e variações pelo REST (RLS por dono, 0017) e o lote de roteiros pela
// function `multiplier`, que passa pelo motor de crédito. Os arquivos não sobem.

import { z } from 'zod'
import {
  PROJECT_COLUMNS,
  projectSchema,
  toVariation,
  VARIATION_COLUMNS,
  variationRowSchema,
  type MultiplierProject,
  type ProjectInput,
  type TakeInfo,
  type Variation,
  type VariationScript,
} from '@/domain/multiplier'
import { ApiError, invoke } from './api'
import { supabase } from './supabase'

const MULTIPLIER_ERRORS: Record<string, string> = {
  invalid_takes: 'Algum arquivo ficou fora do formato aceito. Remova e envie de novo.',
  too_many_projects: 'Você chegou ao limite de projetos. Apague os que não usa mais.',
  brand_not_found: 'Marca não encontrada.',
  export_limit_reached: 'Você usou todas as exportações do mês no seu plano. Elas renovam no dia 1º, ou troque de plano para ter mais.',
  too_many_exports: 'Já tem vídeos montando ao mesmo tempo. Espere um terminar.',
  variation_not_found: 'Variação não encontrada. Recarregue a página.',
}

function multiplierError(error: { message: string }, fallback: string): ApiError {
  const known = Object.keys(MULTIPLIER_ERRORS).find((code) => error.message.includes(code))
  return new ApiError(known ?? 'multiplier_failed', known ? MULTIPLIER_ERRORS[known]! : fallback)
}

export async function fetchMultiplierProjects(): Promise<MultiplierProject[]> {
  const { data, error } = await supabase.from('multiplier_projects').select(PROJECT_COLUMNS).order('updated_at', { ascending: false })
  if (error) throw multiplierError(error, 'Não deu para carregar seus projetos.')
  return z.array(projectSchema).parse(data)
}

export async function fetchMultiplierProject(id: string): Promise<MultiplierProject> {
  const { data, error } = await supabase.from('multiplier_projects').select(PROJECT_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw multiplierError(error, 'Não deu para carregar o projeto.')
  if (!data) throw new ApiError('project_not_found', 'Projeto não encontrado.')
  return projectSchema.parse(data)
}

export async function saveMultiplierProject(input: ProjectInput, id?: string): Promise<MultiplierProject> {
  const request = id
    ? supabase.from('multiplier_projects').update(input).eq('id', id).select(PROJECT_COLUMNS).single()
    : supabase.from('multiplier_projects').insert(input).select(PROJECT_COLUMNS).single()
  const { data, error } = await request
  if (error) throw multiplierError(error, 'Não deu para salvar o projeto.')
  return projectSchema.parse(data)
}

export async function deleteMultiplierProject(id: string): Promise<void> {
  const { error } = await supabase.from('multiplier_projects').delete().eq('id', id)
  if (error) throw multiplierError(error, 'Não deu para apagar o projeto.')
}

export async function fetchVariations(projectId: string, takes: readonly TakeInfo[]): Promise<Variation[]> {
  const { data, error } = await supabase
    .from('multiplier_variations')
    .select(VARIATION_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .order('position')
  if (error) throw multiplierError(error, 'Não deu para carregar as variações.')
  return z
    .array(variationRowSchema)
    .parse(data)
    .map((row) => toVariation(row, takes))
    .filter((variation): variation is Variation => variation !== null)
}

export async function saveVariationScript(id: string, script: VariationScript): Promise<void> {
  const { error } = await supabase.from('multiplier_variations').update({ script }).eq('id', id)
  if (error) throw multiplierError(error, 'Não deu para salvar o roteiro.')
}

export async function markVariationRendered(id: string, rendered: boolean): Promise<void> {
  const { error } = await supabase.from('multiplier_variations').update({ render_status: rendered ? 'rendered' : 'failed' }).eq('id', id)
  if (error) console.error('render status', error)
}

const exportTicketSchema = z.object({ id: z.string().uuid(), used: z.number().int(), limit: z.number().int().nullable() })
export type ExportTicket = z.infer<typeof exportTicketSchema>

/** Reserva uma exportação na cota do mês antes de montar. A mesma chave não conta duas vezes. */
export async function startExport(variationId: string, idempotencyKey: string): Promise<ExportTicket> {
  const { data, error } = await supabase.rpc('start_multiplier_export', { p_variation_id: variationId, p_idempotency_key: idempotencyKey })
  if (error) throw multiplierError(error, 'Não deu para reservar a exportação. Tente de novo.')
  return exportTicketSchema.parse(data)
}

export interface ExportMetrics {
  readonly durationSeconds: number
  readonly width: number
  readonly height: number
  readonly renderMs: number
  readonly bytes: number
}

/** Fecha a exportação com as medidas (base do custo de infraestrutura). Falha aqui não perde o vídeo. */
export async function finishExport(exportId: string, metrics: ExportMetrics): Promise<void> {
  const { error } = await supabase.rpc('finish_multiplier_export', {
    p_export_id: exportId,
    p_duration_seconds: Math.round(metrics.durationSeconds * 100) / 100,
    p_width: metrics.width,
    p_height: metrics.height,
    p_render_ms: Math.round(metrics.renderMs),
    p_bytes: metrics.bytes,
  })
  if (error) console.error('finish export', error)
}

/** Montagem falhou ou foi cancelada: a exportação volta para a cota. */
export async function failExport(exportId: string): Promise<void> {
  const { error } = await supabase.rpc('fail_multiplier_export', { p_export_id: exportId })
  if (error) console.error('fail export', error)
}

export async function deleteVariation(id: string): Promise<void> {
  const { error } = await supabase.from('multiplier_variations').delete().eq('id', id)
  if (error) throw multiplierError(error, 'Não deu para apagar a variação.')
}

/** Preço do lote em créditos (linha `multiplicador` de `models`). */
export async function fetchBatchCredits(): Promise<number> {
  const { data, error } = await supabase.from('models').select('credits').eq('slug', 'multiplicador').maybeSingle()
  if (error || !data) throw new ApiError('model_unavailable', 'O Multiplicador não está disponível agora.')
  return z.object({ credits: z.number().int() }).parse(data).credits
}

const batchResponseSchema = z.object({ variations: z.number().int().optional() })

/** Pede um lote de roteiros. Cobra o crédito do lote; se o Claude falhar, o servidor devolve. */
export async function requestVariations(projectId: string, count: number, idempotencyKey: string): Promise<number> {
  const response = batchResponseSchema.parse(await invoke('multiplier', { projectId, count, idempotencyKey }))
  return response.variations ?? 0
}
