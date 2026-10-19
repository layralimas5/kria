import { CalendarClock, Info } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PaymentHistory } from '@/components/billing/PaymentHistory'
import { PlanCard } from '@/components/billing/PlanCard'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { formatBRL, formatCredits, formatDate } from '@/domain/format'
import { STATUS_LABELS } from '@/domain/plans'
import type { Plan, Subscription } from '@/domain/types'
import { useAccount } from '@/hooks/useAccount'
import { useBalance } from '@/hooks/useBalance'
import { cancelSubscription, errorMessage, startSubscription } from '@/lib/api'

const POLICIES = [
  'Os créditos do plano renovam a cada mês pago e não acumulam. Os comprados em pacote não expiram.',
  'A geração gasta primeiro os créditos do plano. Se falhar, o crédito volta.',
  'Cancelou? O plano vale até o fim do período já pago.',
  'Trocar de plano vale quando o pagamento do novo for confirmado: o anterior é encerrado e os créditos do plano passam a ser os do novo.',
]

function CurrentPlan({ plan, subscription, onCancel, canceling }: {
  readonly plan: Plan | null
  readonly subscription: Subscription | null
  readonly onCancel: () => void
  readonly canceling: boolean
}) {
  const { wallet } = useBalance()
  const end = subscription?.current_period_end

  return (
    <section aria-labelledby="current-title" className="rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p id="current-title" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Plano atual
          </p>
          <p className="font-headline mt-2 text-4xl text-zinc-50">{plan?.name ?? '...'}</p>
          {subscription && end ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-400">
              <CalendarClock className="size-4" aria-hidden="true" />
              {STATUS_LABELS[subscription.status]} · {formatBRL(subscription.price_cents)}/mês ·{' '}
              {subscription.status === 'canceled' ? `vale até ${formatDate(end)}` : `renova em ${formatDate(end)}`}
            </p>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">Sem mensalidade. Você usa os créditos de boas-vindas e os pacotes avulsos.</p>
          )}
          {wallet && (
            <p className="mt-1 text-sm text-zinc-400">
              {formatCredits(wallet.subscription_balance)} do plano · {formatCredits(wallet.purchased_balance)} comprados
            </p>
          )}
        </div>
        {subscription && (subscription.status === 'active' || subscription.status === 'past_due') && (
          <Button variant="secondary" onClick={onCancel} loading={canceling} className="shrink-0">
            Cancelar assinatura
          </Button>
        )}
      </div>
      {subscription?.status === 'past_due' && (
        <div className="mt-4">
          <Notice tone="error">
            O pagamento deste mês não passou. O Asaas vai tentar de novo; confira o cartão no e-mail da cobrança. O plano segue ativo por 3 dias.
          </Notice>
        </div>
      )}
    </section>
  )
}

/** Volta do checkout: espera o webhook confirmar o pagamento. */
function CheckoutReturn({ subscriptionId, subscriptions }: { readonly subscriptionId: string; readonly subscriptions: readonly Subscription[] }) {
  const pending = subscriptions.find((item) => item.id === subscriptionId)
  if (pending?.status === 'active') return <Notice tone="success">Assinatura confirmada. Os créditos do plano já estão na sua conta.</Notice>
  if (pending?.status === 'expired') return <Notice tone="error">O pagamento não foi concluído. Você pode tentar de novo abaixo.</Notice>
  return (
    <Notice>
      <span className="flex items-center gap-2">
        <Spinner className="size-4" /> Esperando a confirmação do pagamento. No cartão costuma levar alguns segundos.
      </span>
    </Notice>
  )
}

export function SubscriptionPage() {
  const [params] = useSearchParams()
  const { plans, plan, subscription, subscriptions, error: accountError, refresh } = useAccount()
  const [busy, setBusy] = useState<string | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const returning = params.get('assinatura')
  const publicPlans = plans.filter((item) => item.public)
  const live = subscription && (subscription.status === 'active' || subscription.status === 'past_due') ? subscription : null

  async function subscribe(target: Plan) {
    setBusy(target.slug)
    setMessage(null)
    try {
      window.location.assign(await startSubscription(target.slug))
    } catch (subscribeError) {
      setMessage({ tone: 'error', text: errorMessage(subscribeError) })
      setBusy(null)
    }
  }

  async function cancel() {
    if (!subscription?.current_period_end) return
    const until = formatDate(subscription.current_period_end)
    if (!window.confirm(`Cancelar a assinatura? Você continua com o plano e os créditos dele até ${until}.`)) return
    setCanceling(true)
    setMessage(null)
    try {
      await cancelSubscription()
      await refresh()
      setMessage({ tone: 'success', text: `Assinatura cancelada. O plano vale até ${until}.` })
    } catch (cancelError) {
      setMessage({ tone: 'error', text: errorMessage(cancelError) })
    } finally {
      setCanceling(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10 pt-4">
      <PageHeader title="Assinatura" description="Créditos todo mês, cobrados no cartão pelo Asaas. Cancele quando quiser." />

      {returning && <CheckoutReturn subscriptionId={returning} subscriptions={subscriptions} />}
      {accountError && <Notice tone="error">{accountError}</Notice>}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <CurrentPlan plan={plan} subscription={subscription} onCancel={() => void cancel()} canceling={canceling} />

      <section aria-labelledby="plans-title" className="space-y-4">
        <h2 id="plans-title" className="font-headline text-lg text-zinc-100">
          Planos
        </h2>
        <div className="grid gap-4 pt-2 md:grid-cols-3">
          {publicPlans.map((item) => (
            <PlanCard
              key={item.slug}
              plan={item}
              current={live?.plan_slug === item.slug}
              switching={live !== null}
              busy={busy === item.slug}
              disabled={busy !== null}
              onSubscribe={() => void subscribe(item)}
            />
          ))}
        </div>
        <ul className="space-y-1.5 rounded-2xl bg-surface p-4 text-sm text-zinc-400 ring-1 ring-white/[0.06]">
          {POLICIES.map((policy) => (
            <li key={policy} className="flex items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden="true" />
              {policy}
            </li>
          ))}
        </ul>
      </section>

      <PaymentHistory key={`${subscription?.id ?? 'none'}:${subscription?.current_period_end ?? ''}:${subscriptions.length}`} />
    </div>
  )
}
