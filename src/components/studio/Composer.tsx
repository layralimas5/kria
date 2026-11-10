import clsx from 'clsx'
import { Check, Clapperboard, ImageIcon, Plus, RectangleHorizontal, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ASPECT_LABELS, fixedDefaults, modelSpecs } from '@/domain/format'
import { useBalance } from '@/hooks/useBalance'
import type { Generation, MediaKind, Persona } from '@/domain/types'
import { PROMPT_MAX, type Studio } from '@/hooks/useStudio'
import { Kbd, modKey } from '../command/Kbd'
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

function KindSwitch({ value, kinds, onChange }: { readonly value: MediaKind; readonly kinds: readonly MediaKind[]; readonly onChange: (kind: MediaKind) => void }) {
  // Um tipo só (plano sem vídeo): não há o que trocar.
  if (kinds.length < 2) return null
  return (
    <div role="radiogroup" aria-label="Tipo de criação" className="inline-flex rounded-lg bg-surface-3/80 p-0.5">
      {KINDS.filter((item) => kinds.includes(item.value)).map(({ value: kind, label, icon: Icon }) => (
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

/** Proporção da imagem ou do vídeo, quando o modelo aceita escolher. O primeiro valor é o padrão. */
function AspectMenu({ studio }: { readonly studio: Studio }) {
  const values = studio.model?.options.aspect_ratio
  if (!values || values.length < 2) return null
  const current = studio.options.aspect_ratio ?? values[0] ?? ''
  return (
    <Popover
      label="Proporção"
      trigger={({ open, toggle, controls }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={controls}
          aria-haspopup="dialog"
          aria-label={`Proporção ${current}. Trocar`}
          className={CHIP}
        >
          <RectangleHorizontal className="size-3.5 text-accent-soft" aria-hidden="true" />
          {current}
        </button>
      )}
    >
      {(close) => (
        <ul className="w-56" aria-label="Proporções">
          {values.map((value) => (
            <li key={value}>
              <button
                type="button"
                aria-pressed={value === current}
                onClick={() => {
                  studio.setOption('aspect_ratio', value)
                  close()
                }}
                className={clsx(
                  'flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  value === current ? 'bg-white/[0.07] text-zinc-50' : 'text-zinc-300 hover:bg-white/[0.04]',
                )}
              >
                <span className="w-11 tabular-nums">{value}</span>
                <span className="flex-1 font-normal text-zinc-400">{ASPECT_LABELS[value] ?? ''}</span>
                {value === current && <Check className="size-4 text-accent-soft" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
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
        'btn-accent flex min-h-12 w-full shrink-0 flex-col items-center justify-center rounded-xl px-6 transition-all sm:min-h-[4.5rem] sm:w-32',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2',
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

/** Rodapé da caixa: quanto sobra depois de gerar, tamanho do pedido e o atalho de envio. */
function ComposerFooter({ studio }: { readonly studio: Studio }) {
  const { balance } = useBalance()
  const left = balance !== null && studio.model ? balance - studio.model.credits : null
  const nearLimit = studio.prompt.length > PROMPT_MAX * 0.9
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/[0.05] px-1 pt-2 text-[11px] text-zinc-500">
      <span className="tabular-nums">
        {left === null ? 'Carregando saldo' : left >= 0 ? `Sobram ${left.toLocaleString('pt-BR')} créditos depois desta` : 'Saldo insuficiente para este modelo'}
      </span>
      <span className="flex items-center gap-3">
        <span className={clsx('tabular-nums', nearLimit && 'text-hot')}>
          {studio.prompt.length.toLocaleString('pt-BR')}/{PROMPT_MAX.toLocaleString('pt-BR')}
        </span>
        <span className="hidden items-center gap-1 sm:inline-flex">
          <Kbd>{modKey()}</Kbd>
          <Kbd>Enter</Kbd>
          gera
        </span>
      </span>
    </div>
  )
}

export function Composer({ studio, personas, images }: ComposerProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void studio.submit()
  }

  const specs = studio.model ? modelSpecs(fixedDefaults(studio.model.defaults, studio.model.options)) : []

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
          className="rounded-2xl border border-white/[0.09] bg-surface-2/90 p-2.5 shadow-2xl shadow-black/70 backdrop-blur-xl transition-[border-color,box-shadow] duration-200 focus-within:border-accent-soft/40 focus-within:shadow-[0_20px_60px_-20px_rgb(124_58_237/0.55)] sm:p-3"
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
            <KindSwitch value={studio.kind} kinds={studio.kinds} onChange={studio.setKind} />
            <ModelMenu models={studio.modelsOfKind} value={studio.model} onChange={studio.selectModel} />
            <AspectMenu studio={studio} />
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
          <ComposerFooter studio={studio} />
        </form>
      </div>
    </div>
  )
}
