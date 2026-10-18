import clsx from 'clsx'
import { useReducedMotion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ShowcaseVideo } from '../content'

interface PhoneVideoProps {
  readonly video: ShowcaseVideo
  readonly className?: string
  /** Mostra o prompt por cima do vídeo, como na tela do app. */
  readonly showPrompt?: boolean
  readonly eager?: boolean
}

/** Toca só enquanto está na tela; com movimento reduzido, fica no pôster. */
function useVisiblePlayback(eager: boolean) {
  const ref = useRef<HTMLVideoElement>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const element = ref.current
    if (!element || reduceMotion) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        if (entry.isIntersecting) {
          element.play().catch((error: unknown) => {
            // Autoplay bloqueado (modo economia de dados): o pôster continua visível.
            if (!(error instanceof DOMException && error.name === 'NotAllowedError')) console.error(error)
          })
        } else {
          element.pause()
        }
      },
      { threshold: 0.25 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [reduceMotion])

  return { ref, preload: eager ? 'auto' : 'none' } as const
}

export function PhoneVideo({ video, className, showPrompt = false, eager = false }: PhoneVideoProps) {
  const { ref, preload } = useVisiblePlayback(eager)

  return (
    <figure
      className={clsx(
        'relative aspect-[9/19.5] rounded-[2.4rem] bg-zinc-900 p-[7px] shadow-2xl shadow-black/60 ring-1 ring-white/10',
        className,
      )}
    >
      <div className="relative size-full overflow-hidden rounded-[2rem] bg-black">
        <video
          ref={ref}
          className="size-full object-cover"
          poster={video.poster}
          preload={preload}
          muted
          loop
          playsInline
          aria-label={`Exemplo de vídeo gerado com IA: ${video.prompt}`}
        >
          <source src={video.src} type={video.src.endsWith('.mp4') ? 'video/mp4' : 'video/webm'} />
        </video>
        <span aria-hidden="true" className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
        <span className="absolute left-3 top-10 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-md">
          <Sparkles className="size-3 text-accent" aria-hidden="true" />
          Feito no Kria
        </span>
        {showPrompt && (
          <figcaption className="absolute inset-x-2.5 bottom-2.5 rounded-2xl border border-white/10 bg-black/55 p-2.5 text-[11px] leading-snug text-zinc-100 backdrop-blur-md">
            <span className="mb-1 block text-[9px] font-medium uppercase tracking-wider text-accent">Prompt</span>
            {video.prompt}
          </figcaption>
        )}
      </div>
    </figure>
  )
}
