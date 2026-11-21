import clsx from 'clsx'
import { ArrowRight, Check } from 'lucide-react'
import { formatBRL } from '@/domain/format'
import type { StoreBump } from '@/lib/api'

interface OrderBumpCardProps {
  readonly bump: StoreBump
  readonly checked: boolean
  readonly onToggle: () => void
}

/** "Leve junto" (order bump): outro produto entra no mesmo pagamento com um clique. */
export function OrderBumpCard({ bump, checked, onToggle }: OrderBumpCardProps) {
  const discounted = bump.priceCents < bump.fullPriceCents
  return (
    <label
      className={clsx(
        'block cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition-colors',
        'has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-amber-500/30',
        checked ? 'border-emerald-600 bg-emerald-50' : 'border-amber-500 bg-amber-50/70 hover:bg-amber-50',
      )}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="sr-only" />
      <span className="flex gap-4 p-4">
        {bump.coverUrl && (
          <img src={bump.coverUrl} alt="" loading="lazy" className="h-[100px] w-20 shrink-0 rounded-lg object-cover object-top" width={80} height={100} />
        )}
        <span className="min-w-0 flex-1">
          <span className="inline-block rounded bg-amber-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black">
            Oferta só nesta página
          </span>
          <span className="mt-1.5 block text-[15px] font-semibold leading-snug text-zinc-900">{bump.name}</span>
          {bump.pitch && <span className="mt-1 block text-[13px] leading-relaxed text-zinc-600">{bump.pitch}</span>}
          <span className="mt-2 flex items-baseline gap-2 text-sm">
            {discounted && <s className="text-zinc-500">{formatBRL(bump.fullPriceCents)}</s>}
            <strong className="text-base text-zinc-900">{formatBRL(bump.priceCents)}</strong>
          </span>
        </span>
      </span>
      <span
        className={clsx(
          'flex items-center gap-3 px-4 py-3 text-sm font-bold transition-colors',
          checked ? 'bg-emerald-700 text-white' : 'bg-amber-400 text-black',
        )}
      >
        <span
          aria-hidden="true"
          className={clsx('grid size-5 shrink-0 place-items-center rounded border-2', checked ? 'border-white bg-white text-emerald-700' : 'border-black/70 bg-white')}
        >
          {checked && <Check className="size-3.5" strokeWidth={3.5} />}
        </span>
        {checked ? 'Adicionado ao pedido' : 'Sim, quero levar junto'}
        {!checked && <ArrowRight className="ml-auto size-4 motion-safe:animate-pulse" aria-hidden="true" />}
      </span>
    </label>
  )
}
