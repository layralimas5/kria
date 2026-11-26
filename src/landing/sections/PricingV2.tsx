import clsx from 'clsx'
import { ArrowRight, CalendarClock, Coins, Info, RefreshCw, RotateCcw, Sparkles, Wallet, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@/hooks/useQuery'
import { track } from '@/lib/analytics'
import { Reveal } from '../components/Reveal'
import { SIGNUP_PATH } from '../content'
import { CompareAllFeatures } from '../pricing/CompareAllFeatures'
import { PlanCardV2 } from '../pricing/PlanCardV2'
import { subscribePath } from '../pricing/PlanCard'
import { fetchStorefront, withWelcome, type StorefrontPlan } from '../pricing/storefront'

// Regras comerciais que o sistema aplica (FAQ e CLAUDE.md do projeto). Nada de garantia, teste ou desconto.
const TERMS: readonly { icon: LucideIcon; title: string; text: string }[] = [
  { icon: CalendarClock, title: 'Cobrança mensal', text: 'Pix ou cartão, pelo Asaas. O valor do plano é cobrado uma vez por mês.' },
  { icon: RotateCcw, title: 'Cancele quando quiser', text: 'Sem multa. O plano continua até o fim do período pago.' },
  { icon: RefreshCw, title: 'Créditos do plano', text: 'Renovam a cada cobrança paga e não acumulam para o mês seguinte.' },
  { icon: Wallet, title: 'Falhou, o crédito volta', text: 'Se a geração falhar, os créditos voltam sozinhos para o saldo.' },
]

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
    <ul className="mx-auto mt-12 grid max-w-6xl gap-5 lg:grid-cols-3" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <li key={index} className="h-[40rem] animate-pulse rounded-[1.75rem] border border-white/[0.06] bg-[#0c0b14] motion-reduce:animate-none" />
      ))}
    </ul>
  )
}

/** Conta grátis: as condições vêm do plano `gratis` da vitrine (boas-vindas e limites). */
function FreePlanStrip({ plan }: { readonly plan: StorefrontPlan }) {
  const conditions = [plan.monthly_credits === null ? null : `${plan.monthly_credits.toLocaleString('pt-BR')} créditos de boas-vindas, uma vez só`, ...plan.limits].filter(
    (item): item is string => item !== null,
  )
  return (
    <Reveal className="mx-auto mt-5 max-w-6xl">
      <div className="flex flex-col gap-5 rounded-[1.75rem] border border-white/[0.07] bg-white/[0.02] p-5 sm:p-7 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-4">
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/[0.05] text-accent-soft ring-1 ring-white/[0.1]">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h3 className="font-landing text-lg font-bold tracking-[-0.02em] text-zinc-50">Prefere conhecer antes? Comece no plano {plan.name}.</h3>
            <p className="mt-1 text-pretty text-sm text-zinc-400">{conditions.join(' · ')}.</p>
          </div>
        </div>
        <Link
          to={SIGNUP_PATH}
          onClick={() => track({ name: 'cta_click', params: { cta_id: `plan_${plan.slug}`, destination: SIGNUP_PATH } })}
          className="group inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-zinc-100 ring-1 ring-inset ring-white/[0.14] transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Criar conta grátis
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </Reveal>
  )
}

function Heading() {
  return (
    <div className="flex flex-col items-center text-center">
      <Reveal>
        <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300 ring-1 ring-white/[0.1] sm:text-xs">
          <Coins className="size-3.5 text-accent-soft" aria-hidden="true" />
          Planos para cada criador
        </p>
      </Reveal>
      <Reveal delay={0.08}>
        <h2 id="precos-title" className="mt-6 text-balance font-landing text-[2.1rem] font-bold leading-[1.02] tracking-[-0.04em] text-zinc-50 sm:text-[2.75rem] lg:text-[3.4rem]">
          Seu próximo nível{' '}
          <span className="bg-gradient-to-r from-accent-soft via-[#c4b5fd] to-galaxy bg-clip-text pb-[0.08em] text-transparent">começa aqui.</span>
        </h2>
      </Reveal>
      <Reveal delay={0.16}>
        <p className="mt-5 max-w-[38rem] text-pretty text-base leading-relaxed text-zinc-400 md:text-lg">
          Escolha o plano ideal para suas criações. Comece no seu ritmo e explore novas possibilidades com inteligência artificial.
        </p>
      </Reveal>
    </div>
  )
}

