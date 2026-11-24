import { z } from 'zod'

// Chamados de suporte (0042): a pessoa abre e conversa; a operação atende em /admin/chamados.

export const TICKET_CATEGORIES = ['problem', 'generation', 'billing', 'account', 'suggestion', 'other'] as const
export type TicketCategory = (typeof TICKET_CATEGORIES)[number]

export const TICKET_STATUSES = ['open', 'in_progress', 'waiting_user', 'resolved'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

/** Da mais urgente para a menos: é a ordem do filtro e o desempate da fila. */
export const TICKET_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  problem: 'Algo não funciona',
  generation: 'Geração de foto ou vídeo',
  billing: 'Pagamento e créditos',
  account: 'Conta e acesso',
  suggestion: 'Sugestão',
  other: 'Outro assunto',
}

/** Como a pessoa lê a situação do próprio chamado. */
export const USER_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Na fila',
  in_progress: 'Em atendimento',
  waiting_user: 'Respondido',
  resolved: 'Resolvido',
}

/** Como a operação lê a mesma situação. */
export const ADMIN_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Novo',
  in_progress: 'Em atendimento',
  waiting_user: 'Aguardando usuário',
  resolved: 'Resolvido',
}

export const PRIORITY_LABEL: Record<TicketPriority, string> = { urgent: 'Urgente', high: 'Alta', normal: 'Normal', low: 'Baixa' }

export const SUBJECT_LIMITS = { min: 5, max: 120 } as const
export const BODY_LIMITS = { min: 10, max: 5000 } as const

const messageSchema = z.object({
  id: z.string().uuid(),
  author: z.enum(['user', 'admin']),
  body: z.string(),
  internal: z.boolean(),
  created_at: z.string(),
})
export type TicketMessage = z.infer<typeof messageSchema>

const ticketBase = {
  id: z.string().uuid(),
  number: z.number().int(),
  category: z.enum(TICKET_CATEGORIES),
  subject: z.string(),
  status: z.enum(TICKET_STATUSES),
  priority: z.enum(TICKET_PRIORITIES),
  plan_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().nullable(),
  unread: z.boolean(),
}

export const ticketSummarySchema = z.object(ticketBase)
export type TicketSummary = z.infer<typeof ticketSummarySchema>

export const ticketSchema = z.object({ ...ticketBase, messages: z.array(messageSchema) })
export type Ticket = z.infer<typeof ticketSchema>

const requester = {
  email: z.string().nullable(),
  display_name: z.string().nullable(),
}

export const adminTicketRowSchema = z.object({ ...ticketBase, ...requester, messages_count: z.number().int() })
export type AdminTicketRow = z.infer<typeof adminTicketRowSchema>

export const adminQueueSchema = z.object({
  tickets: z.array(adminTicketRowSchema),
  counts: z.object({
    open: z.number().int(),
    in_progress: z.number().int(),
    waiting_user: z.number().int(),
    resolved: z.number().int(),
    unread: z.number().int(),
  }),
})
export type AdminQueue = z.infer<typeof adminQueueSchema>

export const adminTicketSchema = ticketSchema.extend({
  ...requester,
  user_id: z.string().uuid().nullable(),
  current_plan: z.string().nullable(),
})
export type AdminTicket = z.infer<typeof adminTicketSchema>

export interface TicketDraft {
  readonly category: TicketCategory | ''
  readonly subject: string
  readonly body: string
}

export type DraftErrors = Partial<Record<keyof TicketDraft, string>>

/** Mesmas regras do banco (`open_support_ticket`), para avisar antes de enviar. */
export function validateDraft(draft: TicketDraft): DraftErrors {
  const errors: DraftErrors = {}
  if (!draft.category) errors.category = 'Escolha o assunto.'
  const subject = draft.subject.trim().length
  if (subject < SUBJECT_LIMITS.min) errors.subject = `Escreva um título com pelo menos ${SUBJECT_LIMITS.min} letras.`
  else if (subject > SUBJECT_LIMITS.max) errors.subject = `O título passa de ${SUBJECT_LIMITS.max} letras.`
  const body = draft.body.trim().length
  if (body < BODY_LIMITS.min) errors.body = 'Conte o que aconteceu com um pouco mais de detalhe.'
  else if (body > BODY_LIMITS.max) errors.body = `A descrição passa de ${BODY_LIMITS.max} letras.`
  return errors
}

export interface QueueFilters {
  readonly status: TicketStatus | 'active' | 'all'
  readonly priority: TicketPriority | 'all'
  readonly search: string
}

export const DEFAULT_QUEUE_FILTERS: QueueFilters = { status: 'active', priority: 'all', search: '' }

const PRIORITY_RANK: Record<TicketPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 }

function matchesSearch(row: AdminTicketRow, search: string): boolean {
  const term = search.trim().toLowerCase().replace(/^#/, '')
  if (!term) return true
  return [String(row.number), row.subject, row.email ?? '', row.display_name ?? ''].some((value) => value.toLowerCase().includes(term))
}

/**
 * Fila da operação: "ativos" esconde os resolvidos. Ordem: não lidos primeiro, depois prioridade,
 * depois o mais antigo sem resposta (quem espera há mais tempo é atendido antes).
 */
export function filterQueue(rows: readonly AdminTicketRow[], filters: QueueFilters): AdminTicketRow[] {
  return rows
    .filter((row) => {
      if (filters.status === 'active' && row.status === 'resolved') return false
      if (filters.status !== 'active' && filters.status !== 'all' && row.status !== filters.status) return false
      if (filters.priority !== 'all' && row.priority !== filters.priority) return false
      return matchesSearch(row, filters.search)
    })
    .sort(
      (a, b) =>
        Number(b.unread) - Number(a.unread) ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        a.updated_at.localeCompare(b.updated_at),
    )
}

/** "#42". */
export const ticketCode = (ticket: { readonly number: number }): string => `#${ticket.number}`
