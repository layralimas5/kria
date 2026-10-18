import clsx from 'clsx'
import { Check, ChevronLeft, CreditCard, UserRound } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { formatBRL } from '@/domain/format'
import { isEntitled, type Subscription, type SubscriptionPlan } from '@/domain/plans'
import { cancelSubscription, errorMessage, fetchPlans, fetchSubscription } from '@/lib/api'
import { useQuery } from '@/hooks/useQuery'

const POLL_MS = 4000
const POLL_LIMIT_MS = 3 * 60 * 1000
const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

interface SubscriptionView {
  readonly subscription: Subscription | null
  readonly plans: SubscriptionPlan[]
}

async function loadView(): Promise<SubscriptionView> {
  const [subscription, plans] = await Promise.all([fetchSubscription(), fetchPlans()])
  return { subscription, plans }
}

/** Depois do checkout, o webhook confirma em segundos; até lá a página consulta de novo. */
function useConfirmationPolling(waiting: boolean, reload: () => Promise<void>): boolean {
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    if (!waiting) return
    const started = Date.now()
    const timer = window.setInterval(() => {
      if (Date.now() - started > POLL_LIMIT_MS) {
        window.clearInterval(timer)
        setTimedOut(true)
        return
      }
      void reload()
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [waiting, reload])
  return timedOut
}

function CurrentPlan({ subscription, plan, onCanceled }: { subscription: Subscription; plan: SubscriptionPlan; onCanceled: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const periodEnd = subscription.current_period_end ? dateFormat.format(new Date(subscription.current_period_end)) : null
  const canceled = subscription.status === 'canceled'

  async function handleCancel() {
    setCanceling(true)
    setError(null)
    try {
      await cancelSubscription()
      setConfirming(false)
      onCanceled()
    } catch (cancelError) {
      setError(errorMessage(cancelError))
    } finally {
      setCanceling(false)
    }
  }

  return (
    <section aria-labelledby="plano-atual" className="rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06] sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Seu plano</p>
      <h2 id="plano-atual" className="mt-2 font-headline text-3xl text-zinc-50">
        {plan.name}
      </h2>
      <p className="mt-1 text-sm text-zinc-400">
        {formatBRL(subscription.price_cents)} por mês · {plan.monthly_credits.toLocaleString('pt-BR')} créditos por mês · até {plan.max_personas} personagens
      </p>
      {periodEnd && (
        <p className="mt-4 text-sm text-zinc-300">
          {canceled ? `Cancelado. O plano vale até ${periodEnd}, sem novas cobranças.` : `Próxima cobrança por volta de ${periodEnd}.`}
        </p>
      )}
      {subscription.status === 'overdue' && (
        <div className="mt-4">
          <Notice tone="error">A última cobrança não passou. Confira o cartão no e-mail que o Asaas enviou para manter o plano.</Notice>
        </div>
      )}
      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {!canceled && (
        <div className="mt-6 flex flex-wrap gap-2">
          {confirming ? (
            <>
              <Button variant="secondary" onClick={() => void handleCancel()} loading={canceling}>
                Confirmar cancelamento
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={canceling}>
                Manter plano
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              Cancelar assinatura
            </Button>
          )}
        </div>
      )}
      {confirming && (
        <p className="mt-3 text-sm text-zinc-400">
          Você não será mais cobrado. O plano e os créditos que já estão na conta continuam até {periodEnd ?? 'o fim do período pago'}.
        </p>
      )}
    </section>
  )
}

function PlanOptions({ plans, currentSlug }: { plans: SubscriptionPlan[]; currentSlug: string | null }) {
  return (
    <section aria-labelledby="outros-planos">
      <h2 id="outros-planos" className="text-lg font-bold text-zinc-50">
        {currentSlug ? 'Trocar de plano' : 'Escolha um plano'}
      </h2>
      <p className="mt-1 text-sm text-zinc-400">
        {currentSlug
          ? 'O limite de personagens muda na hora. O novo valor e os créditos do novo plano valem a partir da próxima cobrança.'
          : 'Cobrança mensal no cartão. Cancele quando quiser.'}
      </p>
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {plans.map((plan) => {
          const current = plan.slug === currentSlug
          return (
            <li key={plan.slug} className={clsx('rounded-2xl p-5 ring-1', current ? 'bg-accent/[0.06] ring-accent/40' : 'bg-surface ring-white/[0.06]')}>
              <p className="font-semibold text-zinc-50">{plan.name}</p>
              <p className="mt-1 text-2xl font-bold text-zinc-50">
                {formatBRL(plan.price_cents)}
                <span className="text-sm font-normal text-zinc-500">/mês</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-zinc-300">
                <li className="flex items-center gap-2">
                  <CreditCard className="size-4 text-accent" aria-hidden="true" /> {plan.monthly_credits.toLocaleString('pt-BR')} créditos por mês
                </li>
                <li className="flex items-center gap-2">
                  <UserRound className="size-4 text-accent" aria-hidden="true" /> Até {plan.max_personas} personagens
                </li>
              </ul>
              {current ? (
                <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-accent">
                  <Check className="size-4" aria-hidden="true" /> Plano atual
                </p>
              ) : (
                <Link
                  to={`/assinar/${plan.slug}`}
                  className="btn-lime mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {currentSlug ? `Mudar para ${plan.name}` : plan.cta_label}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function SubscriptionPage() {
  const [params] = useSearchParams()
  const { data, loading, error, reload } = useQuery(loadView, 'Não deu para carregar sua assinatura.')
  const subscription = data?.subscription ?? null
  const entitled = subscription !== null && isEntitled(subscription)
  const waiting = params.has('retorno') && subscription?.status === 'pending'
  const timedOut = useConfirmationPolling(waiting, reload)
  const silentReload = useCallback(() => void reload(), [reload])

  const plan = entitled ? data?.plans.find((item) => item.slug === subscription.plan_slug) ?? null : null

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <Link to="/conta" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-100">
        <ChevronLeft className="size-4" aria-hidden="true" /> Conta
      </Link>
      <PageHeader title="Assinatura" description="Seu plano, os créditos do mês e as cobranças." />

      {loading && !data && (
        <div className="grid place-items-center py-16 text-zinc-500" role="status" aria-label="Carregando">
          <Spinner className="size-6" />
        </div>
      )}
      {error && (
        <div className="space-y-3">
          <Notice tone="error">{error}</Notice>
          <Button variant="secondary" onClick={silentReload}>
            Tentar de novo
          </Button>
        </div>
      )}

      {params.get('trocou') && <Notice tone="success">Plano trocado. O novo valor vale a partir da próxima cobrança.</Notice>}
      {waiting && !timedOut && (
        <Notice>
          <span className="flex items-center gap-2">
            <Spinner className="size-4" /> Pagamento recebido pelo checkout. Esperando a confirmação do Asaas para liberar o plano.
          </span>
        </Notice>
      )}
      {waiting && timedOut && (
        <Notice>A confirmação está demorando mais que o normal. Assim que o Asaas confirmar, o plano e os créditos entram sozinhos.</Notice>
      )}
      {params.has('retorno') && entitled && <Notice tone="success">Assinatura confirmada. Os créditos do plano já estão na sua conta.</Notice>}

      {data && plan && subscription && <CurrentPlan subscription={subscription} plan={plan} onCanceled={silentReload} />}
      {data && <PlanOptions plans={data.plans} currentSlug={plan && subscription?.status !== 'canceled' ? plan.slug : null} />}
    </div>
  )
}
