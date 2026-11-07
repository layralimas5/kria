import { describe, expect, it } from 'vitest'
import { frameTimes } from './compositor'

describe('frameTimes', () => {
  it('30 quadros por segundo, sem pular nem repetir na emenda entre cenas', () => {
    const first = frameTimes(0, 3.5)
    const second = frameTimes(3.5, 7)
    expect(first).toHaveLength(105)
    expect(second).toHaveLength(105)
    expect(first.at(-1)).toBeLessThan(second[0]!)
    expect(second[0]).toBeCloseTo(3.5)
  })

  it('o total bate com a duração do vídeo', () => {
    const scenes = [frameTimes(0, 4), frameTimes(4, 7), frameTimes(7, 9.5)]
    expect(scenes.flat()).toHaveLength(Math.round(9.5 * 30))
  })
})
