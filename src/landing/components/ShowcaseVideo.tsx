import clsx from 'clsx'
import { LoaderCircle, Pause, Play } from 'lucide-react'
import { useRef, useState } from 'react'

interface ShowcaseVideoProps {
  readonly src: string
  readonly poster: string
  /** Descreve o vídeo para quem não vê (título e modelo que gerou). */
  readonly label: string
  readonly className?: string
  /** Proporção do vídeo (classe `aspect-*`). */
  readonly aspect?: string
  /** Vídeo narrado: toca com som, uma vez, em vez de mudo e em loop. */
  readonly withSound?: boolean
}

type PlayerState = 'idle' | 'loading' | 'playing' | 'paused'

/**
 * Player de vídeo da landing. Nada baixa antes do clique (`preload="none"`, só o pôster) e só
 * toca quando a pessoa pede, então nunca há dois vídeos tocando juntos na página.
 */
export function ShowcaseVideo({ src, poster, label, className, aspect = 'aspect-video', withSound = false }: ShowcaseVideoProps) {
  const video = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<PlayerState>('idle')
  const playing = state === 'playing' || state === 'loading'

  function toggle() {
    const element = video.current
    if (!element) return
    if (!element.paused) {
      element.pause()
      return
    }
    setState('loading')
    element.play().catch((error: unknown) => {
      setState('paused')
      console.error('Vídeo da landing não tocou', error)
    })
  }

  return (
    <figure className={clsx('group relative overflow-hidden rounded-2xl bg-black ring-1 ring-white/[0.08]', className)}>
      <video
        ref={video}
        src={src}
        poster={poster}
        preload="none"
        playsInline
        muted={!withSound}
        loop={!withSound}
        aria-label={label}
        onWaiting={() => setState('loading')}
        onPlaying={() => setState('playing')}
        onPause={() => setState('paused')}
        onEnded={() => setState('paused')}
        className={clsx('block h-full w-full object-cover', aspect)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Pausar: ${label}` : `Reproduzir: ${label}`}
        className={clsx(
          'absolute inset-0 grid place-items-center transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
          state === 'playing' ? 'opacity-0 hover:opacity-100 focus-visible:opacity-100' : 'opacity-100',
        )}
      >
        <span className="grid size-16 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-md transition-transform duration-200 group-hover:scale-105">
          {state === 'loading' ? (
            <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
          ) : playing ? (
            <Pause className="size-6 fill-current" aria-hidden="true" />
          ) : (
            <Play className="ml-1 size-6 fill-current" aria-hidden="true" />
          )}
        </span>
      </button>
    </figure>
  )
}
