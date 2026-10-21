import { CreditCard, Gift, RefreshCw, ShieldCheck } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { WELCOME_CREDITS } from '../content'
import { CreditsExplainer } from '../pricing/CreditsExplainer'
import { PLAN_CATALOG, type MarketingPlan } from '../pricing/catalog'
import { PlanCard, subscribePath } from '../pricing/PlanCard'
import { FREE_PLAN } from '../pricing/freePlan'
import { PlanComparison } from '../pricing/PlanComparison'

const TRUST = [
  { icon: CreditCard, text: 'Cobrança mensal no cartão, pelo Asaas' },
  { icon: RefreshCw, text: 'Cancele quando quiser, sem multa' },
  { icon: Gift, text: `${WELCOME_CREDITS} créditos grátis ao criar a conta` },
  { icon: ShieldCheck, text: 'Falhou? O crédito volta' },
] as const

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

/** O Grátis abre a vitrine; os pagos vêm do catálogo. */
const PLANS = [FREE_PLAN, ...PLAN_CATALOG]

export function Pricing() {
  return (
    <section id="precos" aria-labelledby="precos-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          id="precos-title"
          align="center"
          title="Uma plataforma. Infinitas possibilidades de criação."
          lead="Crie personagens, vídeos, imagens e conteúdos com inteligência artificial. Escolha o plano ideal para transformar suas ideias em realidade."
        />

        <PlansJsonLd plans={PLAN_CATALOG} />
        <ul className="mx-auto mt-12 grid max-w-7xl gap-5 md:grid-cols-2 md:items-stretch xl:grid-cols-4">
          {PLANS.map((plan, index) => (
            <Reveal key={plan.slug} as="li" delay={index * 0.06} className={plan.highlight ? 'xl:-mt-3' : 'xl:mt-3'}>
              <PlanCard plan={plan} />
            </Reveal>
          ))}
        </ul>
        <ul className="mx-auto mt-8 flex max-w-6xl flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-zinc-400">
          {TRUST.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-1.5">
              <Icon className="size-4 text-accent-soft" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
        <div className="mx-auto max-w-7xl">
          <CreditsExplainer />
          <PlanComparison plans={PLANS} />
        </div>
      </div>
    </section>
  )
}
