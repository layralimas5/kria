import { MessageSquareQuote } from 'lucide-react'
import { useCallback, useState, type FormEvent } from 'react'
import { StarInput } from '@/components/testimonials/StarInput'
import { Button } from '@/components/ui/Button'
import { TextArea, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { useQuery } from '@/hooks/useQuery'
import { fetchMyTestimonial, submitTestimonial } from '@/lib/testimonialsApi'

const STATUS_TEXT = {
  pending: 'Recebemos seu depoimento. Ele aparece no checkout depois de revisado.',
  approved: 'Seu depoimento está no ar. Obrigado!',
  hidden: 'Seu depoimento não foi publicado. Se quiser, escreva de novo.',
} as const

/**
 * Pedido de depoimento para quem já pagou uma mensalidade (0041). Só vai ao checkout depois de aprovado
 * no admin, e só com a autorização marcada aqui.
 */
export function ShareExperience() {
  const load = useCallback(fetchMyTestimonial, [])
  const mine = useQuery(load, 'Não deu para carregar o seu depoimento.')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [body, setBody] = useState('')
  const [rating, setRating] = useState(5)
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!mine.data?.eligible) return null
  if (mine.data.status === 'pending' || mine.data.status === 'approved') {
    return <Notice tone="success">{STATUS_TEXT[mine.data.status]}</Notice>
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
      await submitTestimonial({ authorName: name, authorRole: role, body, rating })
      await mine.reload()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Não deu para enviar agora.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section aria-labelledby="share-title" className="rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06] sm:p-6">
      <h2 id="share-title" className="flex items-center gap-2 font-semibold text-zinc-50">
        <MessageSquareQuote className="size-5 text-accent-soft" aria-hidden="true" /> Como está sendo usar o Vynkio?
      </h2>
      <p className="mt-1 text-sm text-zinc-400">
        Seu depoimento pode aparecer para quem está assinando. Só publicamos com a sua autorização e depois de revisar.
      </p>
      {mine.data.status === 'hidden' && <p className="mt-2 text-sm text-zinc-400">{STATUS_TEXT.hidden}</p>}
      <form onSubmit={(event) => void send(event)} className="mt-5 grid gap-4 sm:grid-cols-2">
        <TextField label="Seu nome" required minLength={2} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />
        <TextField
          label="O que você faz (opcional)"
          maxLength={80}
          placeholder="Ex.: social media, loja de roupas"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        />
        <div className="sm:col-span-2">
          <StarInput value={rating} onChange={setRating} tone="dark" />
        </div>
        <TextArea
          label="Seu depoimento"
          className="sm:col-span-2"
          required
          minLength={20}
          maxLength={600}
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <label className="flex items-start gap-2.5 text-sm text-zinc-300 sm:col-span-2">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 size-4 accent-violet-600" />
          Autorizo o Vynkio a publicar este depoimento com meu primeiro nome e a inicial do sobrenome.
        </label>
        {error && (
          <div className="sm:col-span-2">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <div className="sm:col-span-2">
          <Button type="submit" loading={sending}>
            Enviar depoimento
          </Button>
        </div>
      </form>
    </section>
  )
}
