import { describe, expect, it } from 'vitest'
import { DEFAULT_QUEUE_FILTERS, filterQueue, ticketCode, validateDraft, type AdminTicketRow } from './supportTickets'

function row(overrides: Partial<AdminTicketRow>): AdminTicketRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    number: 1,
    category: 'problem',
    subject: 'Foto não terminou',
    status: 'open',
    priority: 'normal',
    plan_name: 'Pro',
    created_at: '2026-11-20T10:00:00Z',
    updated_at: '2026-11-20T10:00:00Z',
    resolved_at: null,
    unread: false,
    email: 'ana@x.com',
    display_name: 'Ana',
    messages_count: 1,
    ...overrides,
  }
}

describe('validateDraft', () => {
  it('pede assunto, título e descrição com o mínimo do banco', () => {
    expect(validateDraft({ category: '', subject: 'Oi', body: 'curto' })).toEqual({
      category: expect.any(String),
      subject: expect.any(String),
      body: expect.any(String),
    })
  })

  it('ignora espaços nas pontas e aceita o rascunho completo', () => {
    expect(validateDraft({ category: 'billing', subject: '  Pix não caiu  ', body: 'Paguei ontem e o plano não mudou.' })).toEqual({})
    expect(validateDraft({ category: 'billing', subject: '   ab   ', body: 'Paguei ontem e o plano não mudou.' }).subject).toBeDefined()
  })
})

describe('filterQueue', () => {
  const rows = [
    row({ id: 'a', number: 1, status: 'resolved' }),
    row({ id: 'b', number: 2, priority: 'low', updated_at: '2026-11-19T10:00:00Z' }),
    row({ id: 'c', number: 3, priority: 'urgent', updated_at: '2026-11-21T10:00:00Z' }),
    row({ id: 'd', number: 4, unread: true, priority: 'low', email: 'bia@x.com' }),
  ]

  it('ativos escondem os resolvidos; não lidos e urgentes sobem', () => {
    expect(filterQueue(rows, DEFAULT_QUEUE_FILTERS).map((item) => item.number)).toEqual([4, 3, 2])
  })

  it('filtra por situação, prioridade e busca por número ou e-mail', () => {
    expect(filterQueue(rows, { ...DEFAULT_QUEUE_FILTERS, status: 'resolved' }).map((item) => item.number)).toEqual([1])
    expect(filterQueue(rows, { ...DEFAULT_QUEUE_FILTERS, priority: 'low' }).map((item) => item.number)).toEqual([4, 2])
    expect(filterQueue(rows, { ...DEFAULT_QUEUE_FILTERS, search: '#3' }).map((item) => item.number)).toEqual([3])
    expect(filterQueue(rows, { ...DEFAULT_QUEUE_FILTERS, status: 'all', search: 'BIA@' }).map((item) => item.number)).toEqual([4])
  })

  it('código curto do chamado', () => {
    expect(ticketCode({ number: 42 })).toBe('#42')
  })
})
