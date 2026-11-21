import { z } from 'zod'
import { invoke, pixSchema, type StoreCard } from '@/lib/api'

// Checkout próprio dos planos (function `subscribe`, docs/checkout-planos.md).

const bumpSchema = z.object({
  slug: z.string(),
  name: z.string(),
  pitch: z.string().nullable(),
  coverUrl: z.string().url().nullable(),
  priceCents: z.number().int(),
  fullPriceCents: z.number().int(),
})

const planOfferSchema = z.object({
  plan: z.object({
    slug: z.string(),
    name: z.string(),
    tagline: z.string().nullable(),
    priceCents: z.number().int().positive(),
    monthlyCredits: z.number().int(),
    features: z.array(z.string()),
  }),
  bumps: z.array(bumpSchema),
  email: z.string().nullable(),
  alreadySubscribed: z.boolean(),
})

export type PlanOffer = z.infer<typeof planOfferSchema>

export async function getPlanOffer(plan: string): Promise<PlanOffer> {
  return planOfferSchema.parse(await invoke('subscribe', { action: 'offer', plan }))
}

export interface PlanBuyer {
  readonly name: string
  readonly cpf: string
  readonly phone: string
}

export type PlanPayment = { readonly method: 'pix' } | { readonly method: 'card'; readonly card: StoreCard }

export interface PlanPayInput {
  readonly plan: string
  readonly bumps: readonly string[]
  readonly buyer: PlanBuyer
  readonly payment: PlanPayment
  /** O total que a pessoa viu: se o servidor calcular outro, nada é cobrado. */
  readonly expectedTotalCents: number
}

const planPayResultSchema = z.object({
  subscriptionId: z.string().uuid(),
  orderToken: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  totalCents: z.number().int(),
  /** Os extras não entraram (cartão recusado só neles, ou o Asaas não somou no Pix): só o plano foi cobrado. */
  bumpsFailed: z.boolean().default(false),
  pix: pixSchema.optional(),
})

export type PlanPayResult = z.infer<typeof planPayResultSchema>

export async function payPlan(input: PlanPayInput): Promise<PlanPayResult> {
  const data = await invoke('subscribe', {
    action: 'pay',
    method: input.payment.method,
    plan: input.plan,
    bumps: input.bumps,
    buyer: input.buyer,
    ...(input.payment.method === 'card' ? { card: input.payment.card } : {}),
    expectedTotalCents: input.expectedTotalCents,
  })
  return planPayResultSchema.parse(data)
}

const statusSchema = z.object({ status: z.enum(['pending', 'active', 'past_due', 'canceled', 'expired']) })

export async function getPlanCheckoutStatus(subscriptionId: string): Promise<z.infer<typeof statusSchema>['status']> {
  return statusSchema.parse(await invoke('subscribe', { action: 'status', subscription: subscriptionId })).status
}
