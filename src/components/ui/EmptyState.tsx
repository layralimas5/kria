import type { ReactNode } from 'react'

interface EmptyStateProps {
  readonly icon: ReactNode
  readonly title: string
  readonly description: string
  readonly action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-3xl bg-surface px-6 py-16 text-center ring-1 ring-white/[0.05]">
      <div className="grid size-12 place-items-center rounded-xl bg-surface-3 text-accent-soft">{icon}</div>
      <h3 className="font-headline mt-5 text-2xl text-zinc-100">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-pretty text-zinc-400">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
