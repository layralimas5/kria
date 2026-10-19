import { useEffect, useMemo, useState } from 'react'
import type { Generation, Model } from '@/domain/types'
import { errorMessage, generate } from '@/lib/api'
import { useBalance } from './useBalance'
import { useGenerations } from './useGenerations'
import { useIdempotencyKey } from './useIdempotencyKey'

export const MOTION_PRESETS = [
  { label: 'Acenar e sorrir', prompt: 'olha para a câmera, sorri e acena com a mão' },
  { label: 'Falar para a câmera', prompt: 'fala para a câmera de forma natural, como num story: "oi gente, tudo bem?"' },
  { label: 'Andar na rua', prompt: 'caminha pela rua em direção à câmera, cabelo balançando com o vento' },
  { label: 'Mostrar um produto', prompt: 'levanta um produto até a altura do rosto e mostra para a câmera, sorrindo' },
  { label: 'Selfie', prompt: 'segura o celular e faz uma selfie, ajusta o cabelo e sorri' },
  { label: 'Dançar', prompt: 'dança de forma leve e descontraída, no ritmo de uma trend' },
] as const

/** Aba "Movimento": anima uma persona salva com um modelo de vídeo. */
export function usePersonaMotion(models: readonly Model[]) {
  const { balance, refresh: refreshBalance } = useBalance()
  const { upsert } = useGenerations()
  const videoModels = useMemo(() => models.filter((model) => model.kind === 'video'), [models])
  const [personaId, setPersonaId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState<string>(MOTION_PRESETS[0].prompt)
  const [modelSlug, setModelSlug] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestKey = useIdempotencyKey()

  useEffect(() => {
    if (!modelSlug && videoModels[0]) setModelSlug(videoModels[0].slug)
  }, [modelSlug, videoModels])

  useEffect(() => requestKey.rotate(), [personaId, prompt, modelSlug, requestKey])

  const model = videoModels.find((item) => item.slug === modelSlug) ?? null
  const canAfford = model !== null && balance !== null && balance >= model.credits

  async function submit(): Promise<Generation | null> {
    if (!model) return null
    const missing = !personaId
      ? 'Escolha a persona que vai se mexer.'
      : prompt.trim().length < 3
        ? 'Descreva o movimento.'
        : !canAfford
          ? `Você precisa de ${model.credits} créditos para esse vídeo.`
          : null
    if (missing || !personaId) {
      setError(missing)
      return null
    }
    setSubmitting(true)
    setError(null)
    try {
      const generation = await generate({ model: model.slug, prompt: prompt.trim(), personaId, idempotencyKey: requestKey.current() })
      requestKey.rotate()
      upsert(generation)
      void refreshBalance()
      return generation
    } catch (submitError) {
      setError(errorMessage(submitError))
      return null
    } finally {
      setSubmitting(false)
    }
  }

  return { videoModels, personaId, setPersonaId, prompt, setPrompt, model, setModelSlug, canAfford, submitting, error, submit }
}

export type PersonaMotion = ReturnType<typeof usePersonaMotion>
