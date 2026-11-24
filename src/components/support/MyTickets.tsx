import clsx from 'clsx'
import { ArrowLeft, CheckCircle2, ChevronRight, Inbox, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatDateTime } from '@/domain/format'
import { CATEGORY_LABEL, ticketCode, type Ticket, type TicketSummary } from '@/domain/supportTickets'
import { useQuery } from '@/hooks/useQuery'
import { errorMessage } from '@/lib/api'
import { fetchMyTicket, fetchMyTickets, replyToTicket, resolveMyTicket } from '@/lib/supportTicketsApi'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'
import { Spinner } from '../ui/Spinner'
import { NewTicketForm } from './NewTicketForm'
import { ReplyBox, StatusPill, TicketThread, UnreadDot } from './TicketBits'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const TICKET_PARAM = 'chamado'

function Loading() {
  return (
    <div className="grid place-items-center py-16 text-zinc-500" role="status" aria-label="Carregando">
      <Spinner className="size-6" />
    </div>
  )
}

function TicketList({ tickets, onOpen }: { readonly tickets: readonly TicketSummary[]; readonly onOpen: (id: string) => void }) {
  return (
    <ul className="card-premium divide-y divide-white/[0.05] overflow-hidden rounded-3xl">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <button
            type="button"
            onClick={() => onOpen(ticket.id)}
            className={clsx('flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]', FOCUS)}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold tabular-nums text-zinc-500">{ticketCode(ticket)}</span>
                <StatusPill status={ticket.status} audience="user" />
                {ticket.unread && <UnreadDot label="Resposta nova" />}
              </div>
              <p className={clsx('mt-1 truncate text-[15px]', ticket.unread ? 'font-semibold text-zinc-50' : 'text-zinc-200')}>{ticket.subject}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {CATEGORY_LABEL[ticket.category]} · atualizado em {formatDateTime(ticket.updated_at)}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}

type Feedback = { readonly tone: 'success' | 'error'; readonly text: string }

interface DetailProps {
  readonly id: string
  /** Aviso que chega de fora (chamado recém-aberto). */
  readonly initialFeedback: Feedback | null
  readonly onBack: () => void
  readonly onChanged: () => void
}

function TicketDetail({ id, initialFeedback, onBack, onChanged }: DetailProps) {
  const [feedback, setFeedback] = useState<Feedback | null>(initialFeedback)
  const load = useCallback(() => fetchMyTicket(id), [id])
  const query = useQuery(load, 'Não deu para abrir o chamado.')
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [resolving, setResolving] = useState(false)
  const current = ticket ?? query.data

  async function reply(body: string): Promise<boolean> {
    try {
      setTicket(await replyToTicket(id, body))
      setFeedback({ tone: 'success', text: 'Resposta enviada. A equipe é avisada na hora.' })
      onChanged()
      return true
    } catch (error) {
      setFeedback({ tone: 'error', text: errorMessage(error) })
      return false
    }
  }

  async function resolve() {
    setResolving(true)
    try {
      setTicket(await resolveMyTicket(id))
      setFeedback({ tone: 'success', text: 'Chamado encerrado. Se precisar, é só responder que ele reabre.' })
      onChanged()
    } catch (error) {
      setFeedback({ tone: 'error', text: errorMessage(error) })
    } finally {
      setResolving(false)
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="ticket-title">
      <button type="button" onClick={onBack} className={clsx('inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-zinc-400 hover:text-zinc-100', FOCUS)}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Meus chamados
      </button>
      {query.error && <Notice tone="error">{query.error}</Notice>}
      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
      {!current && query.loading && <Loading />}
      {current && (
        <div className="card-premium space-y-6 rounded-3xl p-5 sm:p-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="font-semibold tabular-nums">{ticketCode(current)}</span>
                <StatusPill status={current.status} audience="user" />
                <span>{CATEGORY_LABEL[current.category]}</span>
              </div>
              <h2 id="ticket-title" className="mt-2 font-headline text-2xl text-balance text-zinc-50">
                {current.subject}
              </h2>
            </div>
            {current.status !== 'resolved' && (
              <Button variant="secondary" onClick={() => void resolve()} loading={resolving}>
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Já resolveu
              </Button>
            )}
          </header>
          <TicketThread messages={current.messages} audience="user" />
          <ReplyBox
            label={current.status === 'resolved' ? 'Responder reabre o chamado' : 'Sua resposta'}
            placeholder="Escreva aqui."
            submitLabel="Enviar resposta"
            onSubmit={reply}
          />
        </div>
      )}
    </section>
  )
}

/** Aba Chamados do Suporte: a lista da pessoa, o formulário de abertura e a conversa de cada chamado. */
export function MyTickets() {
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const [justOpened, setJustOpened] = useState<string | null>(null)
  const list = useQuery(fetchMyTickets, 'Não deu para carregar seus chamados.')
  const openId = params.get(TICKET_PARAM)

  const show = (id: string | null) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (id) next.set(TICKET_PARAM, id)
        else next.delete(TICKET_PARAM)
        return next
      },
      { replace: false },
    )
  }

  if (openId) {
    const feedback: Feedback | null = justOpened === openId ? { tone: 'success', text: 'Chamado aberto. A resposta da equipe aparece aqui.' } : null
    return <TicketDetail key={openId} id={openId} initialFeedback={feedback} onBack={() => show(null)} onChanged={() => void list.reload()} />
  }

  if (creating) {
    return (
      <NewTicketForm
        onCancel={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false)
          setJustOpened(id)
          void list.reload()
          show(id)
        }}
      />
    )
  }

  const tickets = list.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">Relate um problema e acompanhe a resposta da equipe aqui.</p>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Abrir chamado
        </Button>
      </div>
      {list.error && <Notice tone="error">{list.error}</Notice>}
      {!list.data && list.loading && <Loading />}
      {list.data && tickets.length === 0 && (
        <div className="card-premium flex flex-col items-center rounded-3xl px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-surface-3 text-accent-soft">
            <Inbox className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-4 font-semibold text-zinc-100">Nenhum chamado ainda</p>
          <p className="mt-1 max-w-sm text-sm text-zinc-400">Se algo não funcionar como deveria, abra um chamado e conte o que aconteceu.</p>
        </div>
      )}
      {tickets.length > 0 && <TicketList tickets={tickets} onOpen={show} />}
    </div>
  )
}
