import clsx from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, Sparkles } from 'lucide-react'
import { useId } from 'react'
import type { TraitGroup, TraitOption } from '@/domain/personaTraits'
import { GROUP_ICONS, NICHE_ICONS } from './traitIcons'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

interface OptionProps {
  readonly option: TraitOption
  readonly selected: boolean
  readonly onToggle: () => void
  readonly multiple: boolean
}

function Tile({ option, selected, onToggle, multiple }: OptionProps) {
  const Icon = NICHE_ICONS[option.value] ?? Sparkles
  return (
    <button
      type="button"
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onToggle}
      className={clsx(
        'flex aspect-[4/5] flex-col items-center justify-between rounded-xl p-2 pt-4 transition-all',
        FOCUS,
        selected
          ? 'bg-zinc-100 text-zinc-900 ring-[3px] ring-accent'
          : 'bg-zinc-100/95 text-zinc-800 hover:bg-white',
      )}
    >
      <span className={clsx('grid size-12 place-items-center rounded-full', selected ? 'bg-accent' : 'bg-zinc-200')}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="text-[12px] font-semibold">{option.label}</span>
    </button>
  )
}

function Chip({ option, selected, onToggle, multiple }: OptionProps) {
  return (
    <button
      type="button"
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onToggle}
      className={clsx(
        'inline-flex min-h-8 items-center gap-1 rounded-lg px-3 text-[13px] font-semibold transition-colors',
        FOCUS,
        selected ? 'bg-zinc-100 text-zinc-900' : 'bg-surface-3 text-zinc-300 hover:bg-white/10 hover:text-zinc-100',
      )}
    >
      {selected && multiple && <Check className="size-3.5" aria-hidden="true" />}
      {option.label}
    </button>
  )
}

function Swatch({ option, selected, onToggle, multiple }: OptionProps) {
  return (
    <button
      type="button"
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      aria-label={option.label}
      title={option.label}
      onClick={onToggle}
      className={clsx('group flex flex-col items-center gap-1.5 rounded-lg p-1', FOCUS)}
    >
      <span
        className={clsx(
          'grid size-9 place-items-center rounded-full ring-offset-2 ring-offset-surface-2 transition-all',
          selected ? 'ring-2 ring-accent' : 'ring-1 ring-white/15 group-hover:ring-white/40',
        )}
        style={{ backgroundColor: option.swatch }}
      >
        {selected && <Check className="size-4 text-white mix-blend-difference" aria-hidden="true" />}
      </span>
      <span className="line-clamp-1 text-[10px] font-medium text-zinc-400">{option.label}</span>
    </button>
  )
}

const OPTION_COMPONENT = { tiles: Tile, chips: Chip, swatches: Swatch } as const
const OPTION_LAYOUT = {
  tiles: 'grid grid-cols-3 gap-2',
  chips: 'flex flex-wrap gap-1.5',
  swatches: 'grid grid-cols-5 gap-1',
} as const

interface TraitAccordionProps {
  readonly group: TraitGroup
  readonly values: readonly string[]
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onToggle: (value: string) => void
}

export function TraitAccordion({ group, values, open, onOpenChange, onToggle }: TraitAccordionProps) {
  const panelId = useId()
  const reduceMotion = useReducedMotion()
  const Icon = GROUP_ICONS[group.id]
  const Option = OPTION_COMPONENT[group.display]
  const summary = group.options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label)
    .join(', ')

  return (
    <div className={clsx('rounded-2xl transition-colors', open ? 'bg-surface-2' : 'bg-surface-2/70 hover:bg-surface-2')}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onOpenChange(!open)}
          className={clsx('flex min-h-11 w-full items-center gap-2.5 rounded-2xl px-3.5 text-left', FOCUS)}
        >
          <Icon className={clsx('size-4 shrink-0', summary ? 'text-accent' : 'text-zinc-400')} aria-hidden="true" />
          <span className="shrink-0 text-[14px] font-semibold text-zinc-300">
            {group.label} <span className="text-zinc-500">· {group.options.length}</span>
          </span>
          <span className="ml-auto truncate pl-2 text-xs font-semibold text-zinc-100">{summary}</span>
          <ChevronDown
            className={clsx('size-4 shrink-0 text-zinc-500 transition-transform duration-200', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div
              role={group.multiple ? 'group' : 'radiogroup'}
              aria-label={group.label}
              className={clsx('px-2.5 pb-3 pt-0.5', OPTION_LAYOUT[group.display])}
            >
              {group.options.map((option) => (
                <Option
                  key={option.value}
                  option={option}
                  selected={values.includes(option.value)}
                  multiple={group.multiple ?? false}
                  onToggle={() => onToggle(option.value)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
