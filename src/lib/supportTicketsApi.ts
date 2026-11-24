import { z } from 'zod'
import {
  adminQueueSchema,
  adminTicketSchema,
  ticketSchema,
  ticketSummarySchema,
  type AdminQueue,
  type AdminTicket,
  type Ticket,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  type TicketSummary,
} from '@/domain/supportTickets'
import { ApiError } from './api'
import { supabase } from './supabase'

// Chamados (0042): tudo por função do banco; as tabelas não abrem para o cliente.

const TICKET_ERRORS: Record<string, string> = {
  invalid_category: 'Escolha o assunto do chamado.',
  invalid_subject: 'O título precisa ter de 5 a 120 letras.',
  invalid_body: 'Escreva a mensagem (até 5.000 letras).',
  too_many_open_tickets: 'Você já tem 5 chamados em aberto. Responda ou encerre um deles antes de abrir outro.',
  too_many_tickets_today: 'Você abriu muitos chamados hoje. Responda em um deles que a gente vê.',
  ticket_not_found: 'Chamado não encontrado.',
  invalid_status: 'Situação inválida.',
  invalid_priority: 'Prioridade inválida.',
  forbidden: 'Você não tem acesso aos chamados.',
  mfa_required: 'Confirme o segundo fator para continuar.',
  not_authenticated: 'Sua sessão expirou. Entre de novo.',
}

async function call<T>(name: string, args: Record<string, unknown>, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    const known = TICKET_ERRORS[error.message]
    if (known) throw new ApiError(error.message, known)
    console.error(name, error)
    throw new ApiError('support_failed', 'Não deu para concluir agora. Tente de novo em instantes.')
  }
  return schema.parse(data)
}

// ---------------------------------------------------------------- pessoa

export const fetchMyTickets = (): Promise<TicketSummary[]> => call('my_support_tickets', {}, z.array(ticketSummarySchema))

export const fetchMyTicket = (id: string): Promise<Ticket> => call('my_support_ticket', { p_id: id }, ticketSchema)

export const openTicket = (category: TicketCategory, subject: string, body: string): Promise<string> =>
  call('open_support_ticket', { p_category: category, p_subject: subject.trim(), p_body: body.trim() }, z.string().uuid())

export const replyToTicket = (id: string, body: string): Promise<Ticket> =>
  call('reply_support_ticket', { p_id: id, p_body: body.trim() }, ticketSchema)

export const resolveMyTicket = (id: string): Promise<Ticket> => call('resolve_my_support_ticket', { p_id: id }, ticketSchema)

// ---------------------------------------------------------------- admin

export const fetchAdminQueue = (): Promise<AdminQueue> => call('admin_support_tickets', {}, adminQueueSchema)

export const fetchSupportAttention = (): Promise<number> => call('admin_support_attention', {}, z.number().int())

export const fetchAdminTicket = (id: string): Promise<AdminTicket> => call('admin_support_ticket', { p_id: id }, adminTicketSchema)

export const adminReply = (id: string, body: string, internal: boolean, status: TicketStatus | null): Promise<AdminTicket> =>
  call('admin_reply_support_ticket', { p_id: id, p_body: body.trim(), p_internal: internal, p_status: status }, adminTicketSchema)

export const adminUpdateTicket = (id: string, change: { readonly status?: TicketStatus; readonly priority?: TicketPriority }): Promise<AdminTicket> =>
  call('admin_update_support_ticket', { p_id: id, p_status: change.status ?? null, p_priority: change.priority ?? null }, adminTicketSchema)
