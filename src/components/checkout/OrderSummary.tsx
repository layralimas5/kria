import { formatBRL } from '@/domain/format'
import type { InstallmentOption } from '@/domain/storeQuote'
import type { StoreOffer } from '@/lib/api'

interface OrderSummaryProps {
  readonly offer: StoreOffer
  readonly bumps: ReadonlySet<string>
  readonly subtotalCents: number
  readonly selected: InstallmentOption
}

/** Resumo do pedido: cada produto, juros (se houver) e o total que vai ser cobrado. */
export function OrderSummary({ offer, bumps, subtotalCents, selected }: OrderSummaryProps) {
  const chosen = offer.bumps.filter((bump) => bumps.has(bump.slug))
  const interestCents = selected.totalCents - subtotalCents

  return (
    <section aria-labelledby="order-summary" className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 id="order-summary" className="text-base font-semibold text-zinc-900">
        Resumo do pedido
      </h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        <li className="flex justify-between gap-4">
          <span className="text-zinc-600">{offer.product.name}</span>
          <span className="tabular-nums text-zinc-900">{formatBRL(offer.product.priceCents)}</span>
        </li>
        {chosen.map((bump) => (
          <li key={bump.slug} className="flex justify-between gap-4">
            <span className="text-zinc-600">{bump.name}</span>
            <span className="tabular-nums text-zinc-900">{formatBRL(bump.priceCents)}</span>
          </li>
        ))}
        {interestCents > 0 && (
          <li className="flex justify-between gap-4">
            <span className="text-zinc-500">Juros do parcelamento ({selected.count}x)</span>
            <span className="tabular-nums text-zinc-700">{formatBRL(interestCents)}</span>
          </li>
        )}
      </ul>
      <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-zinc-200 pt-4">
        <span className="text-sm font-semibold text-zinc-900">Total</span>
        <span className="text-right">
          <span className="block text-2xl font-bold tabular-nums text-zinc-900">{formatBRL(selected.totalCents)}</span>
          {selected.count > 1 && (
            <span className="block text-[13px] text-zinc-500">
              em {selected.count}x de {formatBRL(selected.installmentCents)}
            </span>
          )}
        </span>
      </div>
    </section>
  )
}
