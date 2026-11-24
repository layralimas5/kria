import { useEffect, useState } from 'react'
import { errorMessage } from '@/lib/api'
import { getPlanOffer, type PlanOffer } from '@/lib/planCheckoutApi'

export type PlanOfferState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly offer: PlanOffer }

/**
 * O que o checkout de um plano mostra: plano, "leve junto" e o e-mail da conta. Abre sem login também;
 * `viewerId` muda quando a pessoa cria a conta ou entra, e a oferta é lida de novo com o e-mail dela.
 */
export function usePlanOffer(slug: string, viewerId: string | null): PlanOfferState {
  const [state, setState] = useState<PlanOfferState>({ kind: 'loading' })

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setState({ kind: 'loading' })
    getPlanOffer(slug)
      .then((offer) => !cancelled && setState({ kind: 'ready', offer }))
      .catch((error: unknown) => !cancelled && setState({ kind: 'error', message: errorMessage(error) }))
    return () => {
      cancelled = true
    }
  }, [slug, viewerId])

  return state
}
