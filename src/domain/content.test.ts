import { describe, expect, it } from 'vitest'
import { addDays, monthGrid, neighborStatus, toIsoDate } from './content'

describe('neighborStatus', () => {
  it('anda um passo no fluxo e para nas pontas', () => {
    expect(neighborStatus('idea', 1)).toBe('planned')
    expect(neighborStatus('review', -1)).toBe('producing')
    expect(neighborStatus('idea', -1)).toBeNull()
    expect(neighborStatus('published', 1)).toBeNull()
  })
})

describe('datas do calendário', () => {
  it('soma dias atravessando o mês sem o fuso mudar a data', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('outubro de 2026 começa na quinta e cabe em 5 semanas de domingo a sábado', () => {
    const weeks = monthGrid(2026, 9)
    expect(weeks).toHaveLength(5)
    expect(weeks[0]?.[0]).toEqual({ date: '2026-09-27', inMonth: false })
    expect(weeks[0]?.[4]).toEqual({ date: '2026-10-01', inMonth: true })
    expect(weeks.flat().filter((day) => day.inMonth)).toHaveLength(31)
  })
})
