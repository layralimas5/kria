import { CalendarCheck, Check, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BuyButton, PixInfo, TrustBadges, type TrustItem } from '@/components/checkout/CheckoutActions'
import { CheckoutAlert } from '@/components/checkout/CheckoutAlert'
import { CardFields } from '@/components/checkout/CardFields'
import { CheckoutStep } from '@/components/checkout/CheckoutStep'
import { OrderBumpCard } from '@/components/checkout/OrderBumpCard'
import { PaymentMethodPicker } from '@/components/checkout/PaymentMethodPicker'
import { PixPanel } from '@/components/checkout/PixPanel'
import { PlanBuyerFields } from '@/components/checkout/PlanBuyerFields'
import { TestimonialsBlock } from '@/components/checkout/TestimonialsBlock'
import { StoreFooter } from '@/components/store/StoreFooter'
import { StoreHeader } from '@/components/store/StoreHeader'
import { Spinner } from '@/components/ui/Spinner'
import { formatBRL, formatCredits } from '@/domain/format'
import { usePlanCheckout } from '@/hooks/usePlanCheckout'
import { usePlanOffer } from '@/hooks/usePlanOffer'
import { usePlanPixStatus } from '@/hooks/usePlanPixStatus'
import { track } from '@/lib/analytics'
import type { PlanOffer, PlanPayResult } from '@/lib/planCheckoutApi'
import type { PlanQuote } from '../../supabase/functions/_shared/planQuote'

const PLAN_SLUG = /^[a-z0-9-]{2,40}$/
/** Capa do checkout dos planos: a marca, não um plano (`npm run checkout:cover`). */
const COVER_SRC = '/checkout/vynkio-capa.jpg'

const TRUST: readonly TrustItem[] = [
  { Icon: ShieldCheck, title: 'Pagamento seguro', text: 'Processado pelo Asaas' },
  { Icon: Sparkles, title: 'Créditos na hora', text: 'Liberados assim que o pagamento cai' },
  { Icon: CalendarCheck, title: 'Cancele quando quiser', text: 'Sem multa e sem fidelidade' },
]

const PIX_BENEFITS = ['Plano liberado assim que o Pix cair', 'QR Code e copia e cola na próxima tela', 'Todo mês chega um Pix novo no seu e-mail'] as const

/** Para onde ir depois de pago: a tela da assinatura confirma e mostra o link dos extras. */
function successPath(result: PlanPayResult): string {
  const params = new URLSearchParams({ assinatura: result.subscriptionId })
  if (result.orderToken) params.set('pedido', result.orderToken)
  if (result.bumpsFailed) params.set('extras', 'falhou')
  return `/assinatura?${params.toString()}`
}

