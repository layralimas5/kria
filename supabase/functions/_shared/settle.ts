// Fecha uma geração aberta: consulta o fal, copia o arquivo para o nosso
// Storage e marca como concluída, ou falha e estorna. Usada pelo webhook
// do fal e pelo polling do app (generation-status), então precisa ser
// idempotente: as funções SQL só mudam geração que ainda está aberta.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { FalError, getResult, getStatus } from './fal.ts'
import { extractOutput, GENERATION_TIMEOUT_MS, storagePathFor } from './generation.ts'
import { discardMotionReference } from './motionCleanup.ts'
import { sendPush } from './push.ts'
import { generationMessage } from './pushMessages.ts'

export interface OpenGeneration {
  readonly id: string
  readonly user_id: string
  readonly kind: 'image' | 'video'
  readonly status: 'queued' | 'running' | 'succeeded' | 'failed'
  readonly provider_status_url: string | null
  readonly provider_response_url: string | null
  readonly created_at: string
  /** Vídeo de referência do Copiar movimento (0044): apagado quando a geração fecha. */
  readonly motion_reference_id: string | null
}

export type SettleOutcome = 'pending' | 'succeeded' | 'failed' | 'already_closed'

export const GENERATION_COLUMNS = 'id, user_id, kind, status, provider_status_url, provider_response_url, created_at, motion_reference_id'

/** Quem de fato fechou a geração (webhook e polling correm juntos) apaga o vídeo de referência e avisa no aparelho. */
async function notifyOwner(admin: SupabaseClient, generation: OpenGeneration, succeeded: boolean): Promise<void> {
  await discardMotionReference(admin, generation.motion_reference_id)
  await sendPush(admin, generationMessage({ id: generation.id, kind: generation.kind, succeeded }), generation.user_id)
}

async function fail(admin: SupabaseClient, generation: OpenGeneration, reason: string): Promise<SettleOutcome> {
  const { data, error } = await admin.rpc('fail_generation', { p_id: generation.id, p_error: reason })
  if (error) throw new Error(`fail_generation: ${error.message}`)
  if (data === true) await notifyOwner(admin, generation, false)
  return 'failed'
}

async function copyToStorage(admin: SupabaseClient, generation: OpenGeneration, url: string, contentType: string) {
  const download = await fetch(url)
  if (!download.ok) throw new Error(`download do resultado respondeu ${download.status}`)
  const path = storagePathFor(generation.user_id, generation.id, contentType)
  const { error } = await admin.storage
    .from('media')
    .upload(path, await download.arrayBuffer(), { contentType, upsert: true })
  if (error) throw new Error(`upload: ${error.message}`)
  return path
}

export async function settleGeneration(
  admin: SupabaseClient,
  falKey: string,
  generation: OpenGeneration,
): Promise<SettleOutcome> {
  if (generation.status !== 'queued' && generation.status !== 'running') return 'already_closed'

  const expired = Date.now() - new Date(generation.created_at).getTime() > GENERATION_TIMEOUT_MS
  if (!generation.provider_status_url || !generation.provider_response_url) {
    return expired ? fail(admin, generation, 'A geração não chegou ao provedor.') : 'pending'
  }

  const status = await getStatus(falKey, generation.provider_status_url)
  if (status.status !== 'COMPLETED') {
    return expired ? fail(admin, generation, 'A geração demorou demais e foi cancelada.') : 'pending'
  }
  if (status.error) return fail(admin, generation, status.error)

  let result: unknown
  try {
    result = await getResult(falKey, generation.provider_response_url)
  } catch (error) {
    // 4xx no resultado é falha do modelo (ex.: filtro de segurança); 5xx tenta de novo depois.
    if (error instanceof FalError && error.status < 500) return fail(admin, generation, error.message)
    throw error
  }

  const output = extractOutput(result, generation.kind)
  if (!output) return fail(admin, generation, 'O modelo não devolveu arquivo.')

  const path = await copyToStorage(admin, generation, output.url, output.contentType)
  const { data: closed, error } = await admin.rpc('complete_generation', {
    p_id: generation.id,
    p_output_path: path,
    p_output_type: output.contentType,
  })
  if (error) throw new Error(`complete_generation: ${error.message}`)
  if (closed === true) await notifyOwner(admin, generation, true)
  return 'succeeded'
}
