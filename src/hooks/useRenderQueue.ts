import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api'
import { failExport, finishExport, startExport } from '@/lib/multiplierApi'
import { renderVariation, RenderError, type RenderInput, type RenderOutput } from '@/lib/render/compositor'

export type JobStatus = 'queued' | 'rendering' | 'done' | 'failed' | 'canceled'

export interface RenderJob {
  readonly status: JobStatus
  readonly progress: number
  readonly attempts: number
  readonly output: RenderOutput | null
  /** Endereço local para a prévia; some quando a tela fecha. */
  readonly url: string | null
  readonly error: string | null
}

export const MAX_ATTEMPTS = 3

type Prepared = Omit<RenderInput, 'signal' | 'onProgress'>

interface QueueOptions {
  /** Monta a entrada da variação na hora de começar (arquivos e estilo do momento). */
  readonly prepare: (variationId: string) => Prepared
  readonly onFinished: (variationId: string, ok: boolean) => void
  /** Cota do mês mudou (exportação reservada ou devolvida). */
  readonly onQuotaChange?: () => void
}

function failureMessage(error: unknown): string {
  if (error instanceof RenderError || error instanceof ApiError) return error.message
  console.error('render', error)
  return 'A montagem falhou. Tente de novo; se repetir, troque o arquivo do take.'
}

/**
 * Fila de montagem: um vídeo por vez (a gravação é em tempo real e disputa a mesma tela),
 * com progresso, cancelamento e nova tentativa por variação. Uma falha não para o lote.
 */
export function useRenderQueue({ prepare, onFinished, onQuotaChange }: QueueOptions) {
  const [jobs, setJobs] = useState<Readonly<Record<string, RenderJob>>>({})
  const jobsRef = useRef(jobs)
  jobsRef.current = jobs
  const active = useRef<{ id: string; controller: AbortController } | null>(null)
  const options = useRef({ prepare, onFinished, onQuotaChange })
  options.current = { prepare, onFinished, onQuotaChange }

  const patch = useCallback((id: string, changes: Partial<RenderJob>) => {
    setJobs((current) => {
      const job = current[id]
      return job ? { ...current, [id]: { ...job, ...changes } } : current
    })
  }, [])

  const runJob = useCallback(
    async (id: string) => {
      const controller = new AbortController()
      active.current = { id, controller }
      const attempts = (jobsRef.current[id]?.attempts ?? 0) + 1
      patch(id, { status: 'rendering', progress: 0, attempts, error: null })
      let lastProgress = 0
      // Cada exportação conta na cota do mês: reserva antes, fecha no fim, devolve se falhar.
      let exportId: string | null = null
      try {
        const prepared = options.current.prepare(id)
        exportId = (await startExport(id, crypto.randomUUID())).id
        options.current.onQuotaChange?.()
        const startedAt = performance.now()
        const output = await renderVariation({
          ...prepared,
          signal: controller.signal,
          onProgress: (fraction) => {
            // Atualiza a tela a cada 2%, não a cada quadro.
            if (fraction - lastProgress >= 0.02 || fraction === 1) {
              lastProgress = fraction
              patch(id, { progress: fraction })
            }
          },
        })
        void finishExport(exportId, {
          durationSeconds: prepared.timeline.duration,
          width: prepared.timeline.width,
          height: prepared.timeline.height,
          renderMs: performance.now() - startedAt,
          bytes: output.blob.size,
        })
        patch(id, { status: 'done', progress: 1, output, url: URL.createObjectURL(output.blob) })
        options.current.onFinished(id, true)
      } catch (error) {
        if (exportId) {
          void failExport(exportId).then(() => options.current.onQuotaChange?.())
        }
        if (controller.signal.aborted) {
          patch(id, { status: 'canceled', progress: 0 })
        } else {
          patch(id, { status: 'failed', error: failureMessage(error) })
          options.current.onFinished(id, false)
        }
      } finally {
        active.current = null
      }
    },
    [patch],
  )

  // Começa o próximo da fila quando nada está montando.
  useEffect(() => {
    if (active.current) return
    const next = Object.entries(jobs).find(([, job]) => job.status === 'queued')
    if (next) void runJob(next[0])
  }, [jobs, runJob])

  // Libera as prévias e para a montagem ao sair da tela.
  useEffect(
    () => () => {
      active.current?.controller.abort()
      Object.values(jobsRef.current).forEach((job) => job.url && URL.revokeObjectURL(job.url))
    },
    [],
  )

  const enqueue = useCallback((ids: readonly string[]) => {
    setJobs((current) => {
      const next = { ...current }
      for (const id of ids) {
        const job = current[id]
        if (job?.status === 'rendering' || job?.status === 'queued') continue
        if (job?.url) URL.revokeObjectURL(job.url)
        next[id] = { status: 'queued', progress: 0, attempts: job?.status === 'failed' ? job.attempts : 0, output: null, url: null, error: null }
      }
      return next
    })
  }, [])

  const cancel = useCallback(
    (id: string) => {
      if (active.current?.id === id) active.current.controller.abort()
      else if (jobsRef.current[id]?.status === 'queued') patch(id, { status: 'canceled' })
    },
    [patch],
  )

  const cancelAll = useCallback(() => {
    setJobs((current) =>
      Object.fromEntries(Object.entries(current).map(([id, job]) => [id, job.status === 'queued' ? { ...job, status: 'canceled' as const } : job])),
    )
    active.current?.controller.abort()
  }, [])

  const retry = useCallback(
    (id: string) => {
      const job = jobsRef.current[id]
      if (!job || job.attempts >= MAX_ATTEMPTS) return
      enqueue([id])
    },
    [enqueue],
  )

  const busy = Object.values(jobs).some((job) => job.status === 'rendering' || job.status === 'queued')
  return { jobs, enqueue, cancel, cancelAll, retry, busy }
}