/** Planos lidos de `storefront_plans`: os mesmos números do checkout e do painel. */
export function PricingV2() {
  const storefront = useQuery(fetchStorefront, 'Não deu para carregar os planos.')
  const plans = storefront.data ? withWelcome(storefront.data) : []
  // O Business volta para a vitrine quando existir de verdade; por enquanto, só o que se assina.
  const creator = plans.filter((plan) => plan.line === 'creator')
  const paid = creator.filter((plan) => plan.cta === 'subscribe')
  const free = creator.find((plan) => plan.cta === 'signup')

  return (
    <section id="precos" aria-labelledby="precos-title" className="relative scroll-mt-16 px-4 pt-16 md:pt-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-48 -z-10 h-[42rem] bg-[radial-gradient(45%_40%_at_50%_35%,rgba(124,58,237,0.14),transparent),radial-gradient(30%_30%_at_75%_60%,rgba(59,130,246,0.07),transparent)]"
      />
      <div className="mx-auto max-w-6xl">
        <Heading />
        <PlansJsonLd plans={plans} />

        <div aria-busy={storefront.loading}>
          {storefront.error ? (
            <div className="mx-auto mt-12 max-w-md rounded-2xl border border-white/[0.07] bg-[#0c0b14] p-5 sm:p-6 text-center text-sm text-zinc-300">
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
            <>
              {/* Celular: carrossel com o plano em destaque primeiro e a ponta do próximo à vista. Computador: grade de 3. */}
              <ul
                aria-label="Planos"
                className="-mx-4 mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] md:mt-14 lg:mx-auto lg:grid lg:max-w-6xl lg:grid-cols-3 lg:items-stretch lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden"
              >
                {paid.map((plan, index) => (
                  <Reveal
                    key={plan.slug}
                    as="li"
                    delay={index * 0.08}
                    className={clsx('w-[86%] shrink-0 snap-center sm:w-[60%] lg:w-auto', plan.highlight && 'order-first lg:order-none')}
                  >
                    <PlanCardV2 plan={plan} />
                  </Reveal>
                ))}
              </ul>
              <p className="mt-1 text-center text-[13px] text-zinc-500 lg:hidden" aria-hidden="true">
                Deslize para ver os outros planos
              </p>
              {free && <FreePlanStrip plan={free} />}
              <p className="mx-auto mt-6 flex max-w-3xl items-start justify-center gap-2 text-center text-[13px] text-zinc-400">
                <Info className="mt-0.5 size-3.5 shrink-0 text-accent-soft" aria-hidden="true" />
                <span>
                  O consumo de créditos varia conforme a ferramenta e o modelo de IA utilizado. O custo aparece antes de cada geração.{' '}
                  <a href="#faq" className="font-semibold text-accent-soft underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    Como funcionam os créditos
                  </a>
                </span>
              </p>
              <CompareAllFeatures storefront={plans} columns={creator} />
            </>
          )}
        </div>

        <ul className="mx-auto mt-10 md:mt-14 grid max-w-6xl gap-x-6 gap-y-5 border-t border-white/[0.06] pt-10 sm:grid-cols-2 lg:grid-cols-4">
          {TERMS.map(({ icon: Icon, title, text }, index) => (
            <Reveal key={title} as="li" delay={index * 0.05} className="flex gap-3">
              <Icon className="mt-0.5 size-5 shrink-0 text-accent-soft" aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold text-zinc-100">{title}</span>
                <span className="mt-0.5 block text-pretty text-[13px] leading-relaxed text-zinc-400">{text}</span>
              </span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
