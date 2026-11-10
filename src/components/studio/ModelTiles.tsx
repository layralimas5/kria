import clsx from 'clsx'
import { ImagePlus } from 'lucide-react'
import type { Model } from '@/domain/types'
import { Badge } from '../ui/Badge'
import { ModelIcon } from './ModelMenu'

interface ModelTilesProps {
  readonly models: readonly Model[]
  readonly selected: string | null
  readonly onSelect: (slug: string) => void
}

/** Atalhos para os modelos, no topo do Estúdio. Clicar escolhe o modelo na caixa de prompt. */
export function ModelTiles({ models, selected, onSelect }: ModelTilesProps) {
  return (
    <div role="radiogroup" aria-label="Modelos" className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-none sm:-mx-5 sm:px-5 lg:mx-0 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] lg:px-0">
      {models.map((model) => {
        const active = model.slug === selected
        return (
          <button
            key={model.slug}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(model.slug)}
            className={clsx(
              'card-premium card-hover group relative isolate flex min-h-32 w-[14rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl p-4 text-left lg:w-auto',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              active && 'ring-1 ring-accent/60 shadow-[0_14px_40px_-20px_rgb(124_58_237/0.9)]',
            )}
          >
            {active && <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-accent/[0.18] via-transparent to-galaxy/[0.06]" />}
            <span className="flex items-start justify-between gap-2">
              <span className={clsx('grid size-9 place-items-center rounded-xl ring-1 transition-colors', active ? 'bg-accent/20 text-accent-soft ring-accent/30' : 'bg-white/[0.04] text-zinc-300 ring-white/[0.06]')}>
                <ModelIcon model={model} className="size-[18px]" />
              </span>
              <span className={clsx('rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums', active ? 'bg-accent/20 text-accent-soft' : 'bg-white/[0.05] text-zinc-400')}>
                {model.credits} créditos
              </span>
            </span>
            <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-4 text-[15px] font-bold text-zinc-50">
              {model.name}
              {model.badge && <Badge>{model.badge}</Badge>}
            </span>
            <span className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{model.description}</span>
            {model.requires_image && (
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
                <ImagePlus className="size-3" aria-hidden="true" /> Parte de uma imagem ou persona
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
