import clsx from 'clsx'
import { Headset, Lock, UserRound } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { formatDateTime } from '@/domain/format'
import {
  ADMIN_STATUS_LABEL,
  BODY_LIMITS,
  PRIORITY_LABEL,
  USER_STATUS_LABEL,
  type TicketMessage,
  type TicketPriority,
  type TicketStatus,
} from '@/domain/supportTickets'
import { Button } from '../ui/Button'
import { TextArea } from '../ui/Field'

const STATUS_TONE: Record<TicketStatus, string> = {
  open: 'bg-accent/15 text-accent-soft ring-accent/30',
  in_progress: 'bg-sky-500/15 text-sky-300 ring-sky-400/25',
  waiting_user: 'bg-amber-500/15 text-amber-300 ring-amber-400/25',
  resolved: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/25',
}

const PRIORITY_TONE: Record<TicketPriority, string> = {
  urgent: 'bg-rose-500/15 text-rose-300 ring-rose-400/30',
  high: 'bg-orange-500/15 text-orange-300 ring-orange-400/25',
  normal: 'bg-white/[0.06] text-zinc-300 ring-white/10',
  low: 'bg-white/[0.03] text-zinc-500 ring-white/[0.06]',
}

const PILL = 'inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-bold ring-1'

export function StatusPill({ status, audience }: { readonly status: TicketStatus; readonly audience: 'user' | 'admin' }) {
  const label = audience === 'user' ? USER_STATUS_LABEL[status] : ADMIN_STATUS_LABEL[status]
  return <span className={clsx(PILL, STATUS_TONE[status])}>{label}</span>
}

export function PriorityPill({ priority }: { readonly priority: TicketPriority }) {
  return <span className={clsx(PILL, PRIORITY_TONE[priority])}>{PRIORITY_LABEL[priority]}</span>
}

/** Ponto de "resposta nova" ao lado do título. */
export function UnreadDot({ label }: { readonly label: string }) {
  return (
    <span className="relative inline-flex size-2.5 shrink-0" role="img" aria-label={label}>
      <span aria-hidden="true" className="absolute inset-0 rounded-full bg-accent-soft motion-safe:animate-ping" />
      <span aria-hidden="true" className="relative size-2.5 rounded-full bg-accent-soft" />
    </span>
  )
}

function authorOf(message: TicketMessage, audience: 'user' | 'admin'): string {
  if (message.internal) return 'Nota interna'
  if (message.author === 'admin') return 'Equipe Vynkio'
  return audience === 'user' ? 'Você' : 'Usuário'
}

/** Conversa do chamado. Para a pessoa, a resposta dela fica à direita; nota interna só aparece no admin. */
export function TicketThread({ messages, audience }: { readonly messages: readonly TicketMessage[]; readonly audience: 'user' | 'admin' }) {
  return (
    <ol className="space-y-3" aria-label="Mensagens do chamado">
      {messages.map((message) => {
        const mine = (audience === 'user' && message.author === 'user') || (audience === 'admin' && message.author === 'admin')
        const Icon = message.internal ? Lock : message.author === 'admin' ? Headset : UserRound
        return (
          <li key={message.id} className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
            <article
              className={clsx(
                'max-w-[92%] rounded-2xl px-4 py-3 text-sm ring-1 sm:max-w-[80%]',
                message.internal
                  ? 'bg-amber-500/[0.07] text-amber-100 ring-amber-400/25'
                  : mine
                    ? 'bg-accent/[0.12] text-zinc-100 ring-accent/25'
                    : 'bg-surface-2 text-zinc-200 ring-white/[0.06]',
              )}
            >
              <header className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
                <Icon className="size-3.5 opacity-80" aria-hidden="true" />
                <span className="font-semibold">{authorOf(message, audience)}</span>
                <time dateTime={message.created_at} className="text-zinc-500">
                  {formatDateTime(message.created_at)}
                </time>
              </header>
              <p className="whitespace-pre-wrap break-words leading-relaxed">{message.body}</p>
            </article>
          </li>
        )
      })}
    </ol>
  )
}

interface ReplyBoxProps {
  readonly label: string
  readonly placeholder: string
  readonly submitLabel: string
  readonly onSubmit: (body: string) => Promise<boolean>
  /** Controles extras ao lado do botão (nota interna, situação depois de responder). */
  readonly extra?: ReactNode
}

/** Caixa de resposta: limpa só quando o envio deu certo, para nada se perder. */
export function ReplyBox({ label, placeholder, submitLabel, onSubmit, extra }: ReplyBoxProps) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!body.trim() || sending) return
    setSending(true)
    try {
      if (await onSubmit(body)) setBody('')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-3">
      <TextArea label={label} placeholder={placeholder} value={body} maxLength={BODY_LIMITS.max} rows={4} onChange={(event) => setBody(event.target.value)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">{extra}</div>
        <Button type="submit" loading={sending} disabled={!body.trim() || sending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
