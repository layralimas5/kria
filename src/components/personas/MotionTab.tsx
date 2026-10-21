import clsx from 'clsx'
import { Check, Clapperboard } from 'lucide-react'
import { Link } from 'react-router-dom'
import { modelSpecs } from '@/domain/format'
import type { Persona } from '@/domain/types'
import { MOTION_PRESETS, type PersonaMotion } from '@/hooks/usePersonaMotion'
import { MediaView } from '../MediaView'
import { Badge } from '../ui/Badge'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const SECTION_TITLE = 'mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500'

interface MotionTabProps {
  readonly motion: PersonaMotion
  readonly personas: readonly Persona[]
}

export function MotionTab({ motion, personas }: MotionTabProps) {
  return (
    <div className="space-y-5">
      <section>
        <p id="motion-persona" className={SECTION_TITLE}>
          Persona
        </p>
        {personas.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 p-4 text-sm text-zinc-400">
            Você ainda não tem persona. Crie uma na aba ao lado ou{' '}
            <Link to="/galeria" className="font-semibold text-accent-soft hover:underline">
              salve uma imagem da galeria
            </Link>
            .
          </p>
        ) : (
          <div role="radiogroup" aria-labelledby="motion-persona" className="grid grid-cols-3 gap-2">
            {personas.map((persona) => {
              const selected = persona.id === motion.personaId
              return (
                <button
                  key={persona.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => motion.setPersonaId(persona.id)}
                  className={clsx('relative overflow-hidden rounded-xl ring-2 transition-all', FOCUS, selected ? 'ring-accent' : 'ring-transparent hover:ring-white/25')}
                >
                  <MediaView path={persona.image_path} kind="image" alt="" className="aspect-[4/5] w-full" />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-5 text-left text-xs font-bold text-zinc-50">
                    {persona.name}
                  </span>
                  {selected && (
                    <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-accent text-accent-ink">
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <p className={SECTION_TITLE}>Movimento</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {MOTION_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              aria-pressed={motion.prompt === preset.prompt}
              onClick={() => motion.setPrompt(preset.prompt)}
              className={clsx(
                'min-h-8 rounded-lg px-3 text-[13px] font-semibold transition-colors',
                FOCUS,
                motion.prompt === preset.prompt ? 'bg-zinc-100 text-zinc-900' : 'bg-surface-3 text-zinc-300 hover:text-zinc-100',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <label htmlFor="motion-prompt" className="sr-only">
          Descreva o movimento
        </label>
        <textarea
          id="motion-prompt"
          value={motion.prompt}
          onChange={(event) => motion.setPrompt(event.target.value)}
          maxLength={2000}
          rows={3}
          className="w-full resize-none rounded-2xl border border-white/[0.06] bg-surface-2 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </section>

      <section>
        <p id="motion-model" className={SECTION_TITLE}>
          Modelo
        </p>
        <div role="radiogroup" aria-labelledby="motion-model" className="space-y-1.5">
          {motion.videoModels.map((model) => {
            const selected = model.slug === motion.model?.slug
            return (
              <button
                key={model.slug}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => motion.setModelSlug(model.slug)}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-colors',
                  FOCUS,
                  selected ? 'bg-surface-2 ring-accent/60' : 'bg-surface-2/60 ring-white/[0.05] hover:bg-surface-2',
                )}
              >
                <Clapperboard className={clsx('size-5 shrink-0', selected ? 'text-accent-soft' : 'text-zinc-400')} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-zinc-100">
                    {model.name}
                    {model.badge && <Badge>{model.badge}</Badge>}
                  </span>
                  <span className="block text-xs text-zinc-500">{modelSpecs(model.defaults).join(' · ')}</span>
                </span>
                <span className="text-xs font-bold tabular-nums text-zinc-400">{model.credits} cr</span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
