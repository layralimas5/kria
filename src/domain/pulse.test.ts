import { describe, expect, it } from 'vitest'
import type { FinancialSummary } from './commandCenter'
import { greeting, pulseVerdict } from './pulse'

/** O formato de moeda separa "R$" do número com espaço fixo. */
const text = (value: Parameters<typeof pulseVerdict>[0]) => pulseVerdict(value).text.replace(/\u00a0/g, ' ')

const summary = (patch: Partial<FinancialSummary> = {}): FinancialSummary => ({
  grossCents: 100_000,
  refundsCents: 0,
  feesCents: 5_000,
  netCents: 95_000,
  aiCostCents: 20_000,
  otherCostsCents: 10_000,
  totalCostsCents: 35_000,
  profitCents: 65_000,
  profitMargin: 0.65,
  contributionCents: 75_000,
  contributionMargin: 0.75,
  grossChange: 0.2,
  netChange: 0.2,
  lifetimeNetCents: 500_000,
  monthReceivedCents: 80_000,
  projectedNextMonthCents: 90_000,
  atRiskCents: 0,
  ...patch,
})

describe('leitura do período', () => {
  it('lucro com margem e crescimento', () => {
    expect(pulseVerdict(summary()).tone).toBe('good')
    expect(text(summary())).toBe('Lucro de R$ 650 no período, margem de 65%. Receita subiu 20% contra o período anterior.')
  })

  it('prejuízo diz quanto e por quê', () => {
    expect(pulseVerdict(summary({ profitCents: -12_000, grossChange: -0.3 })).tone).toBe('bad')
    expect(text(summary({ profitCents: -12_000, grossChange: -0.3 }))).toBe('Prejuízo de R$ 120 no período: os custos passaram a receita. Receita caiu 30% contra o período anterior.')
  })

  it('variação pequena ou sem base não vira manchete', () => {
    expect(text(summary({ grossChange: 0.02 }))).toBe('Lucro de R$ 650 no período, margem de 65%.')
    expect(text(summary({ grossChange: null }))).toBe('Lucro de R$ 650 no período, margem de 65%.')
  })

  it('sem movimento ou sem acesso ao dinheiro fica neutro', () => {
    expect(pulseVerdict(summary({ grossCents: 0, totalCostsCents: 0 })).tone).toBe('neutral')
    expect(pulseVerdict(null).tone).toBe('neutral')
  })
})

describe('saudação', () => {
  it('segue a hora de Brasília', () => {
    expect(greeting(new Date('2026-11-10T12:00:00Z'))).toBe('Bom dia') // 09:00
    expect(greeting(new Date('2026-11-10T18:00:00Z'))).toBe('Boa tarde') // 15:00
    expect(greeting(new Date('2026-11-10T23:30:00Z'))).toBe('Boa noite') // 20:30
    expect(greeting(new Date('2026-11-10T05:00:00Z'))).toBe('Boa noite') // 02:00
  })
})
