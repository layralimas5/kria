import clsx from 'clsx'
import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatBRL } from '@/domain/format'
import { track } from '@/lib/analytics'
import { SIGNUP_PATH } from '../content'
import { CARD_HOVER } from '../styles'
import { subscribePath } from './PlanCard'
import type { StorefrontPlan } from './storefront'

const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL

const BUTTON =
  'mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition-[transform,box-shadow,background-color] duration-150 active:translate-y-[3px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-stage'
const ACCENT = 'bg-accent text-accent-ink shadow-[0_3px_0_0_var(--color-accent-deep)] hover:bg-accent-strong'
const LIGHT = 'bg-zinc-50 text-zinc-950 shadow-[0_3px_0_0_#a1a1aa] hover:bg-white'

const number = (value: number) => value.toLocaleString('pt-BR')

function PlanAction({ plan }: { readonly plan: StorefrontPlan }) {
  const tone = plan.highlight ? ACCENT : LIGHT
  if (plan.cta === 'contact') {
    if (!CONTACT_EMAIL) {
      return (
        <p className="mt-6 rounded-xl bg-white/[0.04] px-3 py-3 text-center text-sm text-zinc-400 ring-1 ring-white/[0.06]">Contratação por conversa, em breve</p>
      )
    }
    const subject = encodeURIComponent(`Vynkio ${plan.name}`)
    return (
      <a
        href={`mailto:${CONTACT_EMAIL}?subject=${subject}`}
        onClick={() => track({ name: 'cta_click', params: { cta_id: `plan_${plan.slug}`, destination: 'contact' } })}
        className={clsx(BUTTON, tone)}
      >
        Falar com a gente
      </a>
    )
  }
  const destination = plan.cta === 'signup' ? SIGNUP_PATH : subscribePath(plan.slug)
  return (
    <Link to={destination} onClick={() => track({ name: 'cta_click', params: { cta_id: `plan_${plan.slug}`, destination } })} className={clsx(BUTTON, tone)}>
      {plan.cta === 'signup' ? 'Criar conta grátis' : `Assinar ${plan.name}`}
    </Link>
  )
}

/**
 * Card de plano da vitrine: tudo vem de `storefront_plans`, nada de número fixo aqui. Só o que o plano inclui:
 * `soon_features` e `limits` (itens não incluídos) ficam fora do card.
 */
export function PlanCardV2({ plan }: { readonly plan: StorefrontPlan }) {
  const titleId = `plano-${plan.slug}`
  const free = plan.price_cents === 0

  return (
    <article
      aria-labelledby={titleId}
      className={clsx(
        'relative flex h-full flex-col rounded-2xl border p-6',
        CARD_HOVER,
        plan.highlight ? 'border-accent/70 bg-[linear-gradient(180deg,rgba(124,58,237,0.09),transparent_45%)] bg-panel' : 'border-white/[0.07] bg-panel',
      )}
    >
      {plan.highlight && (
        <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-accent-ink">Recomendado</span>
      )}
      <h3 id={titleId} className="font-landing text-xl font-bold uppercase tracking-[-0.02em] text-zinc-50">
        {plan.name}
      </h3>
      <p className="mt-1.5 min-h-[2.5rem] text-pretty text-sm text-zinc-400">{plan.tagline ?? ''}</p>

      <p className="mt-5 flex items-baseline gap-1">
        <span className="font-landing text-[2.4rem] font-bold leading-none tracking-[-0.045em] text-zinc-50">
          {plan.price_cents === null ? 'Sob consulta' : free ? 'Grátis' : formatBRL(plan.price_cents)}
        </span>
        {plan.price_cents !== null && !free && <span className="text-sm text-zinc-500">/mês</span>}
      </p>

      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-400">{free ? 'Créditos IA' : 'Créditos IA por mês'}</dt>
          <dd className="font-semibold text-accent-soft">{plan.monthly_credits === null ? 'Personalizado' : number(plan.monthly_credits)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-400">Exportações editadas</dt>
          <dd className="font-semibold text-zinc-100">{plan.exports_month === null ? 'Personalizado' : `${number(plan.exports_month)}/mês`}</dd>
        </div>
        {plan.line === 'business' && (
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-400">Usuários</dt>
            <dd className="font-semibold text-zinc-100">{plan.seats === null ? 'Personalizado' : number(plan.seats)}</dd>
          </div>
        )}
      </dl>

      <PlanAction plan={plan} />

      <ul className="mt-6 space-y-2.5 border-t border-white/[0.06] pt-5 text-sm" aria-label={`O que vem no ${plan.name}`}>
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2.5 text-zinc-200">
            <Check className="mt-0.5 size-4 shrink-0 text-accent-soft" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
    </article>
  )
}
