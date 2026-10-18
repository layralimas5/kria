import type { ReactNode } from 'react'

interface SectionHeadingProps {
  readonly id: string
  readonly title: ReactNode
  readonly lead?: string
  /** Botões alinhados à direita no desktop. */
  readonly actions?: ReactNode
}

export function SectionHeading({ id, title, lead, actions }: SectionHeadingProps) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 id={id} className="font-display text-[1.9rem] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-accent md:text-[2.6rem]">
          {title}
        </h2>
        {lead && <p className="mt-2.5 max-w-2xl text-pretty text-[15px] text-zinc-400">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </div>
  )
}
