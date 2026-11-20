// Quanto o pedido custa no checkout da loja, com a mesma conta de parcelas das functions
// (supabase/functions/_shared/installments.ts). O servidor recalcula e recusa se não bater.

import { installmentTable, type InstallmentOption } from '../../supabase/functions/_shared/installments'
import type { StoreOffer } from '@/lib/api'

export type { InstallmentOption }

export interface CheckoutQuote {
  readonly subtotalCents: number
  readonly options: readonly InstallmentOption[]
  /** A opção escolhida; cai para a maior disponível se o pedido diminuir. */
  readonly selected: InstallmentOption
}

export function quoteCheckout(offer: StoreOffer, bumps: ReadonlySet<string>, installments: number): CheckoutQuote {
  const subtotalCents =
    offer.product.priceCents + offer.bumps.filter((bump) => bumps.has(bump.slug)).reduce((total, bump) => total + bump.priceCents, 0)
  const options = installmentTable(subtotalCents, offer.maxInstallments, offer.interestMonthly)
  const selected = options.find((option) => option.count === installments) ?? options[options.length - 1]!
  return { subtotalCents, options, selected }
}

/** "3x de R$ 35,35" ou "3x de R$ 33,34 sem juros". */
export function installmentLabel(option: InstallmentOption, format: (cents: number) => string): string {
  if (option.count === 1) return `À vista: ${format(option.totalCents)}`
  return `${option.count}x de ${format(option.installmentCents)}${option.interestFree ? ' sem juros' : ` (total ${format(option.totalCents)})`}`
}
