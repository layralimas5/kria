import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, Download, Film, UserRoundPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCredits } from '@/domain/format'
import { isOpen, type Generation } from '@/domain/types'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { MediaView } from './MediaView'

interface GenerationCardProps {
  readonly generation: Generation
  readonly modelName: string
  readonly onMakePersona?: (generation: Generation) => void
  readonly className?: string
}

function PendingState({ generation }: { readonly generation: Generation }) {
  const isVideo = generation.kind === 'video'
  return (
    <div className="relative flex size-full flex-col items-center justify-center gap-2 overflow-hidden p-4 text-center">
      <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-gradient-to-br from-accent/[0.07] via-transparent to-white/[0.04]" />
      <span aria-hidden="true" className="relative size-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
      <p className="relative text-[13px] font-semibold text-zinc-200">{isVideo ? 'Gerando vídeo' : 'Gerando imagem'}</p>
      <p className="relative text-xs text-zinc-500">{isVideo ? '1 a 5 minutos' : 'Alguns segundos'}</p>
    </div>
  )
}

function FailedState({ generation }: { readonly generation: Generation }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 bg-red-500/[0.05] p-4 text-center">
      <AlertCircle className="size-6 text-red-300" aria-hidden="true" />
      <p className="text-[13px] font-semibold text-red-200">Não deu certo</p>
      <p className="line-clamp-3 text-xs text-zinc-400">{generation.error ?? 'Falha na geração.'}</p>
      <p className="text-xs font-medium text-zinc-500">{formatCredits(generation.credits)} devolvidos</p>
    </div>
  )
}

const ACTION =
  'grid size-8 place-items-center rounded-lg bg-black/55 text-zinc-100 backdrop-blur transition-colors hover:bg-accent hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

function Actions({ generation, onMakePersona }: Pick<GenerationCardProps, 'generation' | 'onMakePersona'>) {
  const url = useSignedUrl(generation.output_path)
  const isImage = generation.kind === 'image'
  return (
    <div className="flex items-center gap-1.5">
      {url && (
        <a href={url} download target="_blank" rel="noreferrer" className={ACTION} aria-label="Baixar" title="Baixar">
          <Download className="size-4" aria-hidden="true" />
        </a>
      )}
      {isImage && (
        <Link to={`/estudio?modo=video&origem=${generation.id}`} className={ACTION} aria-label="Animar em vídeo" title="Animar em vídeo">
          <Film className="size-4" aria-hidden="true" />
        </Link>
      )}
      {isImage && onMakePersona && (
        <button type="button" onClick={() => onMakePersona(generation)} className={ACTION} aria-label="Virar persona" title="Virar persona">
          <UserRoundPlus className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export function GenerationCard({ generation, modelName, onMakePersona, className }: GenerationCardProps) {
  const reduceMotion = useReducedMotion()
  const done = generation.status === 'succeeded'

  return (
    <motion.article
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={clsx(
        'group relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface ring-1 ring-white/[0.06] transition-shadow hover:ring-white/15',
        className,
      )}
    >
      {isOpen(generation) && <PendingState generation={generation} />}
      {generation.status === 'failed' && <FailedState generation={generation} />}
      {done && (
        <MediaView
          path={generation.output_path}
          kind={generation.kind}
          alt={generation.prompt}
          className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
      )}

      <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-100 backdrop-blur">
        {modelName}
      </span>

      {done && (
        <div
          className={clsx(
            'absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-10 transition-opacity duration-200',
            'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100',
          )}
        >
          <p className="line-clamp-2 text-xs leading-snug text-zinc-200" title={generation.prompt}>
            {generation.prompt}
          </p>
          <Actions generation={generation} onMakePersona={onMakePersona} />
        </div>
      )}
    </motion.article>
  )
}
