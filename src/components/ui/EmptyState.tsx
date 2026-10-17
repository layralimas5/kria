import type { ReactNode } from 'react'

interface EmptyStateProps {
  readonly icon: ReactNode
  readonly title: string
  readonly description: string
  readonly action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-xl bg-white/[0.04] text-zinc-400">{icon}</div>
      <h3 className="mt-4 font-medium text-zinc-100">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-pretty text-zinc-400">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
