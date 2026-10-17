import type { ReactNode } from 'react'

interface PageHeaderProps {
  readonly title: string
  readonly description: string
  readonly action?: ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-zinc-50 md:text-3xl">{title}</h1>
        <p className="mt-1.5 text-sm text-pretty text-zinc-400">{description}</p>
      </div>
      {action}
    </header>
  )
}
