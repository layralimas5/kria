import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ImageSource, MediaKind, Model } from '@/domain/types'
import { errorMessage, generate } from '@/lib/api'
import { useBalance } from './useBalance'
import { useGenerations } from './useGenerations'

export const PROMPT_MAX = 2000

function sourceFromParams(params: URLSearchParams): ImageSource | null {
  const origin = params.get('origem')
  if (origin) return { type: 'image', id: origin }
  const persona = params.get('persona')
  if (persona) return { type: 'persona', id: persona }
  return null
}

/** Estado e envio do Estúdio. Lê `?modo=video&origem=<id>` e `?persona=<id>`. */
export function useStudio(models: readonly Model[]) {
  const [params] = useSearchParams()
  const { balance, refresh: refreshBalance } = useBalance()
  const { upsert } = useGenerations()

  const [kind, setKind] = useState<MediaKind>(params.get('modo') === 'video' ? 'video' : 'image')
  const [modelSlug, setModelSlug] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [source, setSource] = useState<ImageSource | null>(() => sourceFromParams(params))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // O aviso some assim que a pessoa mexe no que faltava.
  useEffect(() => setError(null), [prompt, source, modelSlug, kind])

  const modelsOfKind = useMemo(() => models.filter((model) => model.kind === kind), [models, kind])

  // Ao trocar de tipo, cai no primeiro modelo dele; com persona escolhida, no que usa persona.
  useEffect(() => {
    if (modelsOfKind.some((model) => model.slug === modelSlug)) return
    const preferred = source ? modelsOfKind.find((model) => model.requires_image) : modelsOfKind[0]
    setModelSlug((preferred ?? modelsOfKind[0])?.slug ?? null)
  }, [modelsOfKind, modelSlug, source])

  const model = modelsOfKind.find((item) => item.slug === modelSlug) ?? null
  const needsSource = model?.requires_image ?? false
  const canAfford = model !== null && balance !== null && balance >= model.credits
  const ready = model !== null && prompt.trim().length >= 3 && (!needsSource || source !== null) && canAfford

  function selectModel(slug: string) {
    const next = models.find((item) => item.slug === slug)
    if (!next) return
    setKind(next.kind)
    setModelSlug(next.slug)
  }

  /** O que falta para gerar, dito para a pessoa em vez de um botão morto. */
  function missingStep(): string | null {
    if (!model) return 'Escolha um modelo.'
    if (prompt.trim().length < 3) return 'Escreva o que você quer criar.'
    if (needsSource && !source) return 'Escolha uma persona ou imagem no botão +.'
    if (!canAfford) return `Você precisa de ${model.credits} créditos para esse modelo.`
    return null
  }

  async function submit() {
    const missing = missingStep()
    if (missing || !model) {
      setError(missing)
      return
    }
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
    selectModel,
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

export type Studio = ReturnType<typeof useStudio>
