import { useState } from 'react'
import type { ZodType } from 'zod'
import { errorMessage } from '@/lib/api'

/** Abrir, validar e salvar um item do Workspace (marca ou projeto) com um formulário só. */
export function useEntityEditor<Input, Saved extends { readonly id: string }>(
  schema: ZodType<Input>,
  save: (input: Input, id?: string) => Promise<Saved>,
  onSaved: () => Promise<void>,
) {
  const [editing, setEditing] = useState<{ readonly id?: string; readonly draft: Input } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function open(draft: Input, id?: string) {
    setError(null)
    setEditing({ id, draft })
  }

  function update(draft: Input) {
    setEditing((current) => (current ? { ...current, draft } : current))
  }

  async function submit() {
    if (!editing) return
    const parsed = schema.safeParse(editing.draft)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Confira os campos.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await save(parsed.data, editing.id)
      setEditing(null)
      await onSaved()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  return { editing, saving, error, open, update, submit, close: () => setEditing(null) }
}
