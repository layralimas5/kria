import clsx from 'clsx'
import { Check, Clock } from 'lucide-react'
import { formatBRL } from '@/domain/format'
import { PLAN_TOOL_INFO, PLAN_TOOLS, pricePerCredit } from '@/domain/plans'
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
  const upcoming = PLAN_TOOLS.filter((tool) => plan.tools.includes(tool) && !PLAN_TOOL_INFO[tool].ready)
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

      <div className="mt-5 flex-1 border-t border-white/[0.06] pt-5">
        <ul className="space-y-2 text-sm text-zinc-300">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>
        {upcoming.length > 0 && (
          <>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Chega em breve no plano</p>
            <ul className="mt-2 space-y-2 text-sm text-zinc-400">
              {upcoming.map((tool) => (
                <li key={tool} className="flex items-start gap-2">
                  <Clock className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden="true" />
                  {PLAN_TOOL_INFO[tool].label}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

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
