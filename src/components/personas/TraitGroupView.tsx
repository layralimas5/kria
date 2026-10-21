import clsx from 'clsx'
import { Check, Sparkles } from 'lucide-react'
import { useId } from 'react'
import type { TraitGroup, TraitGroupId, TraitOption } from '@/domain/personaTraits'
import { TRAIT_IMAGES } from '@/domain/traitImages'
import { NICHE_ICONS } from './traitIcons'
import { TraitArt } from './TraitArt'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface'

interface OptionProps {
  readonly groupId: TraitGroupId
  readonly option: TraitOption
  readonly selected: boolean
  readonly multiple: boolean
  readonly onToggle: () => void
  readonly hairTint?: string
}

function SelectedMark() {
  return (
    <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-accent text-accent-ink shadow">
      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
    </span>
  )
}

/** Opção com imagem: a foto gerada, ou a ilustração enquanto a foto não existe. */
function PhotoTile({ groupId, option, selected, multiple, onToggle, hairTint }: OptionProps) {
  const photo = TRAIT_IMAGES[`${groupId}-${option.value}`]
  return (
    <button
      type="button"
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onToggle}
      className={clsx(
        'group relative overflow-hidden rounded-xl bg-surface-2 text-left ring-1 transition-all',
        FOCUS,
        selected ? 'ring-2 ring-accent' : 'ring-white/[0.06] hover:ring-white/25',
      )}
    >
      <span className="block aspect-square overflow-hidden">
        {photo ? (
          <img src={photo} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
        ) : (
          <TraitArt group={groupId} value={option.value} hairTint={hairTint} className="size-full transition-transform duration-300 group-hover:scale-[1.04]" />
        )}
      </span>
      <span
        className={clsx(
          'block truncate px-2 py-2 text-center text-[12px] font-semibold transition-colors',
          selected ? 'bg-accent/15 text-zinc-50' : 'text-zinc-300',
        )}
      >
        {option.label}
      </span>
      {selected && <SelectedMark />}
    </button>
  )
}

function IconTile({ option, selected, multiple, onToggle }: OptionProps) {
  const Icon = NICHE_ICONS[option.value] ?? Sparkles
  return (
    <button
      type="button"
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onToggle}
      className={clsx(
        'relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl p-2 ring-1 transition-all',
        FOCUS,
        selected ? 'bg-accent/10 text-zinc-50 ring-2 ring-accent' : 'bg-surface-2 text-zinc-300 ring-white/[0.06] hover:ring-white/25',
      )}
    >
      <Icon className={clsx('size-6', selected ? 'text-accent-soft' : 'text-zinc-400')} aria-hidden="true" />
      <span className="text-[12px] font-semibold">{option.label}</span>
      {selected && <SelectedMark />}
    </button>
  )
}

function Chip({ option, selected, multiple, onToggle }: OptionProps) {
  return (
    <button
      type="button"
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onToggle}
      className={clsx(
        'inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-[13px] font-semibold transition-colors',
        FOCUS,
        selected ? 'bg-zinc-100 text-zinc-900' : 'bg-surface-2 text-zinc-300 ring-1 ring-white/[0.06] hover:text-zinc-50 hover:ring-white/20',
      )}
    >
      {selected && multiple && <Check className="size-3.5" aria-hidden="true" />}
      {option.label}
    </button>
  )
}

function Swatch({ option, selected, multiple, onToggle }: OptionProps) {
  return (
    <button
      type="button"
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      aria-label={option.label}
      title={option.label}
      onClick={onToggle}
      className={clsx('grid size-11 place-items-center rounded-full transition-transform hover:scale-105', FOCUS)}
    >
      <span
        className={clsx(
          'grid size-9 place-items-center rounded-full ring-offset-[3px] ring-offset-surface-2 transition-all',
          selected ? 'ring-2 ring-accent' : 'ring-1 ring-white/15',
        )}
        style={{ backgroundColor: option.swatch }}
      >
        {selected && <Check className="size-4 text-white mix-blend-difference" strokeWidth={3} aria-hidden="true" />}
      </span>
    </button>
  )
}

const OPTION_COMPONENT = { photos: PhotoTile, tiles: IconTile, chips: Chip, swatches: Swatch } as const
const OPTION_LAYOUT = {
  photos: 'grid grid-cols-3 gap-2.5 sm:grid-cols-4 xl:grid-cols-6',
  tiles: 'grid grid-cols-3 gap-2.5 sm:grid-cols-5 xl:grid-cols-9',
  chips: 'flex flex-wrap gap-1.5',
  swatches: 'flex flex-wrap gap-0.5',
} as const

interface TraitGroupViewProps {
  readonly group: TraitGroup
  readonly values: readonly string[]
  readonly onToggle: (value: string) => void
  /** Cor do cabelo escolhida, aplicada nas ilustrações de corte e barba. */
  readonly hairTint?: string
}

/** Um grupo de características: título, o que está escolhido e as opções. */
export function TraitGroupView({ group, values, onToggle, hairTint }: TraitGroupViewProps) {
  const titleId = useId()
  const Option = OPTION_COMPONENT[group.display]
  const chosen = group.options.filter((option) => values.includes(option.value)).map((option) => option.label)

  return (
    <section
      aria-labelledby={titleId}
      className={clsx(group.display === 'swatches' && 'rounded-2xl bg-surface-2/60 p-3 ring-1 ring-white/[0.04]')}
    >
      <div className="mb-2.5 flex items-baseline justify-between gap-3 px-0.5">
        <h3 id={titleId} className="text-[14px] font-bold text-zinc-100">
          {group.label}
        </h3>
        <span className="truncate text-xs font-semibold text-zinc-500" aria-live="polite">
          {chosen.length > 0 ? chosen.join(', ') : group.multiple ? 'Escolha quantos quiser' : 'Opcional'}
        </span>
      </div>
      <div role={group.multiple ? 'group' : 'radiogroup'} aria-labelledby={titleId} className={OPTION_LAYOUT[group.display]}>
        {group.options.map((option) => (
          <Option
            key={option.value}
            groupId={group.id}
            option={option}
            selected={values.includes(option.value)}
            multiple={group.multiple ?? false}
            onToggle={() => onToggle(option.value)}
            hairTint={hairTint}
          />
        ))}
      </div>
    </section>
  )
}
