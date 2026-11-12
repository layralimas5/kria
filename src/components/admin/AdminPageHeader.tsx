import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

interface AdminPageHeaderProps {
  /** Grupo do menu em que a tela mora ("Operação", "Comercial"). */
  readonly eyebrow: string
  readonly title: string
  readonly description: ReactNode
  readonly actions?: ReactNode
}

/** A última palavra do título leva o degradê da marca, como nas telas do app. */
function splitTitle(title: string): [string, string] {
  const index = title.lastIndexOf(' ')
  return index < 0 ? ['', title] : [title.slice(0, index + 1), title.slice(index + 1)]
}

export function AdminPageHeader({ eyebrow, title, description, actions }: AdminPageHeaderProps) {
  const reduceMotion = useReducedMotion()
  const [head, tail] = splitTitle(title)
  return (
    <motion.header
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-wrap items-end justify-between gap-4"
    >
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-soft">{eyebrow}</p>
        <h1 className="mt-1.5 font-headline text-3xl text-balance text-zinc-50 md:text-4xl">
          {head}
          <span className="bg-gradient-to-r from-accent-soft via-violet-300 to-galaxy bg-clip-text text-transparent">{tail}</span>
        </h1>
        <div className="mt-2 max-w-2xl text-sm text-pretty text-zinc-400">{description}</div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2 print:hidden">{actions}</div>}
    </motion.header>
  )
}
