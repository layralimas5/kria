import clsx from 'clsx'
import { useReducedMotion } from 'framer-motion'
import { ImageOff } from 'lucide-react'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import type { MediaKind } from '@/domain/types'

interface MediaViewProps {
  readonly path: string | null
  readonly kind: MediaKind
  readonly alt: string
  /** Tamanho e posição vão na moldura; a mídia sempre preenche a moldura. */
  readonly className?: string
}

function Media({ url, kind, alt }: { url: string; kind: MediaKind; alt: string }) {
  const reduceMotion = useReducedMotion()
  const fill = 'size-full object-cover'
  if (kind === 'image') return <img src={url} alt={alt} className={fill} loading="lazy" decoding="async" />
  // Vídeo em loop e mudo, como num feed. Com movimento reduzido, fica parado e com controles.
  return (
    <video
      src={url}
      className={fill}
      muted
      loop
      playsInline
      autoPlay={!reduceMotion}
      controls={reduceMotion ?? false}
      preload="metadata"
      aria-label={alt}
    />
  )
}

export function MediaView({ path, kind, alt, className }: MediaViewProps) {
  const url = useSignedUrl(path)

  return (
    <div className={clsx('overflow-hidden bg-surface-2', className)}>
      {!path ? (
        <div className="grid size-full place-items-center text-zinc-600">
          <ImageOff className="size-6" aria-hidden="true" />
        </div>
      ) : url ? (
        <Media url={url} kind={kind} alt={alt} />
      ) : (
        <div className="size-full animate-pulse bg-white/[0.04]" aria-hidden="true" />
      )}
    </div>
  )
}
