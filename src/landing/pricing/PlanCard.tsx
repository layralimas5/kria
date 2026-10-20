import clsx from 'clsx'
import { Check, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatBRL } from '@/domain/format'
import type { SubscriptionPlan } from '@/domain/plans'
import { SIGNUP_PATH } from '../content'
import { CARD_HOVER } from '../styles'
import { isFreePlan } from './freePlan'

export function subscribePath(slug: string): string {
  return `/assinar/${slug}`
}

export function PlanCard({ plan }: { readonly plan: SubscriptionPlan }) {
  const available = plan.features.filter((feature) => !feature.soon)
  const upcoming = plan.features.filter((feature) => feature.soon)
  const titleId = `plano-${plan.slug}`
  const free = isFreePlan(plan)

  return (
    <article
      aria-labelledby={titleId}
      className={clsx(
        'relative flex h-full flex-col rounded-2xl border p-6 md:p-7',
        CARD_HOVER,
        plan.highlight ? 'border-accent/70 bg-[linear-gradient(180deg,rgba(255,107,44,0.09),transparent_45%)] bg-panel' : 'border-white/[0.07] bg-panel',
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
          {free ? 'R$ 0' : formatBRL(plan.price_cents)}
        </span>
        {!free && <span className="text-sm text-zinc-500">/mês</span>}
      </p>
      <p className="mt-2 text-sm text-zinc-300">
        <span className="font-semibold text-accent">{plan.monthly_credits.toLocaleString('pt-BR')} créditos</span>{' '}
        {free ? 'ao criar a conta' : 'todo mês'}
      </p>

      <Link
        to={free ? SIGNUP_PATH : subscribePath(plan.slug)}
        className={clsx(
          'mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition-[transform,box-shadow,background-color] duration-150 active:translate-y-[3px] active:shadow-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-stage',
          plan.highlight
            ? 'bg-accent text-accent-ink shadow-[0_3px_0_0_var(--color-accent-deep)] hover:bg-accent-strong'
            : 'bg-zinc-50 text-zinc-950 shadow-[0_3px_0_0_#a1a1aa] hover:bg-white',
        )}
      >
        {plan.cta_label}
      </Link>

      <ul className="mt-6 space-y-2.5 border-t border-white/[0.06] pt-5 text-sm" aria-label={`O que vem no ${plan.name}`}>
        {available.map((feature) => (
          <li key={feature.label} className="flex gap-2.5 text-zinc-200">
            <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
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

export function PlanCardSkeleton() {
  return (
    <div className="h-[560px] animate-pulse rounded-2xl border border-white/[0.06] bg-panel p-7" aria-hidden="true">
      <div className="h-5 w-32 rounded bg-white/[0.06]" />
      <div className="mt-3 h-4 w-48 rounded bg-white/[0.04]" />
      <div className="mt-8 h-10 w-40 rounded bg-white/[0.07]" />
      <div className="mt-6 h-11 w-full rounded-xl bg-white/[0.06]" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-4 rounded bg-white/[0.04]" style={{ width: `${85 - index * 7}%` }} />
        ))}
      </div>
    </div>
  )
}
