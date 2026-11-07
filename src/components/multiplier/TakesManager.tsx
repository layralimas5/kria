import clsx from 'clsx'
import { ArrowDown, ArrowUp, Film, ImageIcon, RefreshCw, Trash2, Upload } from 'lucide-react'
import { useEffect, useId, useRef, useState, type DragEvent } from 'react'
import {
  ACCEPTED_FILES,
  LIMITS,
  matchTake,
  MAX_FILE_BYTES,
  MAX_VIDEO_SECONDS,
  takeKindOf,
  type TakeInfo,
} from '@/domain/multiplier'
import { removeTakeFile, setTakeFile } from '@/hooks/useTakeFiles'
import { readVideoInfo } from '@/lib/render/compositor'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'

const ACCEPT = [...ACCEPTED_FILES.video, ...ACCEPTED_FILES.image].join(',')

function TakeThumb({ file, kind }: { readonly file: File | undefined; readonly kind: TakeInfo['kind'] }) {
  const [url, setUrl] = useState<string | null>(null)
  // Cria e libera o endereço no mesmo efeito: remontar o componente não reaproveita endereço já liberado.
  useEffect(() => {
    if (!file) return setUrl(null)
    const created = URL.createObjectURL(file)
    setUrl(created)
    return () => URL.revokeObjectURL(created)
  }, [file])
  const frame = 'size-16 shrink-0 overflow-hidden rounded-xl bg-surface-3 sm:size-20'
  if (!url) {
    return (
      <div className={clsx(frame, 'grid place-items-center text-zinc-500')}>
        {kind === 'video' ? <Film className="size-5" aria-hidden="true" /> : <ImageIcon className="size-5" aria-hidden="true" />}
      </div>
    )
  }
  return kind === 'video' ? (
    <video src={`${url}#t=0.5`} muted playsInline preload="metadata" className={clsx(frame, 'object-cover')} aria-hidden="true" />
  ) : (
    <img src={url} alt="" className={clsx(frame, 'object-cover')} />
  )
}

/** Lê o arquivo e devolve o take, ou o motivo de recusa. */
async function describeFile(file: File): Promise<TakeInfo | string> {
  const kind = takeKindOf(file.type)
  if (!kind) return `${file.name}: formato não aceito. Use MP4, MOV, WEBM, JPG, PNG ou WEBP.`
  if (file.size > MAX_FILE_BYTES[kind]) return `${file.name}: arquivo grande demais (até ${MAX_FILE_BYTES[kind] / 1024 / 1024} MB).`
  if (kind === 'image') return { id: crypto.randomUUID(), name: file.name.slice(0, 200), kind, duration: LIMITS.imageSeconds, note: '' }
  try {
    const info = await readVideoInfo(file)
    if (info.duration > MAX_VIDEO_SECONDS) return `${file.name}: vídeo com mais de ${MAX_VIDEO_SECONDS / 60} minutos. Corte antes de enviar.`
    return { id: crypto.randomUUID(), name: file.name.slice(0, 200), kind, duration: Math.round(info.duration * 10) / 10, note: '' }
  } catch {
    return `${file.name}: o navegador não conseguiu ler este vídeo.`
  }
}

interface TakesManagerProps {
  readonly projectId: string
  readonly takes: readonly TakeInfo[]
  readonly files: ReadonlyMap<string, File>
  readonly onChange: (takes: readonly TakeInfo[]) => void
}

