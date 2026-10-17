import clsx from 'clsx'
import type { Model } from '@/domain/types'

interface ModelPickerProps {
  readonly models: readonly Model[]
  readonly value: string | null
  readonly onChange: (slug: string) => void
}

export function ModelPicker({ models, value, onChange }: ModelPickerProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-zinc-300">Modelo</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {models.map((model) => {
          const selected = model.slug === value
          return (
            <label
              key={model.slug}
              className={clsx(
                'relative flex cursor-pointer flex-col gap-1 rounded-xl border p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
                selected ? 'border-accent/60 bg-accent/[0.06]' : 'border-white/10 bg-white/[0.02] hover:border-white/20',
              )}
            >
              <input
                type="radio"
                name="model"
                value={model.slug}
                checked={selected}
                onChange={() => onChange(model.slug)}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-100">{model.name}</span>
                <span className={clsx('text-xs tabular-nums', selected ? 'text-accent' : 'text-zinc-500')}>
                  {model.credits} cr
                </span>
              </span>
              <span className="text-xs text-zinc-400">{model.description}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
