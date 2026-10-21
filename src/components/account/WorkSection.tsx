import clsx from 'clsx'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface EmptyWorkProps {
  readonly icon: LucideIcon
  readonly title: string
  readonly description: string
  readonly actionLabel: string
  readonly actionTo: string
}

/** Cartão vazio no estilo "Ready to show your projects?": ilustração, frase e um botão. */
function EmptyWork({ icon: Icon, title, description, actionLabel, actionTo }: EmptyWorkProps) {
  return (
    <div className="flex flex-col gap-5 rounded-3xl p-6 ring-1 ring-white/[0.06] sm:flex-row sm:items-center sm:gap-8 sm:p-10">
      <div aria-hidden="true" className="relative h-24 w-32 shrink-0">
        <span className="absolute inset-0 -rotate-6 rounded-2xl bg-surface-3" />
        <span className="absolute inset-0 rotate-3 rounded-2xl bg-surface-2 ring-1 ring-white/10" />
        <span className="absolute inset-0 grid place-items-center rounded-2xl bg-gradient-to-br from-surface-3 to-surface ring-1 ring-white/10">
          <Icon className="size-8 text-accent-soft" />
        </span>
      </div>
      <div>
        <h3 className="text-lg font-bold text-zinc-50">{title}</h3>
        <p className="mt-1 text-sm text-zinc-400">{description}</p>
        <Link
          to={actionTo}
          className="mt-4 inline-flex min-h-10 items-center gap-1 rounded-xl bg-surface-3 px-4 text-[14px] font-bold text-zinc-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {actionLabel}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

interface WorkSectionProps {
  readonly title: string
  readonly count: number
  readonly empty: EmptyWorkProps
  readonly onSeeAll?: () => void
  readonly children: ReactNode
}

export function WorkSection({ title, count, empty, onSeeAll, children }: WorkSectionProps) {
  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-zinc-50">
          {title} {count > 0 && <span className="text-sm font-semibold text-zinc-500">{count}</span>}
        </h2>
        {onSeeAll && count > 0 && (
          <button
            type="button"
            onClick={onSeeAll}
            className={clsx('rounded text-sm font-semibold text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent')}
          >
            Ver tudo
          </button>
        )}
      </div>
      {count === 0 ? <EmptyWork {...empty} /> : children}
    </section>
  )
}
