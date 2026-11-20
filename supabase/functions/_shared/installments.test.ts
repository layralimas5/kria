import { describe, expect, it } from 'vitest'
import { installmentOption, installmentTable } from './installments.ts'

describe('installmentOption', () => {
  it('à vista não tem juros', () => {
    expect(installmentOption(4700, 1, 0.0299)).toEqual({ count: 1, installmentCents: 4700, totalCents: 4700, interestFree: true })
  })

  it('parcela pela tabela Price, arredondada para cima, e o total é parcela vezes vezes', () => {
    // R$ 100 em 3x a 2,99% a.m.: 35,346... vira 35,35; total 106,05.
    const option = installmentOption(10000, 3, 0.0299)
    expect(option.installmentCents).toBe(3535)
    expect(option.totalCents).toBe(10605)
    expect(option.interestFree).toBe(false)
  })

  it('juro zero divide sem acréscimo', () => {
    expect(installmentOption(10000, 3, 0)).toEqual({ count: 3, installmentCents: 3334, totalCents: 10000, interestFree: true })
  })

  it('recusa valor e parcelas fora da faixa', () => {
    expect(() => installmentOption(0, 1, 0)).toThrow()
    expect(() => installmentOption(1000, 13, 0)).toThrow()
  })
})

describe('installmentTable', () => {
  it('para quando a parcela ficaria abaixo de R$ 5', () => {
    const table = installmentTable(2990, 12, 0.0299)
    expect(table.at(-1)!.installmentCents).toBeGreaterThanOrEqual(500)
    expect(table.length).toBeLessThan(12)
    expect(table[0]!.count).toBe(1)
  })

  it('respeita o máximo de parcelas do produto', () => {
    expect(installmentTable(100000, 6, 0.0299)).toHaveLength(6)
  })
})
