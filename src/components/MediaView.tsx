import clsx from 'clsx'
import { ImageOff } from 'lucide-react'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import type { MediaKind } from '@/domain/types'

interface MediaViewProps {
  readonly path: string | null
  readonly kind: MediaKind
  readonly alt: string
  /** Tamanho e posição vão na moldura; a mídia sempre preenche a moldura. */
  readonly className?: string
  /** Vídeo com controles (detalhe) ou mudo em loop (miniatura). */
  readonly controls?: boolean
}

function Media({ url, kind, alt, controls }: { url: string; kind: MediaKind; alt: string; controls: boolean }) {
  const fill = 'size-full object-cover'
  if (kind === 'image') return <img src={url} alt={alt} className={fill} loading="lazy" decoding="async" />
  return controls ? (
    <video src={url} className={fill} controls playsInline preload="metadata" aria-label={alt} />
  ) : (
    <video src={url} className={fill} muted loop playsInline autoPlay preload="metadata" aria-label={alt} />
  )
}

export function MediaView({ path, kind, alt, className, controls = false }: MediaViewProps) {
  const url = useSignedUrl(path)

  return (
    <div className={clsx('overflow-hidden bg-white/[0.03]', className)}>
      {!path ? (
        <div className="grid size-full place-items-center text-zinc-600">
          <ImageOff className="size-6" aria-hidden="true" />
        </div>
      ) : url ? (
        <Media url={url} kind={kind} alt={alt} controls={controls} />
      ) : (
        <div className="size-full animate-pulse bg-white/[0.04]" aria-hidden="true" />
      )}
    </div>
  )
}
