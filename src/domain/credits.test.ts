import { describe, expect, it } from 'vitest'
import { filterLedger, monthSummary, packSavings, pricePerCredit, yieldByModel } from './credits'
import type { LedgerEntry } from './types'

const NOW = new Date('2026-11-10T15:00:00Z')

const entry = (delta: number, reason: LedgerEntry['reason'], created_at = '2026-11-05T12:00:00Z'): LedgerEntry => ({
  id: Math.floor(Math.random() * 1e9),
  delta,
  reason,
  note: null,
  balance_after: null,
  created_at,
})

describe('extrato', () => {
  const entries = [entry(2300, 'subscription_grant'), entry(-5, 'generation'), entry(-40, 'generation'), entry(40, 'generation_refund'), entry(500, 'purchase', '2026-10-31T12:00:00Z')]

  it('filtra entradas e saídas', () => {
    expect(filterLedger(entries, 'in')).toHaveLength(3)
    expect(filterLedger(entries, 'out')).toHaveLength(2)
    expect(filterLedger(entries, 'all')).toHaveLength(5)
  })

  it('resume o mês de Brasília com o estorno descontado do gasto', () => {
    expect(monthSummary(entries, NOW)).toEqual({ received: 2300, spent: 5, refunded: 40, generations: 2 })
  })

  it('compra feita às 22h do dia 31 em Brasília fica em outubro', () => {
    expect(monthSummary([entry(500, 'purchase', '2026-11-01T01:00:00Z')], NOW).received).toBe(0)
  })
})

describe('rendimento e pacotes', () => {
  const models = [
    { slug: 'foto', name: 'Nano Banana 2', kind: 'image' as const, credits: 5, studio: true },
    { slug: 'video-kling', name: 'Kling 3.0', kind: 'video' as const, credits: 40, studio: true },
    { slug: 'foto-edicao', name: 'Edição', kind: 'image' as const, credits: 6, studio: false },
  ]

  it('mostra só modelos do Studio, do que rende mais para o que rende menos', () => {
    expect(yieldByModel(100, models).map((item) => [item.slug, item.count])).toEqual([
      ['foto', 20],
      ['video-kling', 2],
    ])
  })

  it('formata o preço por crédito', () => {
    expect(pricePerCredit({ price_cents: 2990, credits: 100 })).toBe('R$ 0,30')
    expect(pricePerCredit({ price_cents: 13990, credits: 5000 })).toBe('R$ 0,028')
  })

  it('calcula a economia contra o pacote mais caro por crédito', () => {
    const packs = [
      { price_cents: 1000, credits: 100 },
      { price_cents: 4000, credits: 500 },
    ]
    expect(packSavings(packs[0]!, packs)).toBe(0)
    expect(packSavings(packs[1]!, packs)).toBe(20)
  })
})
