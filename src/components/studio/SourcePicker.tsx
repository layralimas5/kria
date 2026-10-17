import clsx from 'clsx'
import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Generation, ImageSource, Persona } from '@/domain/types'
import { MediaView } from '../MediaView'
interface SourcePickerProps {
  readonly personas: readonly Persona[]
  readonly images: readonly Generation[]
  readonly value: ImageSource | null
  readonly onChange: (source: ImageSource) => void
}

interface OptionProps {
  readonly selected: boolean
  readonly label: string
  readonly path: string | null
  readonly onSelect: () => void
}

function SourceOption({ selected, label, path, onSelect }: OptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      className={clsx(
        'group relative shrink-0 overflow-hidden rounded-xl border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        selected ? 'border-accent' : 'border-transparent hover:border-white/20',
      )}
    >
      <MediaView path={path} kind="image" alt="" className="size-20" />
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-4 text-left text-[11px] text-zinc-100">
        {label}
      </span>
      {selected && (
        <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-accent text-accent-ink">
          <Check className="size-3" aria-hidden="true" />
        </span>
      )}
    </button>
  )
}

export function SourcePicker({ personas, images, value, onChange }: SourcePickerProps) {
  const isSelected = (type: ImageSource['type'], id: string) => value?.type === type && value.id === id

  if (personas.length === 0 && images.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-400">
        Esse modelo parte de uma imagem. Gere uma foto primeiro ou{' '}
        <Link to="/personas" className="text-accent underline-offset-4 hover:underline">
          crie uma persona
        </Link>
        .
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {personas.length > 0 && (
        <div>
          <p id="source-personas" className="mb-2 text-sm font-medium text-zinc-300">
            Persona
          </p>
          <div role="radiogroup" aria-labelledby="source-personas" className="flex gap-2 overflow-x-auto pb-1">
            {personas.map((persona) => (
              <SourceOption
                key={persona.id}
                label={persona.name}
                path={persona.image_path}
                selected={isSelected('persona', persona.id)}
                onSelect={() => onChange({ type: 'persona', id: persona.id })}
              />
            ))}
          </div>
        </div>
      )}
      {images.length > 0 && (
        <div>
          <p id="source-images" className="mb-2 text-sm font-medium text-zinc-300">
            Ou uma imagem sua
          </p>
          <div role="radiogroup" aria-labelledby="source-images" className="flex gap-2 overflow-x-auto pb-1">
            {images.map((image) => (
              <SourceOption
                key={image.id}
                label={image.prompt}
                path={image.output_path}
                selected={isSelected('image', image.id)}
                onSelect={() => onChange({ type: 'image', id: image.id })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