function PlanHeader({ offer }: { readonly offer: PlanOffer }) {
  const { plan } = offer
  return (
    <header className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <img src={COVER_SRC} alt="" width={1200} height={480} className="aspect-[5/2] w-full object-cover" fetchPriority="high" />
      <div className="p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-violet-700">Assinatura mensal</p>
        <h1 className="mt-1 text-xl font-bold leading-snug text-zinc-900 sm:text-2xl">Vynkio {plan.name}</h1>
        {plan.tagline && <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{plan.tagline}</p>}
        <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
          <span className="text-3xl font-extrabold tabular-nums text-zinc-900">{formatBRL(plan.priceCents)}</span>
          <span className="text-sm text-zinc-500">por mês · {formatCredits(plan.monthlyCredits)} todo mês</span>
        </p>
        {plan.features.length > 0 && (
          <ul className="mt-4 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" /> {feature}
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  )
}

function PlanSummary({ offer, quote }: { readonly offer: PlanOffer; readonly quote: PlanQuote }) {
  return (
    <section aria-labelledby="plan-summary" className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 id="plan-summary" className="text-base font-semibold text-zinc-900">
        Resumo
      </h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        <li className="flex justify-between gap-4">
          <span className="text-zinc-600">Vynkio {offer.plan.name} · 1º mês</span>
          <span className="tabular-nums text-zinc-900">{formatBRL(quote.planCents)}</span>
        </li>
        {quote.bumps.map((bump) => (
          <li key={bump.slug} className="flex justify-between gap-4">
            <span className="text-zinc-600">{bump.name}</span>
            <span className="tabular-nums text-zinc-900">{formatBRL(bump.priceCents)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-zinc-200 pt-4">
        <span className="text-sm font-semibold text-zinc-900">Total hoje</span>
        <span className="text-2xl font-bold tabular-nums text-zinc-900">{formatBRL(quote.totalCents)}</span>
      </div>
      <p className="mt-2 text-right text-[13px] text-zinc-500">Depois, {formatBRL(quote.planCents)} por mês. Cancele quando quiser.</p>
    </section>
  )
}

function PixWaiting({ result }: { readonly result: PlanPayResult & { readonly pix: NonNullable<PlanPayResult['pix']> } }) {
  const navigate = useNavigate()
  const status = usePlanPixStatus(result.subscriptionId)
  useEffect(() => {
    if (status === 'active') navigate(successPath(result), { replace: true })
  }, [status, result, navigate])

  return (
    <div className="space-y-4">
      {result.bumpsFailed && <CheckoutAlert>Os extras não entraram neste Pix. Ele cobra só o plano; os extras você pode comprar depois.</CheckoutAlert>}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        {status === 'expired' ? (
          <p className="text-center text-sm text-zinc-600">Esse Pix venceu sem pagamento. Nada foi cobrado. Recarregue a página para gerar outro.</p>
        ) : (
          <PixPanel pix={result.pix} totalCents={result.totalCents} />
        )}
      </div>
    </div>
  )
}

function PlanCheckoutForm({ offer, onPix }: { readonly offer: PlanOffer; readonly onPix: (result: PlanPayResult) => void }) {
  const navigate = useNavigate()
  const checkout = usePlanCheckout(offer)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await checkout.submit()
    if (!result) return
    if (result.pix) onPix(result)
    else navigate(successPath(result))
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <PlanHeader offer={offer} />
      {offer.alreadySubscribed && <CheckoutAlert>Você já está nesse plano. Para trocar, escolha outro em Assinatura.</CheckoutAlert>}
      <CheckoutStep number={1} title="Seus dados">
        <PlanBuyerFields value={checkout.buyer} onChange={checkout.setBuyer} email={offer.email} />
      </CheckoutStep>
      <CheckoutStep number={2} title="Pagamento">
        <div className="space-y-5">
          <PaymentMethodPicker value={checkout.method} onChange={checkout.setMethod} />
          {checkout.method === 'card' ? <CardFields value={checkout.card} onChange={checkout.setCard} /> : <PixInfo benefits={PIX_BENEFITS} />}
        </div>
      </CheckoutStep>
      {offer.bumps.length > 0 && (
        <section aria-label="Leve junto" className="space-y-3">
          {offer.bumps.map((bump) => (
            <OrderBumpCard key={bump.slug} bump={bump} checked={checkout.bumps.has(bump.slug)} onToggle={() => checkout.toggleBump(bump.slug)} />
          ))}
        </section>
      )}
      <PlanSummary offer={offer} quote={checkout.quote} />
      {checkout.error && <CheckoutAlert>{checkout.error}</CheckoutAlert>}
      <BuyButton loading={checkout.submitting}>{checkout.method === 'pix' ? 'Gerar Pix' : 'Assinar agora'}</BuyButton>
      <TrustBadges items={TRUST} />
      <TestimonialsBlock scope={{ kind: 'vynkio' }} />
    </form>
  )
}

/**
 * `/assinar/:plan`: checkout próprio dos planos (docs/checkout-planos.md), no tema claro da loja. Chega aqui
 * já logado (RequireAuth leva ao login e volta). Dados, pagamento e "leve junto" na mesma tela.
 */
export function PlanCheckoutPage() {
  const { plan = '' } = useParams()
  const valid = PLAN_SLUG.test(plan)
  const state = usePlanOffer(valid ? plan : '')
  const [pixResult, setPixResult] = useState<PlanPayResult | null>(null)
  const tracked = useRef(false)

  useEffect(() => {
    if (state.kind !== 'ready' || tracked.current) return
    tracked.current = true
    track({ name: 'begin_checkout', params: { plan } })
  }, [state.kind, plan])

  return (
    <div className="min-h-dvh bg-zinc-100">
      <StoreHeader />
      <main className="mx-auto max-w-[640px] px-4 py-6 sm:py-8">
        {!valid && <CheckoutAlert>Plano não encontrado.</CheckoutAlert>}
        {valid && state.kind === 'loading' && (
          <div className="grid min-h-[50vh] place-items-center" role="status">
            <Spinner className="size-7 text-violet-600" />
            <span className="sr-only">Carregando o checkout</span>
          </div>
        )}
        {valid && state.kind === 'error' && (
          <div className="space-y-4">
            <CheckoutAlert>{state.message}</CheckoutAlert>
            <Link to="/assinatura" className="block text-center text-sm font-semibold text-violet-700 underline underline-offset-2">
              Ver os planos
            </Link>
          </div>
        )}
        {state.kind === 'ready' && !pixResult && <PlanCheckoutForm offer={state.offer} onPix={setPixResult} />}
        {pixResult?.pix && <PixWaiting result={{ ...pixResult, pix: pixResult.pix }} />}
      </main>
      <StoreFooter />
    </div>
  )
}
