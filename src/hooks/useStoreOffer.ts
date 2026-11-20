import { useCallback, useEffect, useState } from 'react'
import { errorMessage, getStoreOffer, type StoreOffer } from '@/lib/api'

export type StoreOfferState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly offer: StoreOffer }

/** O que o checkout da loja mostra para um produto. `reload` tenta de novo depois de um erro. */
export function useStoreOffer(slug: string): StoreOfferState & { readonly reload: () => void } {
  const [state, setState] = useState<StoreOfferState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setState({ kind: 'loading' })
    getStoreOffer(slug)
      .then((offer) => !cancelled && setState({ kind: 'ready', offer }))
      .catch((error: unknown) => !cancelled && setState({ kind: 'error', message: errorMessage(error) }))
    return () => {
      cancelled = true
    }
  }, [slug, attempt])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])
  return { ...state, reload }
}
