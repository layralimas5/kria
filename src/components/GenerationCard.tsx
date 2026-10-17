import { motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, Download, Film, UserRoundPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCredits } from '@/domain/format'
import { isOpen, type Generation } from '@/domain/types'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { MediaView } from './MediaView'
import { Spinner } from './ui/Spinner'

interface GenerationCardProps {
  readonly generation: Generation
  readonly modelName: string
  readonly onMakePersona?: (generation: Generation) => void
}

function PendingState({ generation }: { readonly generation: Generation }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-white/[0.04] to-transparent p-4 text-center">
      <Spinner className="size-6 text-accent" />
      <p className="text-sm text-zinc-300">{generation.kind === 'video' ? 'Gerando vídeo' : 'Gerando imagem'}</p>
      <p className="text-xs text-zinc-500">
        {generation.kind === 'video' ? 'Leva de 1 a 5 minutos.' : 'Leva alguns segundos.'} Pode sair da tela.
      </p>
    </div>
  )
}

function FailedState({ generation }: { readonly generation: Generation }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 bg-red-500/[0.04] p-4 text-center">
      <AlertCircle className="size-6 text-red-300" aria-hidden="true" />
      <p className="text-sm text-red-200">Não deu certo</p>
      <p className="line-clamp-3 text-xs text-zinc-400">{generation.error ?? 'Falha na geração.'}</p>
      <p className="text-xs text-zinc-500">{formatCredits(generation.credits)} devolvidos</p>
    </div>
  )
}

function DownloadLink({ generation }: { readonly generation: Generation }) {
  const url = useSignedUrl(generation.output_path)
  if (!url) return null
  return (
    <a href={url} download target="_blank" rel="noreferrer" className={ACTION} aria-label="Baixar arquivo">
      <Download className="size-4" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">Baixar</span>
    </a>
  )
}

const ACTION =
  'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function GenerationCard({ generation, modelName, onMakePersona }: GenerationCardProps) {
  const reduceMotion = useReducedMotion()
  const done = generation.status === 'succeeded'
  const isImage = generation.kind === 'image'

  return (
    <motion.article
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="group overflow-hidden rounded-2xl border border-white/[0.07] bg-zinc-900/60 transition-colors hover:border-white/15"
    >
      <div className="relative aspect-[4/5] bg-zinc-900">
        {isOpen(generation) && <PendingState generation={generation} />}
        {generation.status === 'failed' && <FailedState generation={generation} />}
        {done && (
          <MediaView
            path={generation.output_path}
            kind={generation.kind}
            alt={generation.prompt}
            controls={generation.kind === 'video'}
            className="absolute inset-0"
          />
        )}
        <span className="absolute left-2.5 top-2.5 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-zinc-200 backdrop-blur">
          {modelName}
        </span>
      </div>
      <div className="space-y-2 p-3">
        <p className="line-clamp-2 text-sm text-zinc-300" title={generation.prompt}>
          {generation.prompt}
        </p>
        {done && (
          <div className="-mx-1 flex flex-wrap items-center gap-1">
            <DownloadLink generation={generation} />
            {isImage && (
              <Link to={`/?modo=video&origem=${generation.id}`} className={ACTION}>
                <Film className="size-4" aria-hidden="true" />
                Animar
              </Link>
            )}
            {isImage && onMakePersona && (
              <button type="button" onClick={() => onMakePersona(generation)} className={ACTION}>
                <UserRoundPlus className="size-4" aria-hidden="true" />
                Virar persona
              </button>
            )}
          </div>
        )}
      </div>
    </motion.article>
  )
}
