import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Generation, Persona } from '@/domain/types'
import { createPersona, errorMessage } from '@/lib/api'
import { MediaView } from './MediaView'
import { Button } from './ui/Button'
import { TextField } from './ui/Field'
import { Notice } from './ui/Notice'

interface MakePersonaDialogProps {
  readonly generation: Generation | null
  readonly defaultName?: string
  readonly defaultDescription?: string
  readonly onClose: () => void
  readonly onCreated: (persona: Persona) => void
}

/** Salva uma imagem gerada como persona. Usa <dialog> nativo: foco preso e Esc de graça. */
export function MakePersonaDialog({
  generation,
  defaultName = '',
  defaultDescription = '',
  onClose,
  onCreated,
}: MakePersonaDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(defaultName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (generation && !dialog.open) {
      setName(defaultName)
      setError(null)
      dialog.showModal()
    }
    if (!generation && dialog.open) dialog.close()
  }, [generation, defaultName])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!generation) return
    setSaving(true)
    setError(null)
    try {
      onCreated(await createPersona(generation.id, name.trim(), defaultDescription || generation.prompt.slice(0, 500)))
    } catch (createError) {
      setError(errorMessage(createError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="persona-dialog-title"
      className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-white/10 bg-zinc-900 p-0 text-zinc-100 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {generation && (
        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          <div className="flex items-center gap-4">
            <MediaView path={generation.output_path} kind="image" alt="" className="size-16 shrink-0 rounded-xl" />
            <div>
              <h2 id="persona-dialog-title" className="font-semibold">
                Salvar como persona
              </h2>
              <p className="text-sm text-zinc-400">Ela vira referência de rosto para novas fotos e vídeos.</p>
            </div>
          </div>
          <TextField
            label="Nome da persona"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            required
            autoFocus
            placeholder="Ex.: Luna"
          />
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} disabled={!name.trim()}>
              Salvar persona
            </Button>
          </div>
        </form>
      )}
    </dialog>
  )
}
