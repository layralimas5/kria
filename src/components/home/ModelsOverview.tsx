import clsx from 'clsx'
import { Clapperboard, ImageIcon, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { modelSpecs } from '@/domain/format'
import { canUseModel } from '@/domain/plans'
import type { Model } from '@/domain/types'
import { Badge } from '../ui/Badge'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

interface ModelsOverviewProps {
  readonly models: readonly Model[]
  readonly planSlug: string
  /** Quantas vezes a pessoa usou cada modelo: os mais usados ganham o selo de favorito. */
  readonly usage: ReadonlyMap<string, number>
}

/** Modelos ativos no catálogo, com preço e se o plano atual libera. */
export function ModelsOverview({ models, planSlug, usage }: ModelsOverviewProps) {
  const favorites = new Set(
    [...usage.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([slug]) => slug),
  )

  return (
    <section aria-labelledby="models-title">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="models-title" className="font-headline text-lg text-zinc-100">
          Modelos disponíveis
        </h2>
        <Link to="/assinatura" className={clsx('rounded text-sm font-semibold text-zinc-400 hover:text-zinc-100', FOCUS)}>
          Ver planos
        </Link>
      </div>
      <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-3xl bg-surface ring-1 ring-white/[0.06]">
        {models.map((model) => {
          const allowed = canUseModel(model.allowed_plans, planSlug)
          const Icon = model.kind === 'video' ? Clapperboard : ImageIcon
          return (
            <li key={model.slug}>
              <Link
                to={allowed ? `/estudio?modo=${model.kind === 'video' ? 'video' : 'imagem'}` : '/assinatura'}
                className={clsx('flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]', FOCUS)}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-zinc-300">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-zinc-100">
                    {model.name}
                    {model.badge && <Badge>{model.badge}</Badge>}
                    {favorites.has(model.slug) && (
                      <span className="rounded-md bg-white/[0.06] px-1.5 py-px text-[10px] font-bold uppercase text-zinc-300">Mais usado</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-zinc-500">
                    {[model.description, ...modelSpecs(model.defaults)].join(' · ')}
                  </span>
                </span>
                {allowed ? (
                  <span className="shrink-0 text-xs font-bold tabular-nums text-zinc-400">{model.credits} cr</span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-zinc-500">
                    <Lock className="size-3.5" aria-hidden="true" /> Plano pago
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
