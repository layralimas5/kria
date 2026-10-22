import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { COPY_FORMATS, type AssistantToolInfo, type Channel, type ContentGoal, type CopyFormat, type TextLength } from '@/domain/assistant'
import type { TextGeneration } from '@/domain/types'
import { errorMessage, runAssistant } from '@/lib/api'
import { useActiveBrand } from './useActiveBrand'
import { useBalance } from './useBalance'
import { useIdempotencyKey } from './useIdempotencyKey'

export const BRIEF_MAX = 2000

const isCopyFormat = (value: string | null): value is CopyFormat => COPY_FORMATS.some((format) => format === value)

/**
 * Estado e envio de uma ferramenta do Vynkio AI. O briefing pode chegar pela URL
 * (`?briefing=`), que é como uma etapa vira a próxima; `?marca=`, `?projeto=` e
 * `?tipo=` (tipo de texto da copy) também.
 */
export function useAssistant(info: AssistantToolInfo, credits: number | null) {
  const [params] = useSearchParams()
  const { balance, refresh: refreshBalance } = useBalance()
  const [brief, setBrief] = useState(() => (params.get('briefing') ?? '').slice(0, BRIEF_MAX))
  const [channel, setChannel] = useState<Channel>('instagram')
  const [format, setFormat] = useState<CopyFormat>(() => {
    const fromUrl = params.get('tipo')
    return isCopyFormat(fromUrl) ? fromUrl : 'legenda'
  })
  const [goal, setGoal] = useState<ContentGoal | null>(null)
  const [length, setLength] = useState<TextLength | null>(null)
  const [tone, setTone] = useState('')
  const { activeBrandId } = useActiveBrand()
  const [brandId, setBrandId] = useState<string | null>(() => params.get('marca') ?? activeBrandId)
  const [projectId, setProjectId] = useState<string | null>(() => params.get('projeto'))
  const [result, setResult] = useState<TextGeneration | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestKey = useIdempotencyKey()

  // Pedido diferente, chave nova; o aviso some quando a pessoa mexe.
  useEffect(() => {
    setError(null)
    requestKey.rotate()
  }, [brief, channel, format, goal, length, tone, brandId, projectId, info.tool, requestKey])

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
        format: info.formats ? format : undefined,
        goal: goal ?? undefined,
        length: length ?? undefined,
        tone: tone.trim() || undefined,
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
    format,
    setFormat,
    goal,
    setGoal,
    length,
    setLength,
    tone,
    setTone,
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
