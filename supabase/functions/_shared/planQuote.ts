// Quanto se paga hoje no checkout próprio dos planos (docs/checkout-planos.md). Sem rede, sem banco e sem
// dependência: a function e o front usam o mesmo arquivo. Testado em planCheckout.test.ts.
//
// Plano é mensal e à vista (o cartão fica guardado no Asaas para renovar). Os "leve junto" são produtos da
// loja com `offer_on_plans`, pelo preço de oferta (`bump_price_cents`), pagos uma vez só.

export interface PlanBumpProduct {
  readonly slug: string
  readonly name: string
  readonly price_cents: number
  readonly bump_price_cents: number | null
}

export interface PlanBumpLine {
  readonly slug: string
  readonly name: string
  readonly priceCents: number
}

export interface PlanQuote {
  readonly planCents: number
  readonly bumps: readonly PlanBumpLine[]
  readonly bumpsCents: number
  /** O que sai hoje: primeira mensalidade + extras. */
  readonly totalCents: number
}

/** Quanto a pessoa paga hoje. "Leve junto" que não está na oferta é recusado. */
export function quotePlanOrder(planCents: number, offered: readonly PlanBumpProduct[], chosen: readonly string[]): PlanQuote {
  const unique = [...new Set(chosen)]
  const bumps = unique.map((slug) => {
    const product = offered.find((item) => item.slug === slug)
    if (!product) throw new Error('bump_not_offered')
    return { slug, name: product.name, priceCents: product.bump_price_cents ?? product.price_cents }
  })
  const bumpsCents = bumps.reduce((total, line) => total + line.priceCents, 0)
  return { planCents, bumps, bumpsCents, totalCents: planCents + bumpsCents }
}

/**
 * Pix com extras: a primeira mensalidade carrega o valor dos extras. Quando ela é paga, o webhook separa:
 * o plano registra só a parte dele e o pedido da loja fica com o resto. Nunca negativo.
 */
export function splitFirstPayment(paidCents: number, storeOrderCents: number): { readonly planCents: number; readonly storeCents: number } {
  const storeCents = Math.min(Math.max(storeOrderCents, 0), paidCents)
  return { planCents: paidCents - storeCents, storeCents }
}
