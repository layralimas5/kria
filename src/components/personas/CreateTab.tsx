import clsx from 'clsx'
import { ImagePlus, X } from 'lucide-react'
import { useState } from 'react'
import { countSelected, PERSONA_TRAIT_GROUPS, type TraitGroupId } from '@/domain/personaTraits'
import type { Generation } from '@/domain/types'
import type { PersonaBuilder } from '@/hooks/usePersonaBuilder'
import { MediaView } from '../MediaView'
import { Popover } from '../ui/Popover'
import { SourcePicker } from '../studio/SourcePicker'
import { TraitAccordion } from './TraitAccordion'

interface CreateTabProps {
  readonly builder: PersonaBuilder
  readonly images: readonly Generation[]
}

/** Partir de uma imagem já gerada aqui (nunca upload de foto de pessoa real). */
function SourceCard({ builder, images }: CreateTabProps) {
  const source = images.find((image) => image.id === builder.sourceId) ?? null

  return (
    <Popover
      label="Escolher imagem de partida"
      side="bottom"
      className="w-[min(86vw,22rem)]"
      trigger={({ open, toggle, controls }) => (
        <div className="relative">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={controls}
            aria-haspopup="dialog"
            className={clsx(
              'flex min-h-24 w-full items-center gap-3 rounded-2xl border border-dashed p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              source ? 'border-accent/50 bg-accent/[0.05]' : 'border-white/15 bg-surface-2/60 hover:border-white/30',
            )}
          >
            {source ? (
              <MediaView path={source.output_path} kind="image" alt="" className="size-16 shrink-0 rounded-xl" />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-3 text-zinc-300">
                <ImagePlus className="size-4" aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-zinc-100">
                {source ? 'Partindo desta imagem' : 'Partir de uma imagem sua'}
              </span>
              <span className="block text-xs text-zinc-500">
                {source ? 'As características ajustam o rosto dela.' : 'Uma imagem que você já gerou aqui.'}
              </span>
            </span>
            {!source && <span className="self-start rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">Opcional</span>}
          </button>
          {source && (
            <button
              type="button"
              onClick={() => builder.setSourceId(null)}
              aria-label="Não partir de imagem"
              className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-zinc-100 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    >
      {(close) => (
        <SourcePicker
          personas={[]}
          images={images}
          value={builder.sourceId ? { type: 'image', id: builder.sourceId } : null}
          onChange={(picked) => {
            builder.setSourceId(picked.id)
            close()
          }}
        />
      )}
    </Popover>
  )
}

export function CreateTab({ builder, images }: CreateTabProps) {
  const [openGroups, setOpenGroups] = useState<ReadonlySet<TraitGroupId>>(new Set(['niche']))
  const selectedCount = countSelected(builder.selection)

  const setOpen = (id: TraitGroupId, open: boolean) =>
    setOpenGroups((current) => {
      const next = new Set(current)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })

  return (
    <div className="space-y-2">
      <SourceCard builder={builder} images={images} />

      <div className="flex items-center justify-between px-1 pt-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Características</p>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={builder.clear}
            className="rounded text-xs font-semibold text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Limpar ({selectedCount})
          </button>
        )}
      </div>

      {PERSONA_TRAIT_GROUPS.map((group) => (
        <TraitAccordion
          key={group.id}
          group={group}
          values={builder.selection[group.id] ?? []}
          open={openGroups.has(group.id)}
          onOpenChange={(open) => setOpen(group.id, open)}
          onToggle={(value) => builder.toggle(group, value)}
        />
      ))}

      <div className="pt-2">
        <label htmlFor="persona-extra" className="mb-1.5 block px-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          Mais algum detalhe? (opcional)
        </label>
        <textarea
          id="persona-extra"
          value={builder.extra}
          onChange={(event) => builder.setExtra(event.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Ex.: colar dourado fino, unhas vermelhas"
          className="w-full resize-none rounded-2xl border border-white/[0.06] bg-surface-2 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </div>
    </div>
  )
}
