import clsx from 'clsx'
import { Check, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Step } from '@/domain/home'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const RADIUS = 16
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Primeiros passos com anel de progresso. Some quando tudo está feito. */
export function NextSteps({ steps }: { readonly steps: readonly Step[] }) {
  const done = steps.filter((step) => step.done).length
  if (steps.length === 0 || done === steps.length) return null
  const share = done / steps.length

  return (
    <section aria-labelledby="steps-title" className="card-premium rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 40 40" className="size-11 shrink-0 -rotate-90" aria-hidden="true">
          <circle cx="20" cy="20" r={RADIUS} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="4" />
          <circle
            cx="20"
            cy="20"
            r={RADIUS}
            fill="none"
            stroke="var(--color-accent-soft)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - share)}
          />
        </svg>
        <div>
          <h2 id="steps-title" className="font-headline text-lg text-zinc-100">
            Primeiros passos
          </h2>
          <p className="text-xs text-zinc-500">
            {done} de {steps.length} feitos
          </p>
        </div>
      </div>
      <ol className="mt-4 space-y-1">
        {steps.map((step) => (
          <li key={step.id}>
            {step.done ? (
              <p className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-zinc-500">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                <span className="line-through decoration-zinc-600">{step.title}</span>
                <span className="sr-only">(feito)</span>
              </p>
            ) : (
              <Link to={step.to} className={clsx('group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]', FOCUS)}>
                <span className="size-6 shrink-0 rounded-full border border-dashed border-white/20" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-zinc-100">{step.title}</span>
                  <span className="block text-xs text-zinc-500">{step.description}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-soft" aria-hidden="true" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
