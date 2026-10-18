import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { GOALS } from '@/domain/goals'
import type { Goal } from '@/domain/types'
import { useAccount } from '@/hooks/useAccount'
import { errorMessage } from '@/lib/api'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'

/** Primeiro acesso: uma pergunta que personaliza os atalhos do início. */
export function OnboardingPage() {
  const { loading, preferences, setGoal } = useAccount()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [choice, setChoice] = useState<Goal | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center text-zinc-500" role="status" aria-label="Carregando">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (preferences?.onboarded_at && !saving) return <Navigate to="/inicio" replace />

  async function handleContinue() {
    if (!choice) return
    setSaving(true)
    setError(null)
    try {
      await setGoal(choice)
      navigate('/inicio', { replace: true })
    } catch (saveError) {
      setError(errorMessage(saveError))
      setSaving(false)
    }
  }

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-3xl flex-col overflow-x-clip px-4 py-8 sm:px-6 sm:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 size-[32rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
      <Logo />
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative mt-12 sm:mt-16"
      >
        <p className="text-sm font-semibold text-accent">Boas-vindas à Kria</p>
        <h1 id="goal-title" className="font-headline mt-3 text-4xl text-balance text-zinc-50 sm:text-5xl">
          Qual é seu principal objetivo com o Kria IA?
        </h1>
        <p className="mt-4 text-pretty text-zinc-400">A gente organiza os atalhos do início com base na sua resposta. Dá para mudar depois.</p>

        <div role="radiogroup" aria-labelledby="goal-title" className="mt-8 grid gap-3 sm:grid-cols-2">
          {GOALS.map((goal) => {
            const selected = goal.value === choice
            return (
              <button
                key={goal.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setChoice(goal.value)}
                className={clsx(
                  'flex items-start gap-3 rounded-2xl p-4 text-left ring-1 transition-colors',
                  FOCUS,
                  selected ? 'bg-accent/10 ring-accent' : 'bg-surface ring-white/[0.07] hover:bg-surface-2',
                )}
              >
                <span
                  aria-hidden="true"
                  className={clsx(
                    'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1',
                    selected ? 'bg-accent text-accent-ink ring-accent' : 'ring-white/20',
                  )}
                >
                  {selected && <Check className="size-3" />}
                </span>
                <span>
                  <span className="block font-semibold text-zinc-100">{goal.label}</span>
                  <span className="mt-0.5 block text-sm text-zinc-400">{goal.description}</span>
                </span>
              </button>
            )
          })}
        </div>

        {error && (
          <div className="mt-5">
            <Notice tone="error">{error}</Notice>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <Button onClick={() => void handleContinue()} disabled={!choice} loading={saving} className="min-h-11 w-full px-6 sm:w-auto">
            Continuar
          </Button>
        </div>
      </motion.div>
    </main>
  )
}
