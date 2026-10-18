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
        <h1 className="font-headline text-4xl text-zinc-50 md:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-pretty text-zinc-400 md:text-base">{description}</p>
      </div>
      {action}
    </header>
  )
}
