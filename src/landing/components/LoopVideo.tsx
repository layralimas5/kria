import { useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import type { Clip } from '../content'

interface LoopVideoProps {
  readonly clip: Clip
  readonly className?: string
  /** Baixa já no carregamento (só pro que aparece no topo). */
  readonly eager?: boolean
}

/** Vídeo mudo em loop que só toca enquanto está na tela; com movimento reduzido, fica no pôster. */
export function LoopVideo({ clip, className, eager = false }: LoopVideoProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const element = ref.current
    if (!element || reduceMotion) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        if (!entry.isIntersecting) {
          element.pause()
          return
        }
        element.play().catch((error: unknown) => {
          // Autoplay bloqueado (economia de dados): o pôster continua visível.
          if (!(error instanceof DOMException && error.name === 'NotAllowedError')) console.error(error)
        })
      },
      { threshold: 0.2 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [reduceMotion])

  return (
    <video
      ref={ref}
      className={className}
      poster={clip.poster}
      preload={eager ? 'auto' : 'none'}
      muted
      loop
      playsInline
      aria-label={`Exemplo de vídeo: ${clip.prompt}`}
    >
      <source src={clip.src} type={clip.src.endsWith('.mp4') ? 'video/mp4' : 'video/webm'} />
    </video>
  )
}
