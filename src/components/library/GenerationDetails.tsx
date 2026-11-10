import clsx from 'clsx'
import { Check, Copy, Download, Film, RotateCcw, UserRoundPlus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatCredits, formatDateTime } from '@/domain/format'
import { reuseLink } from '@/domain/library'
import { isOpen, type Generation } from '@/domain/types'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { MediaView } from '../MediaView'
import { Drawer } from '../ui/Drawer'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const SECONDARY = 'border border-white/[0.08] bg-surface-2 text-zinc-100 hover:bg-surface-3'
const ACTION = clsx('inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors', FOCUS)

const STATUS: Record<Generation['status'], { label: string; tone: string }> = {
  succeeded: { label: 'Pronta', tone: 'bg-emerald-400/10 text-emerald-300' },
  running: { label: 'Em produção', tone: 'bg-accent/15 text-accent-soft' },
  queued: { label: 'Na fila', tone: 'bg-accent/15 text-accent-soft' },
  failed: { label: 'Falhou', tone: 'bg-red-400/10 text-red-300' },
}

/** "9:16" vira "9 / 16" para o aspect-ratio do CSS; o resto cai no retrato 4:5. */
function aspectOf(generation: Pick<Generation, 'options'>): string {
  const ratio = generation.options.aspect_ratio
  return ratio && /^\d+:\d+$/.test(ratio) ? ratio.replace(':', ' / ') : '4 / 5'
}

function CopyPrompt({ prompt }: { readonly prompt: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt)
      setState('copied')
    } catch (copyError) {
      console.warn('não deu para copiar o prompt', copyError)
      setState('failed')
    }
    window.setTimeout(() => setState('idle'), 2000)
  }
  return (
    <button type="button" onClick={() => void copy()} className={clsx('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100', FOCUS)}>
      {state === 'copied' ? <Check className="size-3.5 text-emerald-300" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      <span aria-live="polite">{state === 'copied' ? 'Copiado' : state === 'failed' ? 'Não deu para copiar' : 'Copiar'}</span>
    </button>
  )
}

function Fact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-zinc-100">{children}</dd>
    </div>
  )
}

interface GenerationDetailsProps {
  readonly generation: Generation | null
  readonly modelName: (slug: string) => string
  readonly onClose: () => void
  readonly onMakePersona: (generation: Generation) => void
  /** Refazer sem sair da tela (no Estúdio); sem ele, o botão leva ao Estúdio com o pedido. */
  readonly onReuse?: (generation: Generation) => void
}

/** Painel lateral com a criação em tamanho grande, o pedido, os dados e as ações. */
export function GenerationDetails({ generation, modelName, onClose, onMakePersona, onReuse }: GenerationDetailsProps) {
  const url = useSignedUrl(generation?.status === 'succeeded' ? generation.output_path : null)
  const kindLabel = generation?.kind === 'video' ? 'Vídeo' : 'Imagem'

  return (
    <Drawer open={generation !== null} title={generation ? `${kindLabel} · ${modelName(generation.model_slug)}` : ''} onClose={onClose} size="lg">
      {generation && (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-white/[0.06]" style={{ aspectRatio: aspectOf(generation) }}>
            {generation.status === 'succeeded' ? (
              <MediaView path={generation.output_path} kind={generation.kind} alt={generation.prompt} className="size-full" />
            ) : (
              <div className="grid size-full place-items-center p-6 text-center text-sm text-zinc-400">
                {isOpen(generation) ? 'Ainda em produção. Aparece aqui quando ficar pronta.' : (generation.error ?? 'A geração falhou e os créditos voltaram para a sua conta.')}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <span className={clsx('w-fit rounded-md px-2 py-0.5 text-xs font-bold', STATUS[generation.status].tone)}>{STATUS[generation.status].label}</span>

            <section aria-labelledby="details-prompt" className="card-premium rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 id="details-prompt" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Pedido
                </h3>
                <CopyPrompt prompt={generation.prompt} />
              </div>
              <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{generation.prompt}</p>
            </section>

            <dl className="grid grid-cols-2 gap-4">
              <Fact label="Modelo">{modelName(generation.model_slug)}</Fact>
              <Fact label="Créditos">{generation.status === 'failed' ? 'Devolvidos' : formatCredits(generation.credits)}</Fact>
              <Fact label="Criada em">{formatDateTime(generation.created_at)}</Fact>
              <Fact label="Proporção">{generation.options.aspect_ratio ?? 'Padrão'}</Fact>
            </dl>

            <div className="mt-auto grid gap-2">
              {url && (
                <a href={url} download target="_blank" rel="noreferrer" className={clsx(ACTION, 'btn-accent')}>
                  <Download className="size-4" aria-hidden="true" /> Baixar
                </a>
              )}
              {onReuse ? (
                <button type="button" onClick={() => onReuse(generation)} className={clsx(ACTION, SECONDARY)}>
                  <RotateCcw className="size-4" aria-hidden="true" /> Usar este pedido de novo
                </button>
              ) : (
                <Link to={reuseLink(generation)} className={clsx(ACTION, SECONDARY)}>
                  <RotateCcw className="size-4" aria-hidden="true" /> Usar este pedido de novo
                </Link>
              )}
              {generation.kind === 'image' && generation.status === 'succeeded' && (
                <Link to={`/estudio?modo=video&origem=${generation.id}`} className={clsx(ACTION, SECONDARY)}>
                  <Film className="size-4" aria-hidden="true" /> Animar em vídeo
                </Link>
              )}
              {/* Imagem que nasceu de foto enviada não vira persona (o banco também recusa). */}
              {generation.kind === 'image' && generation.status === 'succeeded' && !generation.from_upload && (
                <button type="button" onClick={() => onMakePersona(generation)} className={clsx(ACTION, 'text-zinc-300 hover:bg-white/[0.05] hover:text-zinc-50')}>
                  <UserRoundPlus className="size-4" aria-hidden="true" /> Virar persona
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  )
}
