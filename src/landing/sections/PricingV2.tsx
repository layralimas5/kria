import clsx from 'clsx'
import { Info } from 'lucide-react'
import { useState } from 'react'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { BUSINESS_PLANS, CREATOR_PLANS, CREDIT_NOTICE, type V2Plan } from '../pricing/catalogV2'
import { PlanCardV2 } from '../pricing/PlanCardV2'
import { subscribePath } from '../pricing/PlanCard'

const TABS = [
  { id: 'creator', label: 'Creator', plans: CREATOR_PLANS },
  { id: 'business', label: 'Business', plans: BUSINESS_PLANS },
] as const
type TabId = (typeof TABS)[number]['id']

/** Dados estruturados só dos planos com preço e checkout. */
function PlansJsonLd({ plans }: { readonly plans: readonly V2Plan[] }) {
  const sold = plans.filter((plan) => plan.cta === 'subscribe' && plan.price_cents !== null)
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

export function PricingV2() {
  const [tab, setTab] = useState<TabId>('creator')
  const current = TABS.find((item) => item.id === tab) ?? TABS[0]

  return (
    <section id="precos" aria-labelledby="precos-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading id="precos-title" align="center" title="Planos para criar e para crescer" lead="Creator para quem produz conteúdo. Business para equipes e empresas." />
        <PlansJsonLd plans={CREATOR_PLANS} />

        <div className="mt-10 flex justify-center">
          <div role="tablist" aria-label="Linha de planos" className="inline-flex gap-1 rounded-xl bg-panel p-1 ring-1 ring-white/[0.08]">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`precos-tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls="precos-painel"
                onClick={() => setTab(item.id)}
                className={clsx(
                  'min-h-10 rounded-lg px-6 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  tab === item.id ? 'bg-accent text-accent-ink' : 'text-zinc-300 hover:text-zinc-50',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div id="precos-painel" role="tabpanel" aria-labelledby={`precos-tab-${tab}`}>
          <ul className="mx-auto mt-10 grid max-w-7xl gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:items-stretch">
            {current.plans.map((plan, index) => (
              <Reveal key={plan.slug} as="li" delay={index * 0.05}>
                <PlanCardV2 plan={plan} />
              </Reveal>
            ))}
          </ul>
          {tab === 'business' && (
            <p className="mx-auto mt-6 max-w-3xl text-center text-[13px] text-zinc-400">
              O Business está em preparação: contratação por conversa, com os recursos marcados como em breve entrando aos poucos.
            </p>
          )}
        </div>

        <p className="mx-auto mt-8 flex max-w-3xl items-start gap-2.5 rounded-2xl border border-white/[0.07] bg-panel/60 p-4 text-sm text-zinc-300">
          <Info className="mt-0.5 size-4 shrink-0 text-accent-soft" aria-hidden="true" />
          {CREDIT_NOTICE}
        </p>
        <p className="mx-auto mt-4 max-w-3xl text-center text-[13px] text-zinc-500">
          Cobrança mensal no cartão, pelo Asaas · Cancele quando quiser, sem multa · Falhou, o crédito volta
        </p>
      </div>
    </section>
  )
}
