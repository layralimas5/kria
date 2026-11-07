import clsx from 'clsx'
import { Check, ChevronDown, Copy, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { LIMITS, normalizeScript, scriptDuration, type Beat, type TakeInfo, type Variation, type VariationScript } from '@/domain/multiplier'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { errorMessage } from '@/lib/api'
import { deleteVariation, saveVariationScript } from '@/lib/multiplierApi'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { TextArea, TextField } from '../ui/Field'
import { Notice } from '../ui/Notice'

const FIELD =
  'w-full rounded-lg border border-white/[0.08] bg-surface-2 px-2.5 py-2 text-sm text-zinc-100 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20'

interface BeatRowProps {
  readonly beat: Beat
  readonly index: number
  readonly takes: readonly TakeInfo[]
  readonly onChange: (beat: Beat) => void
  readonly onRemove: () => void
  readonly canRemove: boolean
}

function BeatRow({ beat, index, takes, onChange, onRemove, canRemove }: BeatRowProps) {
  const take = takes[beat.take - 1]
  const number = (value: string) => Number.parseFloat(value.replace(',', '.')) || 0
  return (
    <li className="grid gap-2 rounded-xl bg-surface-2/60 p-3 sm:grid-cols-[minmax(0,10rem)_5rem_5rem_minmax(0,1fr)_auto] sm:items-end">
      <label className="text-xs text-zinc-400">
        Cena {index + 1}: take
        <select className={clsx(FIELD, 'mt-1')} value={beat.take} onChange={(event) => onChange({ ...beat, take: Number(event.target.value), start: 0 })}>
          {takes.map((item, takeIndex) => (
            <option key={item.id} value={takeIndex + 1}>
              {takeIndex + 1}. {item.note || item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-zinc-400">
        Início (s)
        <input
          className={clsx(FIELD, 'mt-1')}
          inputMode="decimal"
          value={beat.start}
          disabled={take?.kind === 'image'}
          onChange={(event) => onChange({ ...beat, start: number(event.target.value) })}
        />
      </label>
      <label className="text-xs text-zinc-400">
        Duração (s)
        <input className={clsx(FIELD, 'mt-1')} inputMode="decimal" value={beat.duration} onChange={(event) => onChange({ ...beat, duration: number(event.target.value) })} />
      </label>
      <label className="text-xs text-zinc-400">
        Texto na tela
        <input className={clsx(FIELD, 'mt-1')} maxLength={LIMITS.beatText} value={beat.text} onChange={(event) => onChange({ ...beat, text: event.target.value })} />
      </label>
      <Button variant="ghost" className="min-h-9 px-2 hover:text-red-300" onClick={onRemove} disabled={!canRemove} aria-label={`Remover cena ${index + 1}`}>
        <X className="size-4" aria-hidden="true" />
      </Button>
    </li>
  )
}

interface VariationEditorProps {
  readonly variation: Variation
  readonly takes: readonly TakeInfo[]
  readonly onSaved: (variation: Variation) => void
  readonly onDeleted: (id: string) => void
}

/** Cartão de uma variação: resumo fechado, edição completa aberta. */
export function VariationEditor({ variation, takes, onSaved, onDeleted }: VariationEditorProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<VariationScript>(variation.script)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { copied, failed, copy } = useCopyToClipboard()
  const dirty = JSON.stringify(draft) !== JSON.stringify(variation.script)
  const panelId = `variation-${variation.id}`

  function setBeat(index: number, beat: Beat) {
    setDraft((current) => ({ ...current, beats: current.beats.map((item, itemIndex) => (itemIndex === index ? beat : item)) }))
  }

  function addBeat() {
    setDraft((current) => ({ ...current, beats: [...current.beats, { take: 1, start: 0, duration: 3, text: '' }] }))
  }

  async function save() {
    // O mesmo ajuste do servidor: cena dentro do take, limites de tamanho e de tempo.
    const script = normalizeScript(draft, takes)
    if (!script) return setError('O roteiro precisa de um gancho e de pelo menos uma cena.')
    setBusy(true)
    setError(null)
    try {
      await saveVariationScript(variation.id, script)
      setDraft(script)
      onSaved({ ...variation, script, edited: true, renderStatus: 'pending' })
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await deleteVariation(variation.id)
      onDeleted(variation.id)
    } catch (deleteError) {
      setError(errorMessage(deleteError))
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <article className="rounded-2xl bg-surface ring-1 ring-white/[0.06]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-3 rounded-2xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-xs font-bold tabular-nums text-zinc-300">
          {String(variation.position).padStart(2, '0')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent-soft">{variation.script.angle}</span>
            <span className="text-xs tabular-nums text-zinc-500">
              {variation.script.beats.length} cenas · {scriptDuration(variation.script).toFixed(0)} s
            </span>
            {variation.edited && <span className="text-xs text-zinc-500">editada</span>}
            {variation.renderStatus === 'rendered' && <span className="text-xs font-semibold text-accent-soft">montada</span>}
          </span>
          <span className="mt-1.5 block text-[15px] font-semibold text-zinc-100">{variation.script.hook}</span>
        </span>
        <ChevronDown className={clsx('mt-1 size-4 shrink-0 text-zinc-500 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div id={panelId} className="space-y-4 border-t border-white/[0.06] p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            <TextField label="Ângulo" value={draft.angle} maxLength={LIMITS.angle} onChange={(event) => setDraft({ ...draft, angle: event.target.value })} />
            <TextField label="Gancho (aparece nos 3 primeiros segundos)" value={draft.hook} maxLength={LIMITS.hook} onChange={(event) => setDraft({ ...draft, hook: event.target.value })} />
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold text-zinc-300">Cenas, na ordem do vídeo</p>
            <ol className="space-y-2">
              {draft.beats.map((beat, index) => (
                <BeatRow
                  key={index}
                  beat={beat}
                  index={index}
                  takes={takes}
                  onChange={(next) => setBeat(index, next)}
                  onRemove={() => setDraft({ ...draft, beats: draft.beats.filter((_, itemIndex) => itemIndex !== index) })}
                  canRemove={draft.beats.length > 1}
                />
              ))}
            </ol>
            {draft.beats.length < LIMITS.maxBeats && (
              <Button variant="ghost" className="mt-2" onClick={addBeat}>
                <Plus className="size-4" aria-hidden="true" /> Adicionar cena
              </Button>
            )}
          </div>
          <TextField label="CTA (cartão final)" value={draft.cta} maxLength={LIMITS.cta} onChange={(event) => setDraft({ ...draft, cta: event.target.value })} />
          <div>
            <TextArea label="Legenda do post" value={draft.caption} maxLength={LIMITS.caption} rows={4} onChange={(event) => setDraft({ ...draft, caption: event.target.value })} />
            <Button variant="ghost" className="mt-1" onClick={() => void copy('caption', draft.caption)} disabled={!draft.caption}>
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied ? 'Legenda copiada' : failed ? 'Não deu para copiar' : 'Copiar legenda'}
            </Button>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void save()} loading={busy} disabled={!dirty}>
              Salvar roteiro
            </Button>
            <Button variant="secondary" onClick={() => setDraft(variation.script)} disabled={!dirty || busy}>
              Desfazer
            </Button>
            <Button variant="ghost" className="ml-auto hover:text-red-300" onClick={() => setConfirming(true)}>
              <Trash2 className="size-4" aria-hidden="true" /> Apagar
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog open={confirming} title="Apagar variação" confirmLabel="Apagar" busy={busy} onConfirm={() => void remove()} onCancel={() => setConfirming(false)}>
        <p>A variação {variation.position} sai do projeto. Os créditos do lote não voltam.</p>
      </ConfirmDialog>
    </article>
  )
}
