import clsx from 'clsx'
import { Check } from 'lucide-react'
import { formatBRL } from '@/domain/format'
import type { StoreBump } from '@/lib/api'

interface OrderBumpCardProps {
  readonly bump: StoreBump
  readonly checked: boolean
  readonly onToggle: () => void
}

/** "Leve junto": outro produto entra no mesmo pagamento com um clique. */
export function OrderBumpCard({ bump, checked, onToggle }: OrderBumpCardProps) {
  const discounted = bump.priceCents < bump.fullPriceCents
  return (
    <label
      className={clsx(
        'flex cursor-pointer gap-4 rounded-2xl border-2 border-dashed p-4 transition-colors',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
        checked ? 'border-hot/70 bg-hot/[0.07]' : 'border-hot/30 bg-surface hover:border-hot/50',
      )}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="sr-only" />
      <span
        aria-hidden="true"
        className={clsx(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors',
          checked ? 'border-hot bg-hot text-black' : 'border-white/25 bg-surface-2',
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      {bump.coverUrl && (
        <img src={bump.coverUrl} alt="" loading="lazy" className="size-16 shrink-0 rounded-lg object-cover" width={64} height={64} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold uppercase tracking-wide text-hot">Sim, quero levar junto</span>
        <span className="mt-1 block text-sm font-semibold text-zinc-50">{bump.name}</span>
        {bump.pitch && <span className="mt-1 block text-[13px] leading-relaxed text-zinc-400">{bump.pitch}</span>}
        <span className="mt-2 flex items-baseline gap-2 text-sm">
          {discounted && <s className="text-zinc-500">{formatBRL(bump.fullPriceCents)}</s>}
          <strong className="text-zinc-50">+ {formatBRL(bump.priceCents)}</strong>
        </span>
      </span>
    </label>
  )
}
