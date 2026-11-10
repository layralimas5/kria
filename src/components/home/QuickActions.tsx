import clsx from 'clsx'
import {
  ArrowUpRight,
  Clapperboard,
  FolderKanban,
  ImageIcon,
  Lightbulb,
  Megaphone,
  PenLine,
  ScrollText,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { HomeAction, HomeActionId } from '@/domain/goals'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

const ICONS: Record<HomeActionId, LucideIcon> = {
  video: Clapperboard,
  image: ImageIcon,
  persona: UserRound,
  ugc: Megaphone,
  copy: PenLine,
  script: ScrollText,
  ideas: Lightbulb,
  projects: FolderKanban,
}

interface QuickActionsProps {
  readonly actions: readonly HomeAction[]
}

/** As portas do dashboard: só o que o plano da pessoa libera. */
export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <section aria-labelledby="quick-title">
      <h2 id="quick-title" className="font-headline mb-3 text-lg text-zinc-100">
        Criação rápida
      </h2>
      <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {actions.map((action, index) => {
          const Icon = ICONS[action.id]
          return (
            <li key={action.id}>
              <Link
                to={action.to}
                className={clsx(
                  'card-premium card-hover group relative flex h-full flex-col gap-3 overflow-hidden rounded-3xl p-4 md:p-5',
                  FOCUS,
                  index === 0 && 'border-accent/40 bg-[linear-gradient(135deg,rgb(124_58_237/0.22),rgb(124_58_237/0.04)_60%),var(--color-surface)]',
                )}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-accent/30 to-accent/10 text-accent-soft ring-1 ring-accent/25 transition-transform duration-200 group-hover:scale-105">
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <ArrowUpRight
                      className="size-4 shrink-0 text-zinc-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-soft"
                      aria-hidden="true"
                    />
                </span>
                <span className="font-semibold text-zinc-50">{action.title}</span>
                <span className="hidden text-sm text-zinc-400 sm:block">{action.description}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
