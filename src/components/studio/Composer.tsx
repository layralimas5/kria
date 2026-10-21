import clsx from 'clsx'
import { Clapperboard, ImageIcon, Plus, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { modelSpecs } from '@/domain/format'
import type { Generation, MediaKind, Persona } from '@/domain/types'
import { PROMPT_MAX, type Studio } from '@/hooks/useStudio'
import { MediaView } from '../MediaView'
import { Spinner } from '../ui/Spinner'
import { Popover } from '../ui/Popover'
import { CHIP, ModelMenu } from './ModelMenu'
import { SourcePicker } from './SourcePicker'

interface ComposerProps {
  readonly studio: Studio
  readonly personas: readonly Persona[]
  readonly images: readonly Generation[]
}

const PLACEHOLDERS: Record<MediaKind, string> = {
  image: 'Descreva a foto. Ex.: mulher de 28 anos tomando café numa varanda em Lisboa, luz de fim de tarde',
  video: 'Descreva o que acontece. Ex.: ela olha para a câmera, sorri e diz "bom dia, gente!"',
}

const KINDS = [
  { value: 'image', label: 'Imagem', icon: ImageIcon },
  { value: 'video', label: 'Vídeo', icon: Clapperboard },
] as const

function KindSwitch({ value, onChange }: { readonly value: MediaKind; readonly onChange: (kind: MediaKind) => void }) {
  return (
    <div role="radiogroup" aria-label="Tipo de criação" className="inline-flex rounded-lg bg-surface-3/80 p-0.5">
      {KINDS.map(({ value: kind, label, icon: Icon }) => (
        <button
          key={kind}
          type="button"
          role="radio"
          aria-checked={value === kind}
          onClick={() => onChange(kind)}
          className={clsx(
            'inline-flex min-h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            value === kind ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-100',
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}

function sourcePath(studio: Studio, personas: readonly Persona[], images: readonly Generation[]): string | null {
  if (!studio.source) return null
  if (studio.source.type === 'persona') return personas.find((item) => item.id === studio.source?.id)?.image_path ?? null
  return images.find((item) => item.id === studio.source?.id)?.output_path ?? null
}

function SourceSlot({ studio, personas, images }: ComposerProps) {
  const path = sourcePath(studio, personas, images)
  return (
    <Popover
      label="Escolher persona ou imagem"
      className="w-[min(88vw,24rem)]"
      trigger={({ open, toggle, controls }) => (
        <div className="relative">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={controls}
            aria-haspopup="dialog"
            aria-label={path ? 'Trocar persona ou imagem' : 'Escolher persona ou imagem'}
            className={clsx(
              'grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              path ? 'ring-2 ring-accent' : 'border border-dashed border-white/20 text-zinc-400 hover:border-accent/60 hover:text-accent-soft',
            )}
          >
            {path ? <MediaView path={path} kind="image" alt="" className="size-full" /> : <Plus className="size-5" aria-hidden="true" />}
          </button>
          {path && (
            <button
              type="button"
              onClick={() => studio.setSource(null)}
              aria-label="Remover imagem de origem"
              className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-zinc-100 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    >
      {(close) => (
        <SourcePicker
          personas={personas}
          images={images}
          value={studio.source}
          onChange={(source) => {
            studio.setSource(source)
            close()
          }}
        />
      )}
    </Popover>
  )
}

function GenerateButton({ studio }: { readonly studio: Studio }) {
  return (
    <button
      type="submit"
      disabled={studio.submitting}
      aria-busy={studio.submitting || undefined}
      className={clsx(
        'btn-lime flex min-h-12 w-full shrink-0 flex-col items-center justify-center rounded-xl px-6 transition-all hover:brightness-105 active:translate-y-px active:shadow-none sm:min-h-[4.5rem] sm:w-32',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2',
        !studio.ready && 'saturate-[0.65]',
      )}
    >
      {studio.submitting ? (
        <Spinner className="size-5" />
      ) : (
        <>
          <span className="font-headline text-[15px] leading-none">Gerar</span>
          {studio.model && <span className="mt-1 text-[11px] font-semibold opacity-75">{studio.model.credits} créditos</span>}
        </>
      )}
    </button>
  )
}

export function Composer({ studio, personas, images }: ComposerProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void studio.submit()
  }

  const specs = studio.model ? modelSpecs(studio.model.defaults) : []

  return (
    <div className="pointer-events-none fixed right-0 left-[var(--sidebar-w)] bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-3 transition-[left] duration-200 md:bottom-5">
      <div className="pointer-events-auto mx-auto max-w-3xl space-y-2">
        {studio.error && (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/80 px-3 py-2 text-sm text-red-100 backdrop-blur">
            {studio.error}
            {!studio.canAfford && (
              <>
                {' '}
                <Link to="/creditos" className="font-semibold text-accent-soft underline-offset-4 hover:underline">
                  Comprar créditos
                </Link>
              </>
            )}
          </p>
        )}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/[0.08] bg-surface-2/90 p-2.5 shadow-2xl shadow-black/70 backdrop-blur-xl sm:p-3"
        >
          <div className="flex items-start gap-2.5">
            {studio.needsSource && <SourceSlot studio={studio} personas={personas} images={images} />}
            <label className="sr-only" htmlFor="prompt">
              {studio.kind === 'video' ? 'O que acontece no vídeo' : 'Descreva a imagem'}
            </label>
            <textarea
              id="prompt"
              value={studio.prompt}
              onChange={(event) => studio.setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) handleSubmit(event)
              }}
              maxLength={PROMPT_MAX}
              rows={2}
              placeholder={PLACEHOLDERS[studio.kind]}
              className="max-h-40 min-h-14 flex-1 resize-none bg-transparent px-1 py-1.5 text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:outline-none [field-sizing:content]"
            />
            <div className="hidden sm:block">
              <GenerateButton studio={studio} />
            </div>
          </div>

          {/* flex-wrap, não overflow: um container com rolagem cortaria o menu de modelos que abre para cima. */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <KindSwitch value={studio.kind} onChange={studio.setKind} />
            <ModelMenu models={studio.modelsOfKind} value={studio.model} onChange={studio.selectModel} />
            {specs.map((spec) => (
              <span key={spec} className={clsx(CHIP, 'pointer-events-none text-zinc-300')}>
                {spec}
              </span>
            ))}
            {studio.needsSource && !studio.source && (
              <span className="pl-1 text-xs text-amber-200/90">Escolha uma persona ou imagem no +</span>
            )}
          </div>

          <div className="mt-2.5 sm:hidden">
            <GenerateButton studio={studio} />
          </div>
        </form>
      </div>
    </div>
  )
}
