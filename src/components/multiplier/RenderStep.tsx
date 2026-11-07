import clsx from 'clsx'
import { Download, FileArchive, Music, Play, RotateCcw, Square, X } from 'lucide-react'
import { useCallback, useId, useMemo, useState } from 'react'
import {
  ACCEPTED_FILES,
  buildTimeline,
  exportFileName,
  groupBatches,
  MAX_FILE_BYTES,
  RENDER_STYLE_LABELS,
  RENDER_STYLES,
  type MultiplierProject,
  type RenderStyle,
  type Variation,
} from '@/domain/multiplier'
import { MAX_ATTEMPTS, useRenderQueue, type RenderJob } from '@/hooks/useRenderQueue'
import { renderUnsupportedReason } from '@/lib/render/compositor'
import { downloadBlob, zipFiles } from '@/lib/render/download'
import { markVariationRendered } from '@/lib/multiplierApi'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'

const STATUS_LABELS: Record<RenderJob['status'], string> = {
  queued: 'Na fila',
  rendering: 'Montando',
  done: 'Pronto',
  failed: 'Falhou',
  canceled: 'Cancelado',
}

function Slider({ label, value, onChange }: { readonly label: string; readonly value: number; readonly onChange: (value: number) => void }) {
  const id = useId()
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[13px]">
        <label htmlFor={id} className="font-semibold text-zinc-300">
          {label}
        </label>
        <span className="tabular-nums text-zinc-500">{Math.round(value * 100)}%</span>
      </div>
      <input id={id} type="range" min={0} max={1} step={0.05} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-[var(--color-accent)]" />
    </div>
  )
}

interface JobRowProps {
  readonly variation: Variation
  readonly job: RenderJob | undefined
  readonly fileName: string
  readonly selected: boolean
  readonly onToggle: () => void
  readonly onCancel: () => void
  readonly onRetry: () => void
}

