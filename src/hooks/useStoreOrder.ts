import { useEffect, useState } from 'react'
import { errorMessage, getStoreOrder, type StoreOrder } from '@/lib/api'

const POLL_MS = 4000
/** Pix costuma confirmar em segundos; depois disso a pessoa recarrega ou espera o e-mail. */
const MAX_POLL_MS = 15 * 60 * 1000

export type StoreOrderState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly order: StoreOrder; readonly gaveUp: boolean }

/** Pedido da loja pelo token, perguntando de novo enquanto o pagamento não confirma. */
export function useStoreOrder(token: string): StoreOrderState {
  const [state, setState] = useState<StoreOrderState>({ kind: 'loading' })

  useEffect(() => {
    if (!token) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const startedAt = Date.now()

    async function load() {
      try {
        const order = await getStoreOrder(token)
        if (cancelled) return
        const waiting = order.status === 'pending'
        const gaveUp = waiting && Date.now() - startedAt > MAX_POLL_MS
        setState({ kind: 'ready', order, gaveUp })
        if (waiting && !gaveUp) timer = setTimeout(() => void load(), POLL_MS)
      } catch (loadError) {
        if (!cancelled) setState({ kind: 'error', message: errorMessage(loadError) })
      }
    }

    void load()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [token])

  return state
}
