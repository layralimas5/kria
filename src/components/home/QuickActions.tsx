import clsx from 'clsx'
import {
  ArrowUpRight,
  Clapperboard,
  FolderKanban,
  ImageIcon,
  Lightbulb,
  Lock,
  Megaphone,
  PenLine,
  ScrollText,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { HomeAction, HomeActionId } from '@/domain/goals'
import type { PlanTool } from '@/domain/plans'

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
  readonly hasTool: (tool: PlanTool) => boolean
}

/** As oito portas do dashboard. O que o plano não inclui aparece com cadeado e leva aos planos. */
export function QuickActions({ actions, hasTool }: QuickActionsProps) {
  return (
    <section aria-labelledby="quick-title">
      <h2 id="quick-title" className="font-headline mb-3 text-lg text-zinc-100">
        Criação rápida
      </h2>
      <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {actions.map((action, index) => {
          const Icon = ICONS[action.id]
          const locked = action.tool !== undefined && !hasTool(action.tool)
          return (
            <li key={action.id}>
              <Link
                to={locked ? '/assinatura' : action.to}
                aria-label={locked ? `${action.title}: disponível em outro plano. Ver planos` : undefined}
                className={clsx(
                  'group flex h-full flex-col gap-3 rounded-3xl p-4 ring-1 transition-colors md:p-5',
                  FOCUS,
                  index === 0 && !locked
                    ? 'bg-gradient-to-br from-accent/[0.16] to-surface ring-accent/40 hover:ring-accent/70'
                    : 'bg-surface ring-white/[0.06] hover:bg-surface-2',
                )}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className={clsx('grid size-9 place-items-center rounded-xl', locked ? 'bg-white/[0.04] text-zinc-500' : 'bg-accent/15 text-accent-soft')}>
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  {locked ? (
                    <Lock className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
                  ) : (
                    <ArrowUpRight
                      className="size-4 shrink-0 text-zinc-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-soft"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className={clsx('font-semibold', locked ? 'text-zinc-400' : 'text-zinc-50')}>{action.title}</span>
                <span className="hidden text-sm text-zinc-400 sm:block">{locked ? 'Disponível em outro plano. Toque para ver.' : action.description}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
