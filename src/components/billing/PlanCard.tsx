import clsx from 'clsx'
import { Check } from 'lucide-react'
import { formatBRL } from '@/domain/format'
import { isFreePlan, planYield, pricePerCredit, WELCOME_CREDITS } from '@/domain/plans'
import type { Model, Plan } from '@/domain/types'
import { Button } from '../ui/Button'

interface PlanCardProps {
  readonly plan: Plan
  /** Para traduzir os créditos no que o plano rende. */
  readonly models: readonly Model[]
  readonly current: boolean
  /** Já existe outro plano ativo: o botão vira "trocar". */
  readonly switching: boolean
  readonly busy: boolean
  readonly disabled: boolean
  readonly onSubscribe: () => void
}

function buttonLabel(plan: Plan, current: boolean, switching: boolean): string {
  if (current) return 'Seu plano atual'
  if (isFreePlan(plan)) return 'Sem mensalidade'
  return switching ? `Trocar para ${plan.name}` : `Assinar ${plan.name}`
}

export function PlanCard({ plan, models, current, switching, busy, disabled, onSubscribe }: PlanCardProps) {
  const free = isFreePlan(plan)
  const perCredit = pricePerCredit(plan)
  const credits = free ? WELCOME_CREDITS : plan.monthly_credits
  const yields = planYield(plan, models, credits)
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
        <span className="text-3xl font-bold tabular-nums text-zinc-50">{free ? 'Grátis' : formatBRL(plan.price_cents)}</span>
        {!free && <span className="text-sm text-zinc-500">/mês</span>}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {free ? `${credits} créditos de boas-vindas` : `${credits.toLocaleString('pt-BR')} créditos por mês`}
        {perCredit !== null && ` · R$ ${perCredit.toFixed(2).replace('.', ',')} por crédito`}
      </p>
      {yields.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white/[0.03] p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            {free ? 'Dá para gerar' : 'Rende por mês'}, num modelo só
          </p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            {yields.map((item) => (
              <li key={item.model} className="flex items-baseline gap-2">
                <span className="w-9 text-right font-semibold tabular-nums text-zinc-50">{item.count}</span>
                {item.model}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex-1 border-t border-white/[0.06] pt-5">
        <ul className="space-y-2 text-sm text-zinc-300">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-accent-soft" aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <Button
        className="mt-6 min-h-11"
        variant={plan.highlight && !current ? 'primary' : 'secondary'}
        onClick={onSubscribe}
        loading={busy}
        disabled={current || free || disabled}
      >
        {buttonLabel(plan, current, switching)}
      </Button>
    </article>
  )
}
