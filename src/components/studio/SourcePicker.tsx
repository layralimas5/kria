import clsx from 'clsx'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
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
      title={label}
      onClick={onSelect}
      className={clsx(
        'relative overflow-hidden rounded-xl ring-2 transition-all focus-visible:outline-none focus-visible:ring-accent',
        selected ? 'ring-accent' : 'ring-transparent hover:ring-white/25',
      )}
    >
      <MediaView path={path} kind="image" alt="" className="aspect-[4/5] w-full" />
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-4 text-left text-[11px] font-semibold text-zinc-100">
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

function Group({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div>
      <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{title}</p>
      <div role="radiogroup" aria-label={title} className="grid grid-cols-4 gap-2">
        {children}
      </div>
    </div>
  )
}

export function SourcePicker({ personas, images, value, onChange }: SourcePickerProps) {
  const isSelected = (type: ImageSource['type'], id: string) => value?.type === type && value.id === id

  if (personas.length === 0 && images.length === 0) {
    return (
      <p className="p-2 text-sm text-zinc-400">
        Esse modelo parte de uma imagem. Gere uma foto primeiro ou{' '}
        <Link to="/personas" className="font-semibold text-accent-soft underline-offset-4 hover:underline">
          crie uma persona
        </Link>
        .
      </p>
    )
  }

  return (
    <div className="max-h-[60vh] space-y-4 overflow-y-auto p-1">
      {personas.length > 0 && (
        <Group title="Personas">
          {personas.map((persona) => (
            <SourceOption
              key={persona.id}
              label={persona.name}
              path={persona.image_path}
              selected={isSelected('persona', persona.id)}
              onSelect={() => onChange({ type: 'persona', id: persona.id })}
            />
          ))}
        </Group>
      )}
      {images.length > 0 && (
        <Group title="Suas imagens">
          {images.map((image) => (
            <SourceOption
              key={image.id}
              label={image.prompt}
              path={image.output_path}
              selected={isSelected('image', image.id)}
              onSelect={() => onChange({ type: 'image', id: image.id })}
            />
          ))}
        </Group>
      )}
    </div>
  )
}
