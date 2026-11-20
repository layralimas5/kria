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
    <section aria-labelledby="order-summary" className="rounded-2xl border border-white/[0.08] bg-surface p-5">
      <h2 id="order-summary" className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500">
        Resumo do pedido
      </h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        <li className="flex justify-between gap-4">
          <span className="text-zinc-300">{offer.product.name}</span>
          <span className="tabular-nums text-zinc-100">{formatBRL(offer.product.priceCents)}</span>
        </li>
        {chosen.map((bump) => (
          <li key={bump.slug} className="flex justify-between gap-4">
            <span className="text-zinc-300">{bump.name}</span>
            <span className="tabular-nums text-zinc-100">{formatBRL(bump.priceCents)}</span>
          </li>
        ))}
        {interestCents > 0 && (
          <li className="flex justify-between gap-4">
            <span className="text-zinc-400">Juros do parcelamento ({selected.count}x)</span>
            <span className="tabular-nums text-zinc-300">{formatBRL(interestCents)}</span>
          </li>
        )}
      </ul>
      <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-white/[0.08] pt-4">
        <span className="text-sm font-semibold text-zinc-200">Total</span>
        <span className="text-right">
          <span className="block text-xl font-bold tabular-nums text-zinc-50">{formatBRL(selected.totalCents)}</span>
          {selected.count > 1 && (
            <span className="block text-xs text-zinc-400">
              em {selected.count}x de {formatBRL(selected.installmentCents)}
            </span>
          )}
        </span>
      </div>
    </section>
  )
}
