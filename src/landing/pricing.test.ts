import { describe, expect, it } from 'vitest'
import { COSTS, CREDIT_PACKS, type CreditPack } from './content'
import { lowestPriceCents, packYield, savingsPercent } from './pricing'

const pack = (credits: number, priceCents: number): CreditPack => ({ id: 'x', name: 'X', credits, priceCents, highlight: false })

describe('packYield', () => {
  it('converte créditos em fotos e vídeos, arredondando pra baixo', () => {
    expect(packYield(300)).toEqual({ photos: 60, shortVideos: 7, talkingVideos: 1 })
    expect(packYield(20)).toEqual({ photos: 4, shortVideos: 0, talkingVideos: 0 })
  })
})

describe('savingsPercent', () => {
  it('compara o preço do crédito com o pacote de referência', () => {
    expect(savingsPercent(pack(800, 11990), pack(100, 1990))).toBe(25)
    expect(savingsPercent(pack(300, 4990), pack(100, 1990))).toBe(16)
  })

  it('nunca devolve economia negativa', () => {
    expect(savingsPercent(pack(100, 3000), pack(100, 1990))).toBe(0)
  })
})

describe('lowestPriceCents', () => {
  it('usa o pacote com o crédito mais barato', () => {
    expect(lowestPriceCents(CREDIT_PACKS, COSTS.photo)).toBe(75)
    expect(lowestPriceCents(CREDIT_PACKS, COSTS.videoShort)).toBe(600)
  })

  it('recusa lista vazia em vez de devolver Infinity', () => {
    expect(() => lowestPriceCents([], COSTS.photo)).toThrow()
  })
})
