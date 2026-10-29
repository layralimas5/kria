import clsx from 'clsx'
import { ImageIcon } from 'lucide-react'
import type { ShowcaseAspect, ShowcaseImage } from '../showcase'

const ASPECT_CLASS: Record<ShowcaseAspect, string> = {
  '16:9': 'aspect-video',
  '4:3': 'aspect-[4/3]',
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '3:4': 'aspect-[3/4]',
  '9:16': 'aspect-[9/16]',
}

interface ShowcasePhotoProps {
  readonly image: ShowcaseImage
  readonly alt: string
  readonly className?: string
  /** Mantém a proporção da foto; desligue quando o pai já define o tamanho. */
  readonly keepAspect?: boolean
  /** Só para a primeira dobra. */
  readonly eager?: boolean
}

/** Foto gerada para a landing; enquanto não existe, um espaço reservado do mesmo tamanho. */
export function ShowcasePhoto({ image, alt, className, keepAspect = true, eager = false }: ShowcasePhotoProps) {
  const box = clsx(keepAspect && ASPECT_CLASS[image.aspect], className)
  if (!image.media) {
    return (
      <div
        role="img"
        aria-label={`${alt} (imagem ainda não gerada)`}
        className={clsx('grid place-items-center bg-[radial-gradient(120%_90%_at_30%_20%,#22183d,#0e0e10_70%)] text-zinc-500', box)}
      >
        <ImageIcon className="size-6" aria-hidden="true" />
      </div>
    )
  }
  return (
    <img
      src={image.media.src}
      width={image.media.width}
      height={image.media.height}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding="async"
      className={clsx('object-cover', box)}
    />
  )
}
