import type { ReactNode } from 'react'

interface SectionHeadingProps {
  readonly id: string
  readonly eyebrow: string
  readonly title: ReactNode
  readonly lead?: string
}

export function SectionHeading({ id, eyebrow, title, lead }: SectionHeadingProps) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-balance text-3xl font-semibold tracking-tight text-zinc-50 md:text-5xl">
        {title}
      </h2>
      {lead && <p className="mt-4 text-pretty text-base text-zinc-400 md:text-lg">{lead}</p>}
    </div>
  )
}
