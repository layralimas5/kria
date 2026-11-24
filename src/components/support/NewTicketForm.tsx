import { Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { BODY_LIMITS, CATEGORY_LABEL, SUBJECT_LIMITS, TICKET_CATEGORIES, validateDraft, type DraftErrors, type TicketDraft } from '@/domain/supportTickets'
import { errorMessage } from '@/lib/api'
import { openTicket } from '@/lib/supportTicketsApi'
import { Button } from '../ui/Button'
import { TextArea, TextField } from '../ui/Field'
import { Notice } from '../ui/Notice'
import { SelectField } from '../ui/SelectField'

const EMPTY: TicketDraft = { category: '', subject: '', body: '' }

const CATEGORY_OPTIONS = [
  { value: '' as const, label: 'Escolha o assunto' },
  ...TICKET_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABEL[value] })),
]

function FieldError({ id, message }: { readonly id: string; readonly message: string | undefined }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-rose-300" role="alert">
      {message}
    </p>
  )
}

interface NewTicketFormProps {
  readonly onCreated: (id: string) => void
  readonly onCancel: () => void
}

/** Formulário de chamado: assunto, título e o relato. As regras são as mesmas do banco. */
export function NewTicketForm({ onCreated, onCancel }: NewTicketFormProps) {
  const [failure, setFailure] = useState<string | null>(null)
  const [draft, setDraft] = useState<TicketDraft>(EMPTY)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [sending, setSending] = useState(false)

  const update = (patch: Partial<TicketDraft>) => setDraft((current) => ({ ...current, ...patch }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = validateDraft(draft)
    setErrors(found)
    if (Object.keys(found).length > 0 || !draft.category) return
    setSending(true)
    setFailure(null)
    try {
      onCreated(await openTicket(draft.category, draft.subject, draft.body))
    } catch (error) {
      setFailure(errorMessage(error))
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="card-premium space-y-5 rounded-3xl p-5 sm:p-6" aria-labelledby="new-ticket-title">
      <div>
        <h2 id="new-ticket-title" className="font-headline text-2xl text-zinc-100">
          Abrir chamado
        </h2>
        <p className="mt-1 text-sm text-zinc-400">Conte o que aconteceu, o que você tentou fazer e, se lembrar, em qual tela. Quanto mais detalhe, mais rápido resolvemos.</p>
      </div>
      <div>
        <SelectField label="Assunto" value={draft.category} onChange={(category) => update({ category })} options={CATEGORY_OPTIONS} />
        <FieldError id="ticket-category-error" message={errors.category} />
      </div>
      <div>
        <TextField
          label="Título"
          placeholder="Ex.: Paguei o Pix e o plano não mudou"
          value={draft.subject}
          maxLength={SUBJECT_LIMITS.max}
          aria-invalid={errors.subject ? true : undefined}
          onChange={(event) => update({ subject: event.target.value })}
        />
        <FieldError id="ticket-subject-error" message={errors.subject} />
      </div>
      <div>
        <TextArea
          label="O que está acontecendo?"
          placeholder="Descreva o problema com o máximo de detalhes."
          rows={6}
          value={draft.body}
          maxLength={BODY_LIMITS.max}
          aria-invalid={errors.body ? true : undefined}
          onChange={(event) => update({ body: event.target.value })}
        />
        <FieldError id="ticket-body-error" message={errors.body} />
      </div>
      {failure && <Notice tone="error">{failure}</Notice>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={sending}>
          Cancelar
        </Button>
        <Button type="submit" loading={sending}>
          <Send className="size-4" aria-hidden="true" />
          Enviar chamado
        </Button>
      </div>
    </form>
  )
}
