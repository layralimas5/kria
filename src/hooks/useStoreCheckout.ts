import { useMemo, useState } from 'react'
import { quoteCheckout, sameEmail, type CheckoutQuote } from '@/domain/storeQuote'
import { track } from '@/lib/analytics'
import { errorMessage, payStoreOrder, type StoreBuyer, type StoreOffer, type StorePayment } from '@/lib/api'

export type PaymentMethod = 'card' | 'pix'

export interface CardForm {
  readonly holderName: string
  readonly number: string
  /** MM/AA, como a pessoa digita. */
  readonly expiry: string
  readonly ccv: string
  readonly postalCode: string
  readonly addressNumber: string
}

const EMPTY_BUYER: StoreBuyer = { name: '', email: '', cpf: '', phone: '' }
const EMPTY_CARD: CardForm = { holderName: '', number: '', expiry: '', ccv: '', postalCode: '', addressNumber: '' }

export interface StoreCheckout {
  readonly buyer: StoreBuyer
  readonly setBuyer: (buyer: StoreBuyer) => void
  readonly emailConfirm: string
  readonly setEmailConfirm: (email: string) => void
  /** Já houve uma tentativa de envio: os campos mostram os erros mesmo sem a pessoa ter saído deles. */
  readonly attempted: boolean
  readonly method: PaymentMethod
  readonly setMethod: (method: PaymentMethod) => void
  readonly card: CardForm
  readonly setCard: (card: CardForm) => void
  readonly installments: number
  readonly setInstallments: (count: number) => void
  readonly bumps: ReadonlySet<string>
  readonly toggleBump: (slug: string) => void
  /** Pix é sempre à vista; no cartão vale a parcela escolhida. */
  readonly quote: CheckoutQuote
  readonly totalCents: number
  readonly submitting: boolean
  readonly error: string | null
  readonly submit: () => Promise<string | null>
}

function payment(method: PaymentMethod, card: CardForm, installments: number): StorePayment {
  if (method === 'pix') return { method }
  const [month = '', year = ''] = card.expiry.split('/')
  return {
    method,
    card: {
      holderName: card.holderName,
      number: card.number,
      expiryMonth: month,
      expiryYear: year,
      ccv: card.ccv,
      postalCode: card.postalCode,
      addressNumber: card.addressNumber,
      installments,
    },
  }
}

/** Estado do checkout da loja. `submit` devolve o token do pedido (para a página do pedido) ou `null` no erro. */
export function useStoreCheckout(offer: StoreOffer): StoreCheckout {
  const [buyer, setBuyer] = useState<StoreBuyer>(EMPTY_BUYER)
  const [emailConfirm, setEmailConfirm] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('card')
  const [card, setCard] = useState<CardForm>(EMPTY_CARD)
  const [installments, setInstallments] = useState(1)
  const [bumps, setBumps] = useState<ReadonlySet<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const quote = useMemo(() => quoteCheckout(offer, bumps, method === 'card' ? installments : 1), [offer, bumps, method, installments])

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

  async function submit(): Promise<string | null> {
    setAttempted(true)
    if (!sameEmail(buyer.email, emailConfirm)) {
      setError('Confira o e-mail: os dois campos precisam ser iguais, porque é nele que o acesso chega.')
      return null
    }
    setSubmitting(true)
    setError(null)
    track({ name: 'add_payment_info', params: { product: offer.product.slug, method, value: quote.selected.totalCents / 100 } })
    try {
      const result = await payStoreOrder({
        product: offer.product.slug,
        bumps: [...bumps],
        buyer,
        payment: payment(method, card, quote.selected.count),
        expectedTotalCents: quote.selected.totalCents,
      })
      return result.token
    } catch (payError) {
      setError(errorMessage(payError))
      return null
    } finally {
      setSubmitting(false)
    }
  }

  return {
    buyer,
    setBuyer,
    emailConfirm,
    setEmailConfirm,
    attempted,
    method,
    setMethod,
    card,
    setCard,
    installments: quote.selected.count,
    setInstallments,
    bumps,
    toggleBump,
    quote,
    totalCents: quote.selected.totalCents,
    submitting,
    error,
    submit,
  }
}
