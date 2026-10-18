import clsx from 'clsx'
import { Check } from 'lucide-react'
import { formatBRL } from '@/domain/format'
import { pricePerCredit } from '@/domain/plans'
import type { Plan } from '@/domain/types'
import { Button } from '../ui/Button'

interface PlanCardProps {
  readonly plan: Plan
  readonly current: boolean
  /** Já existe outro plano ativo: o botão vira "trocar". */
  readonly switching: boolean
  readonly busy: boolean
  readonly disabled: boolean
  readonly onSubscribe: () => void
}

export function PlanCard({ plan, current, switching, busy, disabled, onSubscribe }: PlanCardProps) {
  const perCredit = pricePerCredit(plan)
  return (
    <article
      className={clsx(
        'relative flex flex-col rounded-3xl p-6 ring-1',
        plan.highlight ? 'bg-gradient-to-b from-accent/[0.12] to-surface ring-accent/60' : 'bg-surface ring-white/[0.06]',
      )}
    >
      {plan.highlight && (
        <span className="absolute -top-3 left-6 rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold uppercase italic tracking-wide text-accent-ink">
          Mais escolhido
        </span>
      )}
      <h3 className="font-headline text-xl text-zinc-100">{plan.name}</h3>
      <p className="mt-1 text-sm text-zinc-400">{plan.description}</p>
      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums text-zinc-50">{formatBRL(plan.price_cents)}</span>
        <span className="text-sm text-zinc-500">/mês</span>
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {plan.monthly_credits.toLocaleString('pt-BR')} créditos por mês
        {perCredit !== null && ` · R$ ${perCredit.toFixed(2).replace('.', ',')} por crédito`}
      </p>

      <ul className="mt-5 flex-1 space-y-2 border-t border-white/[0.06] pt-5 text-sm text-zinc-300">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>

      <Button
        className="mt-6 min-h-11"
        variant={plan.highlight && !current ? 'primary' : 'secondary'}
        onClick={onSubscribe}
        loading={busy}
        disabled={current || disabled}
      >
        {current ? 'Seu plano atual' : switching ? `Trocar para ${plan.name}` : `Assinar ${plan.name}`}
      </Button>
    </article>
  )
}
