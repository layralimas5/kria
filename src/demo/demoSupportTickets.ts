// Chamados no modo demo (0042): mesma regra do banco, guardados só na memória da aba.
// A conta demo é usuária e admin ao mesmo tempo, então dá para abrir na aba Suporte e atender em /admin/chamados.
// O chamado de exemplo se apresenta como exemplo: nada que pareça cliente de verdade.

type Status = 'open' | 'in_progress' | 'waiting_user' | 'resolved'
type Priority = 'low' | 'normal' | 'high' | 'urgent'

interface Message {
  id: string
  author: 'user' | 'admin'
  body: string
  internal: boolean
  created_at: string
}

interface DemoTicket {
  id: string
  number: number
  category: string
  subject: string
  status: Status
  priority: Priority
  plan_name: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  user_unread: boolean
  admin_unread: boolean
  messages: Message[]
}

export type TicketReply = { readonly ok: true; readonly body: unknown } | { readonly ok: false; readonly code: string }

const STATUSES: readonly Status[] = ['open', 'in_progress', 'waiting_user', 'resolved']
const PRIORITIES: readonly Priority[] = ['low', 'normal', 'high', 'urgent']
const CATEGORIES = ['problem', 'generation', 'billing', 'account', 'suggestion', 'other']
const DEMO_EMAIL = 'demo@kria.ia'

const now = () => new Date().toISOString()
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()
const id = () => crypto.randomUUID()

const tickets: DemoTicket[] = [
  {
    id: id(),
    number: 1,
    category: 'other',
    subject: 'Chamado de exemplo do modo demo',
    status: 'waiting_user',
    priority: 'normal',
    plan_name: 'Pro',
    created_at: hoursAgo(26),
    updated_at: hoursAgo(2),
    resolved_at: null,
    user_unread: true,
    admin_unread: false,
    messages: [
      { id: id(), author: 'user', body: 'Este chamado é só um exemplo para ver a conversa. Abra um novo para testar o fluxo inteiro.', internal: false, created_at: hoursAgo(26) },
      { id: id(), author: 'admin', body: 'Nota interna de exemplo: só a equipe vê.', internal: true, created_at: hoursAgo(3) },
      { id: id(), author: 'admin', body: 'Resposta de exemplo da equipe. Responder daqui reabre o chamado na fila.', internal: false, created_at: hoursAgo(2) },
    ],
  },
]

const ok = (body: unknown): TicketReply => ({ ok: true, body })
const fail = (code: string): TicketReply => ({ ok: false, code })
const text = (value: unknown) => String(value ?? '').trim()

function toJson(ticket: DemoTicket, forAdmin: boolean) {
  const { user_unread, admin_unread, messages, ...rest } = ticket
  return {
    ...rest,
    unread: forAdmin ? admin_unread : user_unread,
    messages: messages.filter((message) => forAdmin || !message.internal),
  }
}

function adminJson(ticket: DemoTicket) {
  return { ...toJson(ticket, true), email: DEMO_EMAIL, display_name: 'Conta demo', user_id: null, current_plan: ticket.plan_name }
}

function summary(ticket: DemoTicket, forAdmin: boolean) {
  const { messages, ...rest } = toJson(ticket, forAdmin)
  return forAdmin
    ? { ...rest, email: DEMO_EMAIL, display_name: 'Conta demo', messages_count: ticket.messages.filter((message) => !message.internal).length }
    : rest
}

const byUpdated = (a: DemoTicket, b: DemoTicket) => b.updated_at.localeCompare(a.updated_at)
const find = (body: Record<string, unknown>) => tickets.find((ticket) => ticket.id === body.p_id)

function openTicket(body: Record<string, unknown>, planName: string | null): TicketReply {
  const category = text(body.p_category)
  const subject = text(body.p_subject)
  const message = text(body.p_body)
  if (!CATEGORIES.includes(category)) return fail('invalid_category')
  if (subject.length < 5 || subject.length > 120) return fail('invalid_subject')
  if (message.length < 10 || message.length > 5000) return fail('invalid_body')
  if (tickets.filter((ticket) => ticket.status !== 'resolved').length >= 5) return fail('too_many_open_tickets')
  const created = now()
  const ticket: DemoTicket = {
    id: id(),
    number: Math.max(0, ...tickets.map((item) => item.number)) + 1,
    category,
    subject,
    status: 'open',
    priority: 'normal',
    plan_name: planName,
    created_at: created,
    updated_at: created,
    resolved_at: null,
    user_unread: false,
    admin_unread: true,
    messages: [{ id: id(), author: 'user', body: message, internal: false, created_at: created }],
  }
  tickets.push(ticket)
  return ok(ticket.id)
}

