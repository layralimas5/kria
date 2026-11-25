/** Copiar movimento (0044, docs/copiar-movimento.md): regras do navegador, antes de subir o vídeo. */
import type { Model } from './types'

export const MOTION_MAX_BYTES = 50 * 1024 * 1024
export const MOTION_TYPES: Readonly<Record<string, 'mp4' | 'mov'>> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov' }
export const MOTION_DEFAULT_PROMPT = 'O personagem repete exatamente os movimentos do vídeo de referência, com naturalidade.'
const TOLERANCE_SECONDS = 0.15

export type FileCheck = { readonly ok: true; readonly extension: 'mp4' | 'mov' } | { readonly ok: false; readonly reason: string }

export function checkMotionFile(file: { readonly type: string; readonly size: number }): FileCheck {
  const extension = MOTION_TYPES[file.type]
  if (!extension) return { ok: false, reason: 'Envie um vídeo MP4 ou MOV.' }
  if (file.size > MOTION_MAX_BYTES) return { ok: false, reason: 'O vídeo pode ter até 50 MB.' }
  return { ok: true, extension }
}

/** Os níveis do Copiar movimento, do mais curto ao mais longo. */
export function motionModels(models: readonly Model[]): Model[] {
  return models
    .filter((model) => model.video_input !== null && model.max_input_seconds !== null)
    .sort((a, b) => (a.max_input_seconds ?? 0) - (b.max_input_seconds ?? 0))
}

/** O nível que cobre a duração, ou `null` se passar do maior. Mesma folga do servidor. */
export function motionTierFor(models: readonly Model[], seconds: number): Model | null {
  return motionModels(models).find((model) => seconds <= (model.max_input_seconds ?? 0) + TOLERANCE_SECONDS) ?? null
}

export function maxMotionSeconds(models: readonly Model[]): number | null {
  return motionModels(models).at(-1)?.max_input_seconds ?? null
}
