import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ImageSource, MediaKind, Model } from '@/domain/types'
import { errorMessage, generate } from '@/lib/api'
import { useBalance } from './useBalance'
import { useGenerations } from './useGenerations'

export const PROMPT_MAX = 2000

/** Estado e envio do formulário do Estúdio. Lê `?modo=video&origem=<id>` e `?persona=<id>`. */
export function useStudio(models: readonly Model[]) {
  const [params] = useSearchParams()
  const { balance, refresh: refreshBalance } = useBalance()
  const { upsert } = useGenerations()

  const initialSource: ImageSource | null = params.get('origem')
    ? { type: 'image', id: params.get('origem') ?? '' }
    : params.get('persona')
      ? { type: 'persona', id: params.get('persona') ?? '' }
      : null

  const [kind, setKind] = useState<MediaKind>(params.get('modo') === 'video' ? 'video' : 'image')
  const [modelSlug, setModelSlug] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [source, setSource] = useState<ImageSource | null>(initialSource)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const modelsOfKind = useMemo(() => models.filter((model) => model.kind === kind), [models, kind])

  // Persona escolhida pela URL pede o modelo que usa persona.
  useEffect(() => {
    if (modelsOfKind.some((model) => model.slug === modelSlug)) return
    const preferred = source ? modelsOfKind.find((model) => model.requires_image) : modelsOfKind[0]
    setModelSlug((preferred ?? modelsOfKind[0])?.slug ?? null)
  }, [modelsOfKind, modelSlug, source])

  const model = modelsOfKind.find((item) => item.slug === modelSlug) ?? null
  const needsSource = model?.requires_image ?? false
  const canAfford = model !== null && balance !== null && balance >= model.credits
  const ready = model !== null && prompt.trim().length >= 3 && (!needsSource || source !== null) && canAfford

  async function submit() {
    if (!model || !ready) return
    setSubmitting(true)
    setError(null)
    try {
      const generation = await generate({
        model: model.slug,
        prompt: prompt.trim(),
        personaId: needsSource && source?.type === 'persona' ? source.id : undefined,
        sourceGenerationId: needsSource && source?.type === 'image' ? source.id : undefined,
      })
      upsert(generation)
      void refreshBalance()
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return {
    kind,
    setKind,
    modelsOfKind,
    model,
    setModelSlug,
    prompt,
    setPrompt,
    source,
    setSource,
    needsSource,
    canAfford,
    ready,
    submitting,
    error,
    submit,
  }
}
