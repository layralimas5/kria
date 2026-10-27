import { Gift } from 'lucide-react'
import { CtaLink } from '../components/CtaLink'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { SAFETY_LINE, WELCOME_CREDITS } from '../content'
import { CreditsExplainer } from '../pricing/CreditsExplainer'
import { PLAN_CATALOG, type MarketingPlan } from '../pricing/catalog'
import { PlanCard, subscribePath } from '../pricing/PlanCard'
import { FREE_PLAN } from '../pricing/freePlan'
import { PlanComparison } from '../pricing/PlanComparison'

/** Dados estruturados dos planos, montados com os valores do banco. */
function PlansJsonLd({ plans }: { readonly plans: readonly MarketingPlan[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Vynkio',
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

/** O modelo de LP pede de dois a três planos nos cards; o Grátis fica na faixa de teste e na comparação. */
const COMPARED_PLANS = [FREE_PLAN, ...PLAN_CATALOG]

function FreeTrial() {
  return (
    <div className="mx-auto mt-6 flex max-w-6xl flex-col items-start gap-4 rounded-2xl border border-white/[0.07] bg-panel/60 p-5 sm:flex-row sm:items-center sm:justify-between md:px-7">
      <p className="flex items-start gap-3 text-sm text-zinc-300">
        <Gift className="mt-0.5 size-5 shrink-0 text-accent-soft" aria-hidden="true" />
        <span>
          <span className="font-semibold text-zinc-50">Ainda não quer assinar?</span> Crie a conta e teste com {WELCOME_CREDITS} créditos e 1 personagem, sem
          cartão. Os créditos de boas-vindas não vencem.
        </span>
      </p>
      <CtaLink cta="pricing_free" tone="light" className="shrink-0" />
    </div>
  )
}

export function Pricing() {
  return (
    <section id="precos" aria-labelledby="precos-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          id="precos-title"
          align="center"
          title="Escolha pelo quanto você cria"
          lead="Testando os primeiros posts? Starter. Publica toda semana ou cuida de mais de uma marca? Pro. Produz para clientes? Studio."
        />

        <PlansJsonLd plans={PLAN_CATALOG} />
        <ul className="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-3 md:items-stretch">
          {PLAN_CATALOG.map((plan, index) => (
            <Reveal key={plan.slug} as="li" delay={index * 0.06} className={plan.highlight ? 'md:-mt-3' : 'md:mt-3'}>
              <PlanCard plan={plan} />
            </Reveal>
          ))}
        </ul>
        <p className="mx-auto mt-6 max-w-6xl text-center text-[13px] text-zinc-400">Cobrança mensal no cartão, pelo Asaas · {SAFETY_LINE}</p>
        <FreeTrial />
        <div className="mx-auto max-w-7xl">
          <CreditsExplainer />
          <PlanComparison plans={COMPARED_PLANS} />
        </div>
      </div>
    </section>
  )
}
