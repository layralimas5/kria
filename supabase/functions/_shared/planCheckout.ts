// O que o navegador pode mandar no checkout próprio dos planos (docs/checkout-planos.md). A conta de
// quanto se paga hoje fica em planQuote.ts, sem zod, para o front importar o mesmo arquivo.

import { z } from 'npm:zod@3'
import { buyerSchema, cardSchema, SLUG } from './storeCheckout.ts'

/** O e-mail é o da conta: não vem do formulário. */
const planBuyerSchema = buyerSchema.omit({ email: true })

const common = {
  action: z.literal('pay'),
  plan: SLUG,
  bumps: z.array(SLUG).max(3).default([]),
  buyer: planBuyerSchema,
  expectedTotalCents: z.number().int().positive(),
}

export const planPayBodySchema = z.discriminatedUnion('method', [
  z.object({ ...common, method: z.literal('pix') }),
  z.object({
    ...common,
    method: z.literal('card'),
    card: cardSchema.refine((card) => card.installments === 1, { message: 'O plano é cobrado à vista, todo mês.' }),
  }),
])

export type PlanPayBody = z.infer<typeof planPayBodySchema>
