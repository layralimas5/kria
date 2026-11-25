import { useEffect, useMemo, useState } from 'react'
import { checkMotionFile, MOTION_DEFAULT_PROMPT, maxMotionSeconds, motionModels, motionTierFor } from '@/domain/motionCopy'
import { canUseModel } from '@/domain/plans'
import type { Generation, Model } from '@/domain/types'
import { ApiError, errorMessage, generate } from '@/lib/api'
import { readVideoSeconds, registerMotionReference } from '@/lib/motionApi'
import { isDemo } from '@/lib/supabase'
import { useAccount } from './useAccount'
import { useBalance } from './useBalance'
import { useGenerations } from './useGenerations'
import { useIdempotencyKey } from './useIdempotencyKey'
import { useUserId } from './useSession'

export const MOTION_PRESETS = [
  { label: 'Acenar e sorrir', prompt: 'olha para a câmera, sorri e acena com a mão' },
  { label: 'Falar para a câmera', prompt: 'fala para a câmera de forma natural, como num story: "oi gente, tudo bem?"' },
  { label: 'Andar na rua', prompt: 'caminha pela rua em direção à câmera, cabelo balançando com o vento' },
  { label: 'Mostrar um produto', prompt: 'levanta um produto até a altura do rosto e mostra para a câmera, sorrindo' },
  { label: 'Selfie', prompt: 'segura o celular e faz uma selfie, ajusta o cabelo e sorri' },
  { label: 'Dançar', prompt: 'dança de forma leve e descontraída, no ritmo de uma trend' },
] as const

/** De onde vem o movimento: descrito em texto ou copiado de um vídeo (0044). */
export type MotionSource = 'prompt' | 'video'

export interface MotionVideo {
  readonly referenceId: string
  readonly seconds: number
  readonly previewUrl: string
  readonly modelSlug: string
}

/** Aba "Movimento": anima uma persona salva, descrevendo o movimento ou copiando de um vídeo. */
export function usePersonaMotion(models: readonly Model[]) {
  const userId = useUserId()
  const { plan } = useAccount()
  const { balance, refresh: refreshBalance } = useBalance()
  const { upsert } = useGenerations()
  const videoModels = useMemo(() => models.filter((model) => model.kind === 'video' && model.studio), [models])
  const copyModels = useMemo(() => motionModels(models), [models])
  const [source, setSource] = useState<MotionSource>('prompt')
  const [personaId, setPersonaId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState<string>(MOTION_PRESETS[0].prompt)
  const [modelSlug, setModelSlug] = useState<string | null>(null)
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [video, setVideo] = useState<MotionVideo | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestKey = useIdempotencyKey()

  useEffect(() => {
    if (!modelSlug && videoModels[0]) setModelSlug(videoModels[0].slug)
  }, [modelSlug, videoModels])

  useEffect(() => requestKey.rotate(), [personaId, prompt, modelSlug, source, video, requestKey])

  // A prévia é um link local do arquivo: solto quando troca ou sai da tela.
  useEffect(() => () => {
    if (video) URL.revokeObjectURL(video.previewUrl)
  }, [video])

  const copyAllowed = copyModels.length > 0 && plan !== null && canUseModel(copyModels[0]!.allowed_plans, plan.slug)
  const model =
    source === 'video'
      ? (copyModels.find((item) => item.slug === video?.modelSlug) ?? copyModels[0] ?? null)
      : (videoModels.find((item) => item.slug === modelSlug) ?? null)
  const canAfford = model !== null && balance !== null && balance >= model.credits

  async function pickVideo(file: File): Promise<void> {
    setError(null)
    if (isDemo) {
      setError('No modo demonstração não dá para enviar vídeo.')
      return
    }
    if (!rightsConfirmed) {
      setError('Confirme que o vídeo é seu ou que você tem autorização para usá-lo.')
      return
    }
    const fileCheck = checkMotionFile(file)
    if (!fileCheck.ok) {
      setError(fileCheck.reason)
      return
    }
    setUploading(true)
    try {
      const seconds = await readVideoSeconds(file)
      if (!motionTierFor(copyModels, seconds)) {
        throw new ApiError('invalid_duration', `O vídeo pode ter até ${maxMotionSeconds(copyModels) ?? 10} segundos. Corte o trecho do movimento e envie de novo.`)
      }
      const reference = await registerMotionReference(userId, file, fileCheck.extension)
      setVideo({ referenceId: reference.id, seconds: reference.durationMs / 1000, previewUrl: URL.createObjectURL(file), modelSlug: reference.model })
    } catch (uploadError) {
      setError(errorMessage(uploadError))
    } finally {
      setUploading(false)
    }
  }

  function clearVideo(): void {
    setVideo(null)
    setError(null)
  }

  function missingReason(): string | null {
    if (!model) return null
    if (!personaId) return 'Escolha a persona que vai se mexer.'
    if (source === 'video') {
      if (!copyAllowed) return 'Copiar movimento faz parte dos planos Pro e Max. Veja em Assinatura.'
      if (!video) return 'Envie o vídeo com o movimento.'
    } else if (prompt.trim().length < 3) {
      return 'Descreva o movimento.'
    }
    if (!canAfford) return `Você precisa de ${model.credits} créditos para esse vídeo.`
    return null
  }

  async function submit(): Promise<Generation | null> {
    if (!model) return null
    const missing = missingReason()
    if (missing || !personaId) {
      setError(missing)
      return null
    }
    setSubmitting(true)
    setError(null)
    try {
      const generation = await generate(
        source === 'video' && video
          ? { model: model.slug, prompt: MOTION_DEFAULT_PROMPT, personaId, motionReferenceId: video.referenceId, idempotencyKey: requestKey.current() }
          : { model: model.slug, prompt: prompt.trim(), personaId, idempotencyKey: requestKey.current() },
      )
      requestKey.rotate()
      upsert(generation)
      void refreshBalance()
      // O vídeo de referência é de uso único: depois de gerar, a pessoa escolhe outro.
      if (source === 'video') setVideo(null)
      return generation
    } catch (submitError) {
      setError(errorMessage(submitError))
      return null
    } finally {
      setSubmitting(false)
    }
  }

  return {
    videoModels,
    copyModels,
    copyAllowed,
    source,
    setSource,
    personaId,
    setPersonaId,
    prompt,
    setPrompt,
    model,
    setModelSlug,
    canAfford,
    rightsConfirmed,
    setRightsConfirmed,
    video,
    uploading,
    pickVideo,
    clearVideo,
    submitting,
    error,
    submit,
  }
}

export type PersonaMotion = ReturnType<typeof usePersonaMotion>
