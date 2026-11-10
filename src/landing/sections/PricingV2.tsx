import { Info } from 'lucide-react'
import { useQuery } from '@/hooks/useQuery'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { PlanCardV2 } from '../pricing/PlanCardV2'
import { subscribePath } from '../pricing/PlanCard'
import { CREDIT_NOTICE, fetchStorefront, USAGE_NOTICE, withWelcome, type StorefrontPlan } from '../pricing/storefront'

/** Dados estruturados só dos planos com preço e checkout. */
function PlansJsonLd({ plans }: { readonly plans: readonly StorefrontPlan[] }) {
  const sold = plans.filter((plan) => plan.cta === 'subscribe' && plan.price_cents !== null)
  if (sold.length === 0) return null
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Vynkio Creator',
    description: 'Plataforma brasileira de criação com IA: imagens, vídeos, roteiros e multiplicador de vídeos.',
    offers: sold.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      price: ((plan.price_cents ?? 0) / 100).toFixed(2),
      priceCurrency: 'BRL',
      url: subscribePath(plan.slug),
    })),
  }
  return <script type="application/ld+json">{JSON.stringify(data)}</script>
}

function PlanSkeleton() {
  return (
    <ul className="mx-auto mt-10 grid max-w-7xl gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <li key={index} className="h-[30rem] animate-pulse rounded-2xl border border-white/[0.06] bg-panel motion-reduce:animate-none" />
      ))}
    </ul>
  )
}

/** Planos lidos de `storefront_plans`: os mesmos números do checkout e do painel. */
export function PricingV2() {
  const storefront = useQuery(fetchStorefront, 'Não deu para carregar os planos.')
  const plans = storefront.data ? withWelcome(storefront.data) : []
  // O Business volta para a vitrine quando existir de verdade; por enquanto, só o que se assina.
  const current = plans.filter((plan) => plan.line === 'creator')

  return (
    <section id="precos" aria-labelledby="precos-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading id="precos-title" align="center" title="Planos para criar com IA" lead="Comece grátis. Assine quando quiser criar toda semana." />
        <PlansJsonLd plans={plans} />

        <div aria-busy={storefront.loading}>
          {storefront.error ? (
            <div className="mx-auto mt-10 max-w-md rounded-2xl border border-white/[0.07] bg-panel p-6 text-center text-sm text-zinc-300">
              <p>Os planos não carregaram agora.</p>
              <button
                type="button"
                onClick={() => void storefront.reload()}
                className="mt-3 min-h-10 rounded-lg px-4 font-semibold text-accent-soft underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Tentar de novo
              </button>
            </div>
          ) : !storefront.data ? (
            <PlanSkeleton />
          ) : (
            <ul className="mx-auto mt-10 grid max-w-7xl gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:items-stretch">
              {current.map((plan, index) => (
                <Reveal key={plan.slug} as="li" delay={index * 0.05}>
                  <PlanCardV2 plan={plan} />
                </Reveal>
              ))}
            </ul>
          )}
        </div>

        <p className="mx-auto mt-8 flex max-w-3xl items-start gap-2.5 rounded-2xl border border-white/[0.07] bg-panel/60 p-4 text-sm text-zinc-300">
          <Info className="mt-0.5 size-4 shrink-0 text-accent-soft" aria-hidden="true" />
          {CREDIT_NOTICE}
        </p>
        {current.some((plan) => plan.usage_hint) && <p className="mx-auto mt-4 max-w-3xl text-center text-[13px] text-zinc-500">* {USAGE_NOTICE}</p>}
        <p className="mx-auto mt-2 max-w-3xl text-center text-[13px] text-zinc-500">
          Cobrança mensal no cartão, pelo Asaas · Cancele quando quiser, sem multa · Falhou, o crédito volta
        </p>
      </div>
    </section>
  )
}
