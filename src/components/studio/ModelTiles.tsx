import clsx from 'clsx'
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
    <div role="radiogroup" aria-label="Modelos" className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 scrollbar-none sm:-mx-5 sm:px-5 lg:mx-0 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] lg:px-0">
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
              'group flex min-h-28 w-[13.5rem] shrink-0 snap-start flex-col rounded-2xl bg-surface p-4 text-left ring-1 lg:w-auto transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              active ? 'ring-accent/70 bg-surface-2' : 'ring-white/[0.06] hover:bg-surface-2 hover:ring-white/15',
            )}
          >
            <span className="flex items-start justify-between gap-2">
              <ModelIcon model={model} className={clsx('size-5', active ? 'text-accent' : 'text-zinc-300')} />
              <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-400">
                {model.kind === 'video' ? 'Vídeo' : 'Imagem'}
              </span>
            </span>
            <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-4 text-[15px] font-bold text-zinc-50">
              {model.name}
              {model.badge && <Badge>{model.badge}</Badge>}
            </span>
            <span className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{model.description}</span>
          </button>
        )
      })}
    </div>
  )
}