function JobRow({ variation, job, fileName, selected, onToggle, onCancel, onRetry }: JobRowProps) {
  const [previewing, setPreviewing] = useState(false)
  const status = job?.status
  const active = status === 'rendering' || status === 'queued'
  return (
    <li className="rounded-2xl bg-surface p-4 ring-1 ring-white/[0.06]">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          disabled={active}
          aria-label={`Selecionar variação ${variation.position}`}
          className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold tabular-nums text-zinc-500">{String(variation.position).padStart(2, '0')}</span>
            <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent-soft">{variation.script.angle}</span>
            {status && (
              <span className={clsx('text-xs font-semibold', status === 'failed' ? 'text-red-300' : status === 'done' ? 'text-accent-soft' : 'text-zinc-400')}>
                {STATUS_LABELS[status]}
                {status === 'rendering' && ` ${Math.round((job?.progress ?? 0) * 100)}%`}
              </span>
            )}
            {!status && variation.renderStatus === 'rendered' && <span className="text-xs text-zinc-500">montada antes</span>}
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-zinc-100">{variation.script.hook}</p>
          {(status === 'rendering' || status === 'queued') && (
            <div
              role="progressbar"
              aria-label={`Progresso da variação ${variation.position}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((job?.progress ?? 0) * 100)}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
            >
              <div className="h-full rounded-full bg-accent transition-[width] motion-reduce:transition-none" style={{ width: `${(job?.progress ?? 0) * 100}%` }} />
            </div>
          )}
          {job?.error && <p className="mt-2 text-sm text-red-300">{job.error}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {active && (
            <Button variant="ghost" className="min-h-9 px-2" onClick={onCancel} aria-label={`Cancelar variação ${variation.position}`}>
              <X className="size-4" aria-hidden="true" />
            </Button>
          )}
          {status === 'failed' && (job?.attempts ?? 0) < MAX_ATTEMPTS && (
            <Button variant="ghost" className="min-h-9 px-2" onClick={onRetry}>
              <RotateCcw className="size-4" aria-hidden="true" /> Tentar de novo
            </Button>
          )}
          {status === 'done' && job?.output && job.url && (
            <>
              <Button variant="ghost" className="min-h-9 px-2" onClick={() => setPreviewing((value) => !value)} aria-expanded={previewing}>
                <Play className="size-4" aria-hidden="true" /> {previewing ? 'Fechar' : 'Ver'}
              </Button>
              <Button variant="secondary" className="min-h-9 px-3" onClick={() => downloadBlob(job.output!.blob, fileName)}>
                <Download className="size-4" aria-hidden="true" /> Baixar
              </Button>
            </>
          )}
        </div>
      </div>
      {previewing && job?.url && (
        <video src={job.url} controls playsInline className="mx-auto mt-3 max-h-[70vh] w-auto max-w-full rounded-xl bg-black" aria-label={`Prévia da variação ${variation.position}`} />
      )}
    </li>
  )
}

interface RenderStepProps {
  readonly project: MultiplierProject
  readonly variations: readonly Variation[]
  readonly files: ReadonlyMap<string, File>
  readonly onRendered: (variation: Variation) => void
  readonly onGoToMaterials: () => void
}

export function RenderStep({ project, variations, files, onRendered, onGoToMaterials }: RenderStepProps) {
  const unsupported = renderUnsupportedReason()
  const batches = useMemo(() => groupBatches(variations), [variations])
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(batches[0]?.variations.map((item) => item.id) ?? []))
  const [style, setStyle] = useState<RenderStyle>('impacto')
  const [music, setMusic] = useState<File | null>(null)
  const [musicVolume, setMusicVolume] = useState(0.25)
  const [takeVolume, setTakeVolume] = useState(1)
  const [musicError, setMusicError] = useState<string | null>(null)
  const [zipping, setZipping] = useState(false)
  const musicId = useId()

  const byId = useMemo(() => new Map(variations.map((item) => [item.id, item])), [variations])
  const missingFiles = project.takes.filter((take) => !files.has(take.id))

  const prepare = useCallback(
    (id: string) => {
      const variation = byId.get(id)
      if (!variation) throw new Error('variação não encontrada')
      return { timeline: buildTimeline(variation.script, project.takes, project.aspect), files, style, music, musicVolume, takeVolume }
    },
    [byId, project.takes, project.aspect, files, style, music, musicVolume, takeVolume],
  )

  const onFinished = useCallback(
    (id: string, ok: boolean) => {
      void markVariationRendered(id, ok)
      const variation = byId.get(id)
      if (variation && ok) onRendered({ ...variation, renderStatus: 'rendered' })
    },
    [byId, onRendered],
  )

  const queue = useRenderQueue({ prepare, onFinished })
  const fileNameOf = (variation: Variation, extension = 'mp4') => exportFileName(project.name, variation, extension)
  const done = variations.filter((item) => queue.jobs[item.id]?.status === 'done' && queue.jobs[item.id]?.output)

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function chooseMusic(file: File | undefined) {
    setMusicError(null)
    if (!file) return setMusic(null)
    if (!(ACCEPTED_FILES.music as readonly string[]).includes(file.type)) return setMusicError('Use um arquivo de áudio MP3, M4A, WAV ou OGG.')
    if (file.size > MAX_FILE_BYTES.music) return setMusicError('Trilha grande demais (até 30 MB).')
    setMusic(file)
  }

  async function downloadAll() {
    setZipping(true)
    try {
      const videos = done.map((variation) => {
        const output = queue.jobs[variation.id]!.output!
        return { name: fileNameOf(variation, output.extension), blob: output.blob }
      })
      const captions = done
        .map((variation) => `${fileNameOf(variation, queue.jobs[variation.id]!.output!.extension)}\n${variation.script.caption}`)
        .join('\n\n---\n\n')
      const zip = await zipFiles([...videos, { name: 'legendas.txt', blob: new Blob([captions], { type: 'text/plain' }) }])
      downloadBlob(zip, `${fileNameOf(done[0]!).replace(/-\d{2}-.*$/, '')}-variacoes.zip`)
    } finally {
      setZipping(false)
    }
  }

  if (variations.length === 0) {
    return <Notice>Gere as variações na etapa Roteiros antes de montar.</Notice>
  }

  const chosen = [...selected].filter((id) => byId.has(id))

  return (
    <div className="space-y-6">
      {unsupported && <Notice tone="error">{unsupported}</Notice>}
      {missingFiles.length > 0 && (
        <Notice>
          <span className="block">
            {missingFiles.length === 1 ? 'Um take está' : `${missingFiles.length} takes estão`} sem arquivo nesta aba. Os vídeos ficam no seu aparelho, então depois de
            recarregar a página é preciso escolher os arquivos de novo.
          </span>
          <Button variant="secondary" className="mt-3" onClick={onGoToMaterials}>
            Reenviar os arquivos
          </Button>
        </Notice>
      )}

      <section aria-labelledby="style-title" className="space-y-5 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
        <h2 id="style-title" className="font-headline text-xl text-zinc-100">
          Estilo da montagem
        </h2>
        <fieldset>
          <legend className="sr-only">Estilo do texto na tela</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {RENDER_STYLES.map((value) => (
              <label key={value} className="cursor-pointer">
                <input type="radio" name="style" value={value} checked={style === value} onChange={() => setStyle(value)} className="peer sr-only" disabled={queue.busy} />
                <span className="block h-full rounded-2xl border border-white/[0.08] bg-surface-2 p-4 peer-checked:border-accent peer-checked:bg-accent/10 peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                  <span className="block text-sm font-bold text-zinc-100">{RENDER_STYLE_LABELS[value].name}</span>
                  <span className="mt-1 block text-xs text-zinc-400">{RENDER_STYLE_LABELS[value].description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label htmlFor={musicId} className="mb-1.5 block text-[13px] font-semibold text-zinc-300">
              Trilha (opcional)
            </label>
            <div className="flex items-center gap-2">
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-surface-2 px-3 text-sm text-zinc-200 focus-within:ring-2 focus-within:ring-accent hover:bg-surface-3">
                <Music className="size-4 text-accent-soft" aria-hidden="true" />
                <span className="max-w-40 truncate">{music ? music.name : 'Escolher áudio'}</span>
                <input id={musicId} type="file" accept={ACCEPTED_FILES.music.join(',')} className="sr-only" onChange={(event) => chooseMusic(event.target.files?.[0])} disabled={queue.busy} />
              </label>
              {music && (
                <Button variant="ghost" className="min-h-9 px-2" onClick={() => setMusic(null)} aria-label="Tirar a trilha" disabled={queue.busy}>
                  <X className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">Use só música sua ou com licença para uso comercial.</p>
            {musicError && <p className="mt-1 text-xs text-red-300">{musicError}</p>}
          </div>
          <Slider label="Volume da trilha" value={musicVolume} onChange={setMusicVolume} />
          <Slider label="Som original dos takes" value={takeVolume} onChange={setTakeVolume} />
        </div>
      </section>

      <section aria-labelledby="queue-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="queue-title" className="font-headline text-xl text-zinc-100">
            Variações
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setSelected(new Set(variations.map((item) => item.id)))} disabled={queue.busy}>
              Selecionar todas
            </Button>
            <Button variant="ghost" onClick={() => setSelected(new Set())} disabled={queue.busy || selected.size === 0}>
              Limpar
            </Button>
          </div>
        </div>
        <p className="text-sm text-zinc-400">
          A montagem acontece aqui no navegador, quadro a quadro, um vídeo por vez. Pode usar outra aba enquanto isso; só não feche esta página até terminar.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => queue.enqueue(chosen)} disabled={chosen.length === 0 || Boolean(unsupported) || missingFiles.length > 0}>
            <Play className="size-4" aria-hidden="true" /> Montar {chosen.length} {chosen.length === 1 ? 'vídeo' : 'vídeos'}
          </Button>
          {queue.busy && (
            <Button variant="secondary" onClick={queue.cancelAll}>
              <Square className="size-4" aria-hidden="true" /> Parar tudo
            </Button>
          )}
          {done.length > 0 && (
            <Button variant="secondary" onClick={() => void downloadAll()} loading={zipping} disabled={queue.busy}>
              <FileArchive className="size-4" aria-hidden="true" /> Baixar {done.length} em ZIP
            </Button>
          )}
        </div>
        {batches.map((batch) => (
          <ol key={batch.id} className="space-y-2">
            {batch.variations.map((variation) => {
              const job = queue.jobs[variation.id]
              return (
                <JobRow
                  key={variation.id}
                  variation={variation}
                  job={job}
                  fileName={fileNameOf(variation, job?.output?.extension)}
                  selected={selected.has(variation.id)}
                  onToggle={() => toggle(variation.id)}
                  onCancel={() => queue.cancel(variation.id)}
                  onRetry={() => queue.retry(variation.id)}
                />
              )
            })}
          </ol>
        ))}
      </section>
    </div>
  )
}
