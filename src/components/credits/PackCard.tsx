import clsx from 'clsx'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { pricePerCredit, type ModelYield } from '@/domain/credits'
import { formatBRL } from '@/domain/format'
import type { CreditPack } from '@/domain/types'

interface PackCardProps {
  readonly pack: CreditPack
  readonly yields: readonly ModelYield[]
  /** Economia em % contra o pacote mais caro por crédito. */
  readonly savings: number
  readonly busy: boolean
  readonly onBuy: () => void
}

export function PackCard({ pack, yields, savings, busy, onBuy }: PackCardProps) {
  const lines = yields.filter((item) => item.count > 0).slice(0, 3)
  return (
    <article
      className={clsx(
        'card-premium card-hover relative isolate flex flex-col overflow-hidden rounded-3xl p-6',
        pack.highlight && 'ring-1 ring-accent/50 shadow-[0_18px_50px_-24px_rgb(124_58_237/0.8)]',
      )}
    >
      {pack.highlight && <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-accent/[0.16] to-transparent" />}
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h3 className="font-headline text-xl text-zinc-100">{pack.name}</h3>
        <div className="flex gap-1.5">
          {savings > 0 && <span className="rounded-md bg-emerald-400/10 px-1.5 py-0.5 text-[11px] font-bold text-emerald-300">−{savings}% por crédito</span>}
          {pack.highlight && <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent-ink">Mais escolhido</span>}
        </div>
      </div>

      <p className="mt-5 flex items-baseline gap-2">
        <span className="font-headline text-5xl tabular-nums tracking-tight text-zinc-50">{pack.credits.toLocaleString('pt-BR')}</span>
        <span className="text-sm font-semibold text-zinc-400">créditos</span>
      </p>
      <p className="mt-3 text-2xl font-bold text-zinc-50">{formatBRL(pack.price_cents)}</p>
      <p className="text-xs text-zinc-500">{pricePerCredit(pack)} por crédito · pagamento único</p>

      {lines.length > 0 && (
        <ul className="mt-5 space-y-2 border-t border-white/[0.06] pt-5 text-sm text-zinc-300">
          {lines.map((item, index) => (
            <li key={item.slug} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-accent-soft" aria-hidden="true" />
              <span>
                {index === 0 ? 'Até' : 'ou até'} <strong className="font-semibold tabular-nums text-zinc-100">{item.count.toLocaleString('pt-BR')}</strong> {item.kind === 'video' ? 'vídeos' : 'imagens'} {item.name}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Button className="mt-6 min-h-11" variant={pack.highlight ? 'primary' : 'secondary'} onClick={onBuy} loading={busy}>
        Comprar {pack.name}
      </Button>
    </article>
  )
}
