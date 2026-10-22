import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { canUseModel } from '@/domain/plans'
import type { ImageSource, MediaKind, Model } from '@/domain/types'
import { errorMessage, generate } from '@/lib/api'
import { useAccount } from './useAccount'
import { useActiveBrand } from './useActiveBrand'
import { useBalance } from './useBalance'
import { useGenerations } from './useGenerations'
import { useIdempotencyKey } from './useIdempotencyKey'

export const PROMPT_MAX = 2000

function sourceFromParams(params: URLSearchParams): ImageSource | null {
  const origin = params.get('origem')
  if (origin) return { type: 'image', id: origin }
  const persona = params.get('persona')
  if (persona) return { type: 'persona', id: persona }
  return null
}

/**
 * Estado e envio do Estúdio. O tipo vem da URL (`?modo=imagem|video`), para as abas
 * da barra lateral e o seletor da caixa de prompt mostrarem sempre o mesmo.
 * Também lê `?origem=<id>` e `?persona=<id>`.
 */
export function useStudio(models: readonly Model[]) {
  const [params, setParams] = useSearchParams()
  const { balance, refresh: refreshBalance } = useBalance()
  const { plan } = useAccount()
  const { upsert } = useGenerations()

  const kind: MediaKind = params.get('modo') === 'video' ? 'video' : 'image'
  const setKind = useCallback(
    (next: MediaKind) =>
      setParams(
        (current) => {
          const updated = new URLSearchParams(current)
          updated.set('modo', next === 'video' ? 'video' : 'imagem')
          return updated
        },
        { replace: true },
      ),
    [setParams],
  )
  const [modelSlug, setModelSlug] = useState<string | null>(null)
  // Atalhos do início chegam com um prompt pronto para a pessoa completar.
  const [prompt, setPrompt] = useState(() => (params.get('prompt') ?? '').slice(0, PROMPT_MAX))
  const [source, setSource] = useState<ImageSource | null>(() => sourceFromParams(params))
  // Vindo de um roteiro ou de Meus projetos, a geração fica no projeto e na marca de origem.
  const { activeBrandId } = useActiveBrand()
  const [context, setContext] = useState(() => ({ brandId: params.get('marca') ?? activeBrandId, projectId: params.get('projeto') }))
  // Escolhas da pessoa entre as opções do modelo (`models.options`); o que não foi escolhido usa o padrão.
  const [chosenOptions, setChosenOptions] = useState<Readonly<Record<string, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestKey = useIdempotencyKey()

  // O aviso some assim que a pessoa mexe no que faltava; pedido diferente, chave nova.
  useEffect(() => {
    setError(null)
    requestKey.rotate()
  }, [prompt, source, modelSlug, kind, chosenOptions, requestKey])

  const modelsOfKind = useMemo(() => models.filter((model) => model.kind === kind), [models, kind])

  // Ao trocar de tipo, cai no primeiro modelo dele; com persona escolhida, no que usa persona.
  useEffect(() => {
    if (modelsOfKind.some((model) => model.slug === modelSlug)) return
    const preferred = source ? modelsOfKind.find((model) => model.requires_image) : modelsOfKind[0]
    setModelSlug((preferred ?? modelsOfKind[0])?.slug ?? null)
  }, [modelsOfKind, modelSlug, source])

  const model = modelsOfKind.find((item) => item.slug === modelSlug) ?? null
  // Só vai para o servidor o que o modelo atual aceita; trocar de modelo não carrega escolha inválida.
  const options = useMemo(
    () => Object.fromEntries(Object.entries(chosenOptions).filter(([key, value]) => model?.options[key]?.includes(value))),
    [chosenOptions, model],
  )
  const setOption = useCallback((key: string, value: string) => setChosenOptions((current) => ({ ...current, [key]: value })), [])
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
    if (plan && !canUseModel(model.allowed_plans, plan.slug)) return `${model.name} faz parte dos planos pagos. Veja em Assinatura.`
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
        options,
        personaId: needsSource && source?.type === 'persona' ? source.id : undefined,
        sourceGenerationId: needsSource && source?.type === 'image' ? source.id : undefined,
        brandId: context.brandId ?? undefined,
        projectId: context.projectId ?? undefined,
        idempotencyKey: requestKey.current(),
      })
      requestKey.rotate()
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
    options,
    setOption,
    projectId: context.projectId,
    leaveProject: () => setContext({ brandId: null, projectId: null }),
    submitting,
    error,
    submit,
  }
}

export type Studio = ReturnType<typeof useStudio>
