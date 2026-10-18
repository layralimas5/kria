import { useEffect, useState } from 'react'
import { buildPersonaPrompt, randomTraits, summarizeTraits, toggleTrait, type TraitGroup, type TraitSelection } from '@/domain/personaTraits'
import type { Generation, Model } from '@/domain/types'
import { errorMessage, generate } from '@/lib/api'
import { useBalance } from './useBalance'
import { useGenerations } from './useGenerations'
import { useIdempotencyKey } from './useIdempotencyKey'

const TEXT_MODEL = 'foto'
const REFERENCE_MODEL = 'foto-persona'

/** Aba "Criar persona": características, imagem de partida opcional e geração do retrato. */
export function usePersonaBuilder(models: readonly Model[]) {
  const { balance, refresh: refreshBalance } = useBalance()
  const { upsert } = useGenerations()
  const [selection, setSelection] = useState<TraitSelection>({})
  const [extra, setExtra] = useState('')
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Resumo das características de cada retrato gerado aqui, para virar a descrição da persona.
  const [summaries, setSummaries] = useState<Record<string, string>>({})
  const requestKey = useIdempotencyKey()

  useEffect(() => requestKey.rotate(), [selection, extra, sourceId, requestKey])

  const model = models.find((item) => item.slug === (sourceId ? REFERENCE_MODEL : TEXT_MODEL)) ?? null
  const canAfford = model !== null && balance !== null && balance >= model.credits

  async function submit(): Promise<Generation | null> {
    if (!model) return null
    if (!canAfford) {
      setError(`Você precisa de ${model.credits} créditos para gerar um retrato.`)
      return null
    }
    setSubmitting(true)
    setError(null)
    try {
      const generation = await generate({
        model: model.slug,
        prompt: buildPersonaPrompt(selection, extra),
        sourceGenerationId: sourceId ?? undefined,
        idempotencyKey: requestKey.current(),
      })
      requestKey.rotate()
      upsert(generation)
      setSummaries((current) => ({ ...current, [generation.id]: summarizeTraits(selection) }))
      void refreshBalance()
      return generation
    } catch (submitError) {
      setError(errorMessage(submitError))
      return null
    } finally {
      setSubmitting(false)
    }
  }

  return {
    selection,
    toggle: (group: TraitGroup, value: string) => setSelection((current) => toggleTrait(current, group, value)),
    randomize: () => setSelection(randomTraits()),
    clear: () => setSelection({}),
    extra,
    setExtra,
    sourceId,
    setSourceId,
    model,
    canAfford,
    submitting,
    error,
    submit,
    summaryOf: (generationId: string) => summaries[generationId] ?? null,
  }
}

export type PersonaBuilder = ReturnType<typeof usePersonaBuilder>
