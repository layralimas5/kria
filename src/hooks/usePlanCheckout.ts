import { useMemo, useState } from 'react'
import { quotePlanOrder, type PlanQuote } from '../../supabase/functions/_shared/planQuote'
import { cardPayload, EMPTY_CARD, type CardForm, type PaymentMethod } from '@/hooks/useStoreCheckout'
import { track } from '@/lib/analytics'
import { errorMessage } from '@/lib/api'
import { payPlan, type PlanBuyer, type PlanOffer, type PlanPayResult } from '@/lib/planCheckoutApi'

const EMPTY_BUYER: PlanBuyer = { name: '', cpf: '', phone: '' }

export interface PlanCheckout {
  readonly buyer: PlanBuyer
  readonly setBuyer: (buyer: PlanBuyer) => void
  readonly method: PaymentMethod
  readonly setMethod: (method: PaymentMethod) => void
  readonly card: CardForm
  readonly setCard: (card: CardForm) => void
  readonly bumps: ReadonlySet<string>
  readonly toggleBump: (slug: string) => void
  /** Primeira mensalidade + extras: o que sai hoje. */
  readonly quote: PlanQuote
  readonly submitting: boolean
  readonly error: string | null
  readonly submit: () => Promise<PlanPayResult | null>
}

/** Estado do checkout de um plano. `submit` devolve a assinatura criada (e o Pix, se for o caso) ou `null` no erro. */
export function usePlanCheckout(offer: PlanOffer): PlanCheckout {
  const [buyer, setBuyer] = useState<PlanBuyer>(EMPTY_BUYER)
  const [method, setMethod] = useState<PaymentMethod>('card')
  const [card, setCard] = useState<CardForm>(EMPTY_CARD)
  const [bumps, setBumps] = useState<ReadonlySet<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const quote = useMemo(
    () =>
      quotePlanOrder(
        offer.plan.priceCents,
        offer.bumps.map((bump) => ({ slug: bump.slug, name: bump.name, price_cents: bump.fullPriceCents, bump_price_cents: bump.priceCents })),
        [...bumps],
      ),
    [offer, bumps],
  )

  function toggleBump(slug: string) {
    const adding = !bumps.has(slug)
    track({ name: adding ? 'add_to_cart' : 'remove_from_cart', params: { product: slug } })
    setBumps((current) => {
      const next = new Set(current)
      if (adding) next.add(slug)
      else next.delete(slug)
      return next
    })
  }

  async function submit(): Promise<PlanPayResult | null> {
    setSubmitting(true)
    setError(null)
    track({ name: 'add_payment_info', params: { product: offer.plan.slug, method, value: quote.totalCents / 100 } })
    try {
      return await payPlan({
        plan: offer.plan.slug,
        bumps: [...bumps],
        buyer,
        payment: method === 'pix' ? { method } : { method, card: cardPayload(card, 1) },
        expectedTotalCents: quote.totalCents,
      })
    } catch (payError) {
      setError(errorMessage(payError))
      return null
    } finally {
      setSubmitting(false)
    }
  }

  return { buyer, setBuyer, method, setMethod, card, setCard, bumps, toggleBump, quote, submitting, error, submit }
}
