import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AssistantToolInfo, Channel } from '@/domain/assistant'
import type { TextGeneration } from '@/domain/types'
import { errorMessage, runAssistant } from '@/lib/api'
import { useBalance } from './useBalance'
import { useIdempotencyKey } from './useIdempotencyKey'

export const BRIEF_MAX = 2000

/**
 * Estado e envio de uma ferramenta do Vynkio AI. O briefing pode chegar pela URL
 * (`?briefing=`), que é como uma ideia vira roteiro; `?marca=` e `?projeto=` também.
 */
export function useAssistant(info: AssistantToolInfo, credits: number | null) {
  const [params] = useSearchParams()
  const { balance, refresh: refreshBalance } = useBalance()
  const [brief, setBrief] = useState(() => (params.get('briefing') ?? '').slice(0, BRIEF_MAX))
  const [channel, setChannel] = useState<Channel>('instagram')
  const [brandId, setBrandId] = useState<string | null>(() => params.get('marca'))
  const [projectId, setProjectId] = useState<string | null>(() => params.get('projeto'))
  const [result, setResult] = useState<TextGeneration | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestKey = useIdempotencyKey()

  // Pedido diferente, chave nova; o aviso some quando a pessoa mexe.
  useEffect(() => {
    setError(null)
    requestKey.rotate()
  }, [brief, channel, brandId, projectId, info.tool, requestKey])

  const canAfford = credits !== null && balance !== null && balance >= credits

  function missingStep(): string | null {
    if (brief.trim().length < 3) return 'Conte o que você precisa no briefing.'
    if (credits === null) return 'Essa ferramenta não está no seu plano. Veja os planos em Assinatura.'
    if (!canAfford) return `Você precisa de ${credits} créditos para essa ferramenta.`
    return null
  }

  async function submit(): Promise<TextGeneration | null> {
    const missing = missingStep()
    if (missing) {
      setError(missing)
      return null
    }
    setSubmitting(true)
    setError(null)
    try {
      const generation = await runAssistant({
        tool: info.tool,
        brief: brief.trim(),
        channel,
        brandId: brandId ?? undefined,
        projectId: projectId ?? undefined,
        idempotencyKey: requestKey.current(),
      })
      requestKey.rotate()
      setResult(generation)
      return generation
    } catch (submitError) {
      setError(errorMessage(submitError))
      return null
    } finally {
      setSubmitting(false)
      void refreshBalance()
    }
  }

  return {
    brief,
    setBrief,
    channel,
    setChannel,
    brandId,
    setBrandId,
    projectId,
    setProjectId,
    result,
    setResult,
    submitting,
    error,
    canAfford,
    submit,
  }
}

export type Assistant = ReturnType<typeof useAssistant>
