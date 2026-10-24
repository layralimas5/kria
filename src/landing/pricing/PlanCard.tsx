import clsx from 'clsx'
import { Check, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatBRL } from '@/domain/format'
import { track } from '@/lib/analytics'
import type { MarketingPlan } from './catalog'
import { CTA_LABEL } from '../content'
import { CARD_HOVER } from '../styles'

export function subscribePath(slug: string): string {
  return `/assinar/${slug}`
}

export function PlanCard({ plan }: { readonly plan: MarketingPlan }) {
  const available = plan.features.filter((feature) => !feature.soon)
  const upcoming = plan.features.filter((feature) => feature.soon)
  const titleId = `plano-${plan.slug}`
  const destination = subscribePath(plan.slug)

  return (
    <article
      aria-labelledby={titleId}
      className={clsx(
        'relative flex h-full flex-col rounded-2xl border p-6 md:p-7',
        CARD_HOVER,
        plan.highlight ? 'border-accent/70 bg-[linear-gradient(180deg,rgba(124,58,237,0.09),transparent_45%)] bg-panel' : 'border-white/[0.07] bg-panel',
      )}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-accent-ink">
          {plan.badge}
        </span>
      )}
      <h3 id={titleId} className="font-landing text-xl font-bold uppercase tracking-[-0.02em] text-zinc-50">
        {plan.name}
      </h3>
      <p className="mt-1.5 min-h-[2.5rem] text-pretty text-sm text-zinc-400">{plan.tagline}</p>

      <p className="mt-5 flex items-baseline gap-1">
        <span className="font-landing text-[2.75rem] font-bold leading-none tracking-[-0.045em] text-zinc-50">
          {formatBRL(plan.price_cents)}
        </span>
        <span className="text-sm text-zinc-500">/mês</span>
      </p>
      <p className="mt-2 text-sm text-zinc-300">
        <span className="font-semibold text-accent-soft">{plan.monthly_credits.toLocaleString('pt-BR')} créditos</span>{' '}
        todo mês
      </p>
      <p className="mt-1 text-[13px] text-zinc-400">Renovam a cada cobrança paga, não acumulam.</p>
      {plan.highlight_reason && <p className="mt-3 rounded-xl bg-accent/10 px-3 py-2 text-[13px] text-zinc-200 ring-1 ring-accent/20">{plan.highlight_reason}</p>}

      <Link
        to={destination}
        onClick={() => track({ name: 'cta_click', params: { cta_id: `plan_${plan.slug}`, destination } })}
        className={clsx(
          'mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition-[transform,box-shadow,background-color] duration-150 active:translate-y-[3px] active:shadow-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-stage',
          plan.highlight
            ? 'bg-accent text-accent-ink shadow-[0_3px_0_0_var(--color-accent-deep)] hover:bg-accent-strong'
            : 'bg-zinc-50 text-zinc-950 shadow-[0_3px_0_0_#a1a1aa] hover:bg-white',
        )}
      >
        {CTA_LABEL}
      </Link>

      <ul className="mt-6 space-y-2.5 border-t border-white/[0.06] pt-5 text-sm" aria-label={`O que vem no ${plan.name}`}>
        {available.map((feature) => (
          <li key={feature.label} className="flex gap-2.5 text-zinc-200">
            <Check className="mt-0.5 size-4 shrink-0 text-accent-soft" aria-hidden="true" />
            {feature.label}
          </li>
        ))}
      </ul>
      {upcoming.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm" aria-label="Chegando em breve">
          {upcoming.map((feature) => (
            <li key={feature.label} className="flex items-center gap-2.5 text-zinc-500">
              <Clock className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{feature.label}</span>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Em breve</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
