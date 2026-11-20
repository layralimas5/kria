import { ArrowLeft, CreditCard, Lock, QrCode } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PixPayerForm } from '@/components/billing/PixPayerForm'
import { Logo } from '@/components/Logo'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { track } from '@/lib/analytics'
import { errorMessage, startSubscription, type SubscriptionPayment } from '@/lib/api'

const PLAN_SLUG = /^[a-z0-9-]{2,40}$/

type Step = 'choose' | 'pix' | 'redirecting'

interface MethodButtonProps {
  readonly icon: ReactNode
  readonly title: string
  readonly description: string
  readonly onClick: () => void
}

function MethodButton({ icon, title, description, onClick }: MethodButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-2xl bg-surface p-4 text-left ring-1 ring-white/[0.08] transition-colors hover:bg-surface-2 hover:ring-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-soft">{icon}</span>
      <span>
        <span className="block font-semibold text-zinc-50">{title}</span>
        <span className="mt-0.5 block text-sm text-zinc-400">{description}</span>
      </span>
    </button>
  )
}

/**
 * Ponte entre os planos e o pagamento: chega aqui já logado (RequireAuth leva ao login e volta com o
 * plano). No cartão vai para o checkout recorrente do Asaas; no Pix pede nome e CPF e vai para a fatura
 * da primeira cobrança, com o QR Code.
 */
export function SubscribePage() {
  const { plan = '' } = useParams()
  const validPlan = PLAN_SLUG.test(plan)
  const [step, setStep] = useState<Step>('choose')
  const [error, setError] = useState<string | null>(validPlan ? null : 'Plano inválido.')

  async function pay(payment: SubscriptionPayment) {
    setError(null)
    setStep('redirecting')
    track({ name: 'begin_checkout', params: { plan } })
    try {
      window.location.assign(await startSubscription(plan, payment))
    } catch (subscribeError) {
      setError(errorMessage(subscribeError))
      setStep(payment.method === 'pix' ? 'pix' : 'choose')
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        {step === 'redirecting' ? (
          <div className="mt-10 flex flex-col items-center gap-4 text-center" role="status">
            <Spinner className="size-7 text-accent-soft" />
            <p className="text-lg font-semibold text-zinc-50">Abrindo o pagamento seguro</p>
          </div>
        ) : (
          <div className="mt-10 space-y-4">
            <h1 className="text-center text-lg font-semibold text-zinc-50">
              {step === 'pix' ? 'Dados para a cobrança Pix' : 'Como você quer pagar?'}
            </h1>
            {error && <Notice tone="error">{error}</Notice>}

            {validPlan && step === 'choose' && (
              <div className="space-y-3">
                <MethodButton
                  icon={<CreditCard className="size-5" aria-hidden="true" />}
                  title="Cartão de crédito"
                  description="Renova sozinho todo mês."
                  onClick={() => void pay({ method: 'card' })}
                />
                <MethodButton
                  icon={<QrCode className="size-5" aria-hidden="true" />}
                  title="Pix"
                  description="Uma cobrança Pix por mês, enviada no seu e-mail."
                  onClick={() => {
                    setError(null)
                    setStep('pix')
                  }}
                />
              </div>
            )}

            {step === 'pix' && <PixPayerForm onSubmit={(payer) => void pay({ method: 'pix', ...payer })} onBack={() => setStep('choose')} />}

            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-zinc-500">
              <Lock className="size-3.5" aria-hidden="true" /> Pagamento pelo Asaas. O Vynkio não vê os dados do seu cartão.
            </p>
            <Link
              to="/assinatura"
              className="flex items-center justify-center gap-2 rounded-xl py-2 text-sm text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Ver planos
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