function userReply(body: Record<string, unknown>): TicketReply {
  const ticket = find(body)
  const message = text(body.p_body)
  if (!ticket) return fail('ticket_not_found')
  if (!message || message.length > 5000) return fail('invalid_body')
  ticket.messages.push({ id: id(), author: 'user', body: message, internal: false, created_at: now() })
  if (ticket.status === 'waiting_user' || ticket.status === 'resolved') ticket.status = 'open'
  Object.assign(ticket, { resolved_at: null, admin_unread: true, user_unread: false, updated_at: now() })
  return ok(toJson(ticket, false))
}

function adminReply(body: Record<string, unknown>): TicketReply {
  const ticket = find(body)
  const message = text(body.p_body)
  const internal = body.p_internal === true
  const status = body.p_status === null || body.p_status === undefined ? null : STATUSES.find((value) => value === body.p_status)
  if (!ticket) return fail('ticket_not_found')
  if (!message || message.length > 5000) return fail('invalid_body')
  if (status === undefined) return fail('invalid_status')
  ticket.messages.push({ id: id(), author: 'admin', body: message, internal, created_at: now() })
  ticket.status = status ?? (internal ? ticket.status : 'waiting_user')
  ticket.resolved_at = ticket.status === 'resolved' ? (ticket.resolved_at ?? now()) : null
  Object.assign(ticket, { user_unread: ticket.user_unread || !internal, admin_unread: false, updated_at: now() })
  return ok(adminJson(ticket))
}

function adminUpdate(body: Record<string, unknown>): TicketReply {
  const ticket = find(body)
  if (!ticket) return fail('ticket_not_found')
  if (body.p_status !== null) {
    const status = STATUSES.find((value) => value === body.p_status)
    if (!status) return fail('invalid_status')
    ticket.status = status
  }
  if (body.p_priority !== null) {
    const priority = PRIORITIES.find((value) => value === body.p_priority)
    if (!priority) return fail('invalid_priority')
    ticket.priority = priority
  }
  ticket.resolved_at = ticket.status === 'resolved' ? (ticket.resolved_at ?? now()) : null
  ticket.updated_at = now()
  return ok(adminJson(ticket))
}

const countOf = (status: Status) => tickets.filter((ticket) => ticket.status === status).length

/** Responde as funções de chamado; `null` quando o nome não é de chamado. */
export function demoSupportTickets(name: string, body: Record<string, unknown>, planName: string | null): TicketReply | null {
  switch (name) {
    case 'open_support_ticket':
      return openTicket(body, planName)
    case 'my_support_tickets':
      return ok([...tickets].sort(byUpdated).map((ticket) => summary(ticket, false)))
    case 'my_support_ticket': {
      const ticket = find(body)
      if (!ticket) return fail('ticket_not_found')
      ticket.user_unread = false
      return ok(toJson(ticket, false))
    }
    case 'reply_support_ticket':
      return userReply(body)
    case 'resolve_my_support_ticket': {
      const ticket = find(body)
      if (!ticket) return fail('ticket_not_found')
      Object.assign(ticket, { status: 'resolved', resolved_at: now(), updated_at: now() })
      return ok(toJson(ticket, false))
    }
    case 'admin_support_tickets':
      return ok({
        tickets: [...tickets].sort(byUpdated).map((ticket) => summary(ticket, true)),
        counts: {
          open: countOf('open'),
          in_progress: countOf('in_progress'),
          waiting_user: countOf('waiting_user'),
          resolved: countOf('resolved'),
          unread: tickets.filter((ticket) => ticket.admin_unread).length,
        },
      })
    case 'admin_support_attention':
      return ok(tickets.filter((ticket) => ticket.admin_unread || ticket.status === 'open').length)
    case 'admin_support_ticket': {
      const ticket = find(body)
      if (!ticket) return fail('ticket_not_found')
      ticket.admin_unread = false
      return ok(adminJson(ticket))
    }
    case 'admin_reply_support_ticket':
      return adminReply(body)
    case 'admin_update_support_ticket':
      return adminUpdate(body)
    default:
      return null
  }
}
