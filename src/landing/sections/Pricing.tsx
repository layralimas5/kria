import { CreditCard, Gift, RefreshCw, ShieldCheck } from 'lucide-react'
import type { SubscriptionPlan } from '@/domain/plans'
import { usePlans } from '@/hooks/usePlans'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { WELCOME_CREDITS } from '../content'
import { CreditsExplainer } from '../pricing/CreditsExplainer'
import { PlanCard, PlanCardSkeleton, subscribePath } from '../pricing/PlanCard'
import { PlanComparison } from '../pricing/PlanComparison'

const TRUST = [
  { icon: CreditCard, text: 'Cobrança mensal no cartão, pelo Asaas' },
  { icon: RefreshCw, text: 'Cancele quando quiser, sem multa' },
  { icon: Gift, text: `${WELCOME_CREDITS} créditos grátis ao criar a conta` },
  { icon: ShieldCheck, text: 'Créditos não vencem' },
] as const

/** Dados estruturados dos planos, montados com os valores do banco. */
function PlansJsonLd({ plans }: { readonly plans: readonly SubscriptionPlan[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Kria IA',
    description: 'Plataforma brasileira de criação com IA: personagens, imagens e vídeos.',
    offers: plans.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      price: (plan.price_cents / 100).toFixed(2),
      priceCurrency: 'BRL',
      url: subscribePath(plan.slug),
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: (plan.price_cents / 100).toFixed(2),
        priceCurrency: 'BRL',
        billingDuration: 'P1M',
      },
    })),
  }
  return <script type="application/ld+json">{JSON.stringify(data)}</script>
}

function PlansError({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }) {
  return (
    <div role="alert" className="mx-auto mt-10 max-w-md rounded-2xl border border-white/[0.08] bg-panel p-6 text-center">
      <p className="font-semibold text-zinc-100">{message}</p>
      <p className="mt-1 text-sm text-zinc-400">Confira sua conexão e tente de novo.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-zinc-50 px-5 text-sm font-semibold text-zinc-950 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Tentar de novo
      </button>
    </div>
  )
}

export function Pricing() {
  const { data: plans, loading, error, reload } = usePlans()

  return (
    <section id="precos" aria-labelledby="precos-title" className="scroll-mt-24 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          id="precos-title"
          align="center"
          title="Uma plataforma. Infinitas possibilidades de criação."
          lead="Crie personagens, vídeos, imagens e conteúdos com inteligência artificial. Escolha o plano ideal para transformar suas ideias em realidade."
        />

        {loading && !plans && (
          <div className="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-3" role="status" aria-label="Carregando planos">
            <PlanCardSkeleton />
            <PlanCardSkeleton />
            <PlanCardSkeleton />
          </div>
        )}
        {error && !plans && <PlansError message={error} onRetry={() => void reload()} />}

        {plans && plans.length > 0 && (
          <>
            <PlansJsonLd plans={plans} />
            <ul className="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-3 md:items-stretch">
              {plans.map((plan, index) => (
                <Reveal key={plan.slug} as="li" delay={index * 0.06} className={plan.highlight ? 'md:-mt-3' : 'md:mt-3'}>
                  <PlanCard plan={plan} />
                </Reveal>
              ))}
            </ul>
            <ul className="mx-auto mt-8 flex max-w-6xl flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-zinc-400">
              {TRUST.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-1.5">
                  <Icon className="size-4 text-accent" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
            <div className="mx-auto max-w-6xl">
              <CreditsExplainer />
              <PlanComparison plans={plans} />
            </div>
          </>
        )}
        {plans && plans.length === 0 && (
          <p className="mt-10 text-center text-zinc-400">Os planos estão sendo atualizados. Volte em instantes.</p>
        )}
      </div>
    </section>
  )
}
