import clsx from 'clsx'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { QuickAction } from '@/domain/goals'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function QuickActions({ actions }: { readonly actions: readonly QuickAction[] }) {
  return (
    <section aria-labelledby="quick-title">
      <h2 id="quick-title" className="font-headline mb-3 text-lg text-zinc-100">
        Criação rápida
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action, index) => (
          <li key={action.title}>
            <Link
              to={action.to}
              className={clsx(
                'group flex h-full flex-col justify-between gap-6 rounded-3xl p-5 ring-1 transition-colors',
                FOCUS,
                index === 0
                  ? 'bg-gradient-to-br from-accent/[0.16] to-surface ring-accent/40 hover:ring-accent/70'
                  : 'bg-surface ring-white/[0.06] hover:bg-surface-2',
              )}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="font-semibold text-zinc-50">{action.title}</span>
                <ArrowUpRight
                  className="size-4 shrink-0 text-zinc-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-soft"
                  aria-hidden="true"
                />
              </span>
              <span className="text-sm text-zinc-400">{action.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
