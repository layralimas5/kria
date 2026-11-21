import { useEffect, useState } from 'react'
import { getPlanCheckoutStatus } from '@/lib/planCheckoutApi'

const POLL_MS = 4000
/** Depois disso a pessoa recarrega: o plano entra do mesmo jeito quando o Pix cair (webhook). */
const MAX_POLL_MS = 15 * 60 * 1000

type Status = Awaited<ReturnType<typeof getPlanCheckoutStatus>>

/** Status da assinatura enquanto o Pix não cai. Erro de rede só espera a próxima volta. */
export function usePlanPixStatus(subscriptionId: string): Status {
  const [status, setStatus] = useState<Status>('pending')

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const startedAt = Date.now()

    async function poll() {
      try {
        const next = await getPlanCheckoutStatus(subscriptionId)
        if (cancelled) return
        setStatus(next)
        if (next !== 'pending') return
      } catch (pollError) {
        console.warn('status da assinatura', pollError)
      }
      if (!cancelled && Date.now() - startedAt < MAX_POLL_MS) timer = setTimeout(() => void poll(), POLL_MS)
    }

    timer = setTimeout(() => void poll(), POLL_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [subscriptionId])

  return status
}
