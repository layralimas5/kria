import { ArrowLeft, Lock } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { errorMessage, startSubscription } from '@/lib/api'

const PLAN_SLUG = /^[a-z0-9-]{2,40}$/

/**
 * Ponte entre a landing e o checkout: chega aqui já logado (RequireAuth leva ao
 * login e volta com o plano), pede a assinatura e manda para o Asaas.
 */
export function SubscribePage() {
  const { plan = '' } = useParams()
  const [error, setError] = useState<string | null>(PLAN_SLUG.test(plan) ? null : 'Plano inválido.')
  const started = useRef(false)

  const start = useCallback(async () => {
    setError(null)
    try {
      window.location.assign(await startSubscription(plan))
    } catch (subscribeError) {
      setError(errorMessage(subscribeError))
    }
  }, [plan])

  useEffect(() => {
    // StrictMode monta duas vezes; o checkout só pode ser pedido uma.
    if (started.current || !PLAN_SLUG.test(plan)) return
    started.current = true
    void start()
  }, [plan, start])

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        {error ? (
          <div className="mt-10 space-y-4 text-left">
            <Notice tone="error">{error}</Notice>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => void start()} className="flex-1" disabled={!PLAN_SLUG.test(plan)}>
                Tentar de novo
              </Button>
              <Link
                to="/assinatura"
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 text-sm text-zinc-200 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ArrowLeft className="size-4" aria-hidden="true" /> Ver planos
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-10 flex flex-col items-center gap-4" role="status">
            <Spinner className="size-7 text-accent-soft" />
            <p className="text-lg font-semibold text-zinc-50">Abrindo o pagamento seguro</p>
            <p className="flex items-center gap-1.5 text-sm text-zinc-400">
              <Lock className="size-3.5" aria-hidden="true" /> Checkout do Asaas. O Vynkio não vê os dados do seu cartão.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
