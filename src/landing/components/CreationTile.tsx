import clsx from 'clsx'
import { Clapperboard, ImageIcon, Sparkles } from 'lucide-react'
import type { Clip } from '../content'
import type { ShowcaseImage } from '../showcase'
import { LoopVideo } from './LoopVideo'

interface CreationText {
  /** Tipo de resultado no selo ("Imagem publicitária", "Vídeo com IA"). */
  readonly label: string
  readonly title: string
}

/** Uma peça da vitrine: foto de `showcase.json` ou vídeo de `avatars.json`. */
export type Creation = CreationText &
  ({ readonly kind: 'image'; readonly image: ShowcaseImage; readonly model: string } | { readonly kind: 'video'; readonly clip: Clip })

interface CreationTileProps {
  readonly creation: Creation
  /** Tom do fundo enquanto a mídia não existe. */
  readonly tone?: Tone
  /** Peça pequena: só o selo e o título, sem o prompt. */
  readonly compact?: boolean
  /** Peça muito pequena: esconde o prompt, que não caberia. */
  readonly hidePrompt?: boolean
  readonly eager?: boolean
  readonly className?: string
}

type Tone = 'violet' | 'blue' | 'amber' | 'rose'

const TONES: Record<Tone, string> = {
  violet: 'bg-[radial-gradient(120%_80%_at_20%_10%,rgba(167,139,250,0.55),transparent_55%),radial-gradient(90%_70%_at_90%_100%,rgba(59,130,246,0.35),transparent_60%),linear-gradient(160deg,#1b1238,#07060d)]',
  blue: 'bg-[radial-gradient(110%_80%_at_80%_0%,rgba(96,165,250,0.5),transparent_55%),radial-gradient(90%_70%_at_0%_100%,rgba(124,58,237,0.4),transparent_60%),linear-gradient(200deg,#0d1630,#06070d)]',
  amber: 'bg-[radial-gradient(110%_80%_at_70%_15%,rgba(245,184,65,0.42),transparent_55%),radial-gradient(90%_70%_at_10%_100%,rgba(124,58,237,0.4),transparent_60%),linear-gradient(170deg,#211326,#08060c)]',
  rose: 'bg-[radial-gradient(110%_80%_at_25%_0%,rgba(244,114,182,0.4),transparent_55%),radial-gradient(90%_70%_at_100%_100%,rgba(124,58,237,0.42),transparent_60%),linear-gradient(190deg,#22112a,#07060c)]',
}

function details(creation: Creation) {
  if (creation.kind === 'image') return { prompt: creation.image.prompt, model: creation.model, ready: creation.image.media !== null }
  return { prompt: creation.clip.prompt, model: creation.clip.model, ready: creation.clip.generated }
}

function Media({ creation, eager }: { readonly creation: Creation; readonly eager: boolean }) {
  if (creation.kind === 'video') {
    return <LoopVideo clip={creation.clip} eager={eager} className="absolute inset-0 size-full object-cover" />
  }
  const { media } = creation.image
  if (!media) return null
  return (
    <img
      src={media.src}
      width={media.width}
      height={media.height}
      alt={creation.title}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding="async"
      className="absolute inset-0 size-full object-cover"
    />
  )
}

/**
 * Peça feita no Vynkio. Com a mídia gerada, mostra o resultado e o modelo que gerou. Sem ela, mostra o
 * prompt de verdade que vai gerá-la, sobre um fundo abstrato: nunca imagem de outra plataforma no lugar.
 */
export function CreationTile({ creation, tone = 'violet', compact = false, hidePrompt = false, eager = false, className }: CreationTileProps) {
  const { label, title } = creation
  const { prompt, model, ready } = details(creation)
  const KindIcon = creation.kind === 'video' ? Clapperboard : ImageIcon

  return (
    <figure className={clsx('group/tile relative isolate overflow-hidden bg-[#0b0a14]', className)}>
      {ready ? (
        <Media creation={creation} eager={eager} />
      ) : (
        <div aria-hidden="true" className={clsx('absolute inset-0 transition-transform duration-[1.2s] ease-out group-hover/tile:scale-[1.04] motion-reduce:transition-none', TONES[tone])}>
          <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(rgba(255,255,255,0.5)_0.5px,transparent_0.5px)] [background-size:3px_3px]" />
          <div className="absolute -inset-y-10 left-[-40%] w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent motion-safe:animate-[tile-sheen_7s_ease-in-out_infinite]" />
        </div>
      )}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

      <span className="absolute left-3 top-3 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-100 ring-1 ring-white/15 backdrop-blur-md sm:text-[11px]">
        <KindIcon className="size-3 shrink-0 text-accent-soft" aria-hidden="true" />
        <span className={clsx('min-w-0 truncate', compact && 'sr-only sm:not-sr-only')}>{label}</span>
      </span>

      {!ready && !hidePrompt && (
        <blockquote
          className={clsx(
            'absolute inset-x-0 text-left font-landing text-zinc-100/90',
            compact ? 'top-12 hidden px-3.5 text-[12px] leading-snug sm:block' : 'top-12 px-5 text-[15px] leading-snug sm:top-16 sm:px-8 sm:text-xl md:text-2xl',
          )}
        >
          <span aria-hidden="true" className={clsx('block font-bold leading-none text-accent-soft', compact ? 'text-2xl' : 'text-4xl sm:text-5xl')}>
            “
          </span>
          <p className={clsx('text-pretty', compact ? 'line-clamp-4' : 'line-clamp-2 max-w-[34ch] tracking-[-0.01em] sm:line-clamp-3')}>{prompt}</p>
        </blockquote>
      )}

      <figcaption className={clsx('absolute inset-x-0 bottom-0 text-left', compact ? 'p-3' : 'p-4 sm:p-5')}>
        <p className={clsx('font-semibold text-white', compact ? 'text-[12px] sm:text-[13px]' : 'text-sm sm:text-base')}>{title}</p>
        <p className={clsx('mt-1.5 inline-flex items-center gap-1 text-zinc-400', compact ? 'text-[10px]' : 'text-[11px] sm:text-xs')}>
          <Sparkles className="size-3 text-accent-soft" aria-hidden="true" />
          {ready ? `Feito no Vynkio com ${model}` : `Prompt para ${model}`}
        </p>
      </figcaption>
    </figure>
  )
}
