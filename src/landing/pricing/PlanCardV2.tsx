import clsx from 'clsx'
import { ArrowRight, Check, Coins, Minus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatBRL } from '@/domain/format'
import { track } from '@/lib/analytics'
import { subscribePath } from './PlanCard'
import type { StorefrontPlan } from './storefront'

// Para quem é cada plano. É só posicionamento: preço, créditos, benefícios e limites vêm do banco.
const POSITIONING: Readonly<Record<string, string>> = {
  'creator-start': 'Para começar a explorar',
  'creator-pro': 'Para quem quer criar mais',
  'creator-max': 'Para quem precisa de mais liberdade',
}

// Benefício anunciado mas ainda não pronto: vem do banco com este sufixo e vira selo no card.
const SOON_SUFFIX = ' (em breve)'
const INHERIT_PREFIX = 'Tudo do '

const number = (value: number) => value.toLocaleString('pt-BR')

const BUTTON =
  'group/cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold transition-[background-color,box-shadow,color,transform] duration-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-stage'
const PRIMARY =
  'bg-accent text-accent-ink shadow-[0_10px_30px_-12px_rgb(124_58_237/0.8)] hover:bg-accent-strong hover:shadow-[0_14px_36px_-12px_rgb(139_92_246/0.9)]'
const SECONDARY = 'bg-white/[0.05] text-zinc-50 ring-1 ring-inset ring-white/[0.12] hover:bg-white/[0.09] hover:ring-white/25'

function ChooseButton({ plan }: { readonly plan: StorefrontPlan }) {
  const destination = subscribePath(plan.slug)
  return (
    <Link
      to={destination}
      onClick={() => track({ name: 'cta_click', params: { cta_id: `plan_${plan.slug}`, destination } })}
      className={clsx(BUTTON, plan.highlight ? PRIMARY : SECONDARY)}
    >
      Escolher {plan.name}
      <ArrowRight className="size-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}

function Feature({ feature }: { readonly feature: string }) {
  const soon = feature.endsWith(SOON_SUFFIX)
  const inherited = feature.startsWith(INHERIT_PREFIX)
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent-soft ring-1 ring-accent/25">
        <Check className="size-3" strokeWidth={3} />
      </span>
      <span className={clsx(inherited ? 'font-semibold text-zinc-50' : 'text-zinc-300')}>
        {soon ? feature.slice(0, -SOON_SUFFIX.length) : feature}
        {soon && <span className="ml-1.5 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-semibold text-zinc-400">em breve</span>}
      </span>
    </li>
  )
}

/** Card de assinatura: tudo vem de `storefront_plans`. O plano marcado como destaque no banco ganha o selo. */
export function PlanCardV2({ plan }: { readonly plan: StorefrontPlan }) {
  const titleId = `plano-${plan.slug}`
  const positioning = POSITIONING[plan.slug]
  const limits = plan.exports_month === null ? plan.limits : [`Até ${number(plan.exports_month)} exportações editadas por mês`, ...plan.limits]

  return (
    <div
      className={clsx(
        'group relative h-full rounded-[1.75rem] p-px transition-[box-shadow,transform] duration-500 ease-out hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        plan.highlight
          ? 'bg-gradient-to-b from-accent-soft/70 via-accent/35 to-galaxy/60 shadow-[0_30px_80px_-40px_rgb(124_58_237/0.7)]'
          : 'bg-white/[0.08] hover:bg-gradient-to-b hover:from-accent-soft/35 hover:to-white/[0.08]',
      )}
    >
      <article
        aria-labelledby={titleId}
        className={clsx(
          'relative flex h-full flex-col overflow-hidden rounded-[calc(1.75rem-1px)] p-6 sm:p-7',
          plan.highlight ? 'bg-[linear-gradient(180deg,#171230,#0c0b14_45%)]' : 'bg-[#0c0b14]',
        )}
      >
        {plan.highlight && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-accent-soft to-transparent" />
        )}

        <div className="flex items-start justify-between gap-3">
          <div>
            {positioning && <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-accent-soft">{positioning}</p>}
            <h3 id={titleId} className="mt-2 font-landing text-[1.6rem] font-bold leading-none tracking-[-0.03em] text-zinc-50">
              {plan.name}
            </h3>
          </div>
          {plan.highlight && (
            <span className="shrink-0 rounded-full bg-gradient-to-r from-accent to-galaxy px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white">
              Recomendado
            </span>
          )}
        </div>
        {plan.tagline && <p className="mt-3 text-pretty text-[15px] leading-relaxed text-zinc-400">{plan.tagline}</p>}

        <p className="mt-6 flex items-baseline gap-1.5">
          <span className="font-landing text-[2.75rem] font-bold leading-none tracking-[-0.045em] text-zinc-50 tabular-nums">
            {plan.price_cents === null ? 'Sob consulta' : formatBRL(plan.price_cents)}
          </span>
          {plan.price_cents !== null && <span className="text-sm text-zinc-500">/mês</span>}
        </p>
        <p className="mt-1.5 text-[13px] text-zinc-500">Cobrança mensal</p>

        {plan.monthly_credits !== null && (
          <p className="mt-5 flex items-center gap-3 rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.07]">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent/30 to-galaxy/20 text-accent-soft ring-1 ring-accent/30">
              <Coins className="size-4" />
            </span>
            <span className="leading-tight">
              <span className="block font-landing text-xl font-bold tracking-[-0.02em] text-zinc-50 tabular-nums">{number(plan.monthly_credits)}</span>
              <span className="block text-[13px] text-zinc-400">créditos de IA por mês</span>
            </span>
          </p>
        )}

        <div className="mt-6">
          <ChooseButton plan={plan} />
        </div>

        <div className="mt-7 border-t border-white/[0.06] pt-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-500">O que inclui</p>
          <ul className="mt-4 space-y-3 text-[14px] leading-snug" aria-label={`O que vem no ${plan.name}`}>
            {plan.features.map((feature) => (
              <Feature key={feature} feature={feature} />
            ))}
          </ul>
        </div>

        {limits.length > 0 && (
          <div className="mt-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Limites</p>
            <ul className="mt-3 space-y-2.5 text-[13px] leading-snug text-zinc-400" aria-label={`Limites do ${plan.name}`}>
              {limits.map((limit) => (
                <li key={limit} className="flex gap-3">
                  <Minus className="mt-0.5 size-4 shrink-0 text-zinc-600" aria-hidden="true" />
                  {limit}
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </div>
  )
}