export function TakesManager({ projectId, takes, files, onChange }: TakesManagerProps) {
  const inputId = useId()
  const replaceInput = useRef<HTMLInputElement>(null)
  const [replacing, setReplacing] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    setReading(true)
    const problems: string[] = []
    const next = [...takes]
    for (const file of Array.from(list)) {
      // Mesmo nome de um take sem arquivo: é o arquivo voltando, não um take novo.
      const known = matchTake(next, file.name)
      if (known && !files.has(known.id)) {
        setTakeFile(projectId, known.id, file)
        continue
      }
      if (next.length >= LIMITS.maxTakes) {
        problems.push(`Limite de ${LIMITS.maxTakes} arquivos por projeto.`)
        break
      }
      const result = await describeFile(file)
      if (typeof result === 'string') {
        problems.push(result)
        continue
      }
      setTakeFile(projectId, result.id, file)
      next.push(result)
    }
    setReading(false)
    setErrors(problems)
    if (next.length !== takes.length) onChange(next)
  }

  async function replaceFile(takeId: string, list: FileList | null) {
    const file = list?.[0]
    const take = takes.find((item) => item.id === takeId)
    if (!file || !take) return
    const result = await describeFile(file)
    if (typeof result === 'string') return setErrors([result])
    if (result.kind !== take.kind) return setErrors([`${file.name}: o take era ${take.kind === 'video' ? 'vídeo' : 'foto'}; envie o mesmo tipo.`])
    setErrors([])
    setTakeFile(projectId, take.id, file)
    onChange(takes.map((item) => (item.id === take.id ? { ...item, name: result.name, duration: result.duration } : item)))
  }

  function update(id: string, changes: Partial<TakeInfo>) {
    onChange(takes.map((take) => (take.id === id ? { ...take, ...changes } : take)))
  }

  function move(index: number, offset: number) {
    const target = index + offset
    if (target < 0 || target >= takes.length) return
    const next = [...takes]
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onChange(next)
  }

  function remove(id: string) {
    removeTakeFile(projectId, id)
    onChange(takes.filter((take) => take.id !== id))
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    void addFiles(event.dataTransfer.files)
  }

  const missing = takes.filter((take) => !files.has(take.id))

  return (
    <div className="space-y-4">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={clsx(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-dashed px-6 py-10 text-center transition-colors',
          'focus-within:ring-2 focus-within:ring-accent',
          dragging ? 'border-accent bg-accent/10' : 'border-white/15 bg-surface hover:border-white/25',
        )}
      >
        <Upload className="size-6 text-accent-soft" aria-hidden="true" />
        <span className="text-sm font-semibold text-zinc-100">{reading ? 'Lendo os arquivos...' : 'Arraste vídeos e fotos ou clique para escolher'}</span>
        <span className="text-xs text-zinc-500">
          MP4, MOV ou WEBM até 3 minutos · JPG, PNG ou WEBP · até {LIMITS.maxTakes} arquivos. Eles ficam no seu aparelho: nada sobe para o servidor.
        </span>
        <input id={inputId} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(event) => void addFiles(event.target.files).then(() => (event.target.value = ''))} />
      </label>

      {errors.map((error) => (
        <Notice key={error} tone="error">
          {error}
        </Notice>
      ))}
      {missing.length > 0 && (
        <Notice>
          {missing.length === 1 ? 'Um take está' : `${missing.length} takes estão`} sem arquivo nesta aba (a página foi recarregada ou o projeto foi aberto em outro aparelho).
          Arraste os mesmos arquivos de novo ou use "Reenviar" em cada um.
        </Notice>
      )}

      <input
        ref={replaceInput}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          if (replacing) void replaceFile(replacing, event.target.files)
          event.target.value = ''
          setReplacing(null)
        }}
      />

      <ol className="space-y-3">
        {takes.map((take, index) => {
          const file = files.get(take.id)
          return (
            <li key={take.id} className="flex flex-col gap-3 rounded-2xl bg-surface p-3 ring-1 ring-white/[0.06] sm:flex-row sm:items-start">
              <div className="flex min-w-0 flex-1 gap-3">
                <TakeThumb file={file} kind={take.kind} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-xs font-bold text-accent-soft">Take {index + 1}</span>
                    <span className="min-w-0 truncate text-sm font-semibold text-zinc-100">{take.name}</span>
                    <span className="text-xs tabular-nums text-zinc-500">{take.kind === 'video' ? `${take.duration.toFixed(1)} s` : 'foto'}</span>
                    {!file && <span className="text-xs font-semibold text-hot">sem arquivo</span>}
                  </div>
                  <label className="block">
                    <span className="sr-only">O que aparece no take {index + 1}</span>
                    <input
                      value={take.note}
                      maxLength={300}
                      onChange={(event) => update(take.id, { note: event.target.value })}
                      placeholder="O que aparece aqui? Ex.: abrindo a caixa, aplicando no rosto"
                      className="w-full rounded-lg border border-white/[0.08] bg-surface-2 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
                <Button variant="ghost" className="min-h-9 px-2" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Subir take ${index + 1}`}>
                  <ArrowUp className="size-4" aria-hidden="true" />
                </Button>
                <Button variant="ghost" className="min-h-9 px-2" onClick={() => move(index, 1)} disabled={index === takes.length - 1} aria-label={`Descer take ${index + 1}`}>
                  <ArrowDown className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-9 px-2"
                  onClick={() => {
                    setReplacing(take.id)
                    replaceInput.current?.click()
                  }}
                  aria-label={`Reenviar arquivo do take ${index + 1}`}
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  <span className="text-xs">Reenviar</span>
                </Button>
                <Button variant="ghost" className="min-h-9 px-2 hover:text-red-300" onClick={() => remove(take.id)} aria-label={`Remover take ${index + 1}`}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
