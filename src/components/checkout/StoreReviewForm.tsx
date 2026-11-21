import { CheckCircle2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { CheckoutAlert } from '@/components/checkout/CheckoutAlert'
import { CheckoutInput, CheckoutTextArea } from '@/components/checkout/fields'
import { StarInput } from '@/components/testimonials/StarInput'
import { errorMessage, reviewStoreOrder } from '@/lib/api'

interface StoreReviewFormProps {
  readonly token: string
  readonly product: string
  readonly alreadySent: boolean
}

/**
 * Depoimento de quem comprou (0041). Vai para revisão no admin e só aparece no checkout com a autorização
 * marcada aqui.
 */
export function StoreReviewForm({ token, product, alreadySent }: StoreReviewFormProps) {
  const [sent, setSent] = useState(alreadySent)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [body, setBody] = useState('')
  const [rating, setRating] = useState(5)
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (sent) {
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-zinc-600" role="status">
        <CheckCircle2 className="size-4 text-green-700" aria-hidden="true" /> Obrigado pelo depoimento!
      </p>
    )
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!consent) {
      setError('Marque a autorização para publicar.')
      return
    }
    setSending(true)
    setError(null)
    try {
      await reviewStoreOrder(token, { authorName: name, authorRole: role, body, rating, consent: true })
      setSent(true)
    } catch (sendError) {
      setError(errorMessage(sendError))
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={(event) => void send(event)} className="space-y-4 border-t border-zinc-200 pt-5 text-left">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">O que achou do {product}?</h2>
        <p className="mt-1 text-[13px] text-zinc-500">Seu depoimento ajuda quem está decidindo. Só publicamos com a sua autorização.</p>
      </div>
      <StarInput value={rating} onChange={setRating} tone="light" />
      <CheckoutInput label="Seu nome" required minLength={2} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />
      <CheckoutInput
        label="O que você faz (opcional)"
        maxLength={80}
        placeholder="Ex.: criadora de conteúdo"
        value={role}
        onChange={(event) => setRole(event.target.value)}
      />
      <CheckoutTextArea label="Seu depoimento" required minLength={20} maxLength={600} rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
      <label className="flex items-start gap-2.5 text-sm text-zinc-700">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 size-4 accent-violet-600" />
        Autorizo publicar este depoimento com meu primeiro nome e a inicial do sobrenome.
      </label>
      {error && <CheckoutAlert>{error}</CheckoutAlert>}
      <button
        type="submit"
        disabled={sending}
        className="min-h-11 w-full rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-600/30 disabled:opacity-80"
      >
        {sending ? 'Enviando...' : 'Enviar depoimento'}
      </button>
    </form>
  )
}
