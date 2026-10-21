import clsx from 'clsx'
import { Check, ChevronDown, Clapperboard, ImageIcon } from 'lucide-react'
import type { Model } from '@/domain/types'
import { Badge } from '../ui/Badge'
import { Popover } from '../ui/Popover'

export const CHIP =
  'inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-surface-3/80 px-2.5 text-[13px] font-semibold text-zinc-100 transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function ModelIcon({ model, className }: { readonly model: Pick<Model, 'kind'>; readonly className?: string }) {
  const Icon = model.kind === 'video' ? Clapperboard : ImageIcon
  return <Icon className={clsx('size-4 shrink-0', className)} aria-hidden="true" />
}

interface ModelMenuProps {
  readonly models: readonly Model[]
  readonly value: Model | null
  readonly onChange: (slug: string) => void
}

export function ModelMenu({ models, value, onChange }: ModelMenuProps) {
  return (
    <Popover
      label="Escolher modelo"
      className="w-[min(88vw,22rem)]"
      trigger={({ open, toggle, controls }) => (
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls={controls} aria-haspopup="dialog" className={CHIP}>
          {value && <ModelIcon model={value} className="text-accent-soft" />}
          {value?.name ?? 'Modelo'}
          <ChevronDown className={clsx('size-3.5 text-zinc-500 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <div role="radiogroup" aria-label="Modelos">
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Modelos</p>
          {models.map((model) => {
            const selected = model.slug === value?.slug
            return (
              <button
                key={model.slug}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  onChange(model.slug)
                  close()
                }}
                className={clsx(
                  'flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  selected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]',
                )}
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-zinc-300">
                  <ModelIcon model={model} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
                    {model.name}
                    {model.badge && <Badge>{model.badge}</Badge>}
                  </span>
                  <span className="block text-xs text-zinc-400">{model.description}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold tabular-nums text-zinc-400">
                  {model.credits} cr
                  {selected && <Check className="size-4 text-accent-soft" aria-hidden="true" />}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </Popover>
  )
}
