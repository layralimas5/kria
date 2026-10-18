import { describe, expect, it } from 'vitest'
import { COSTS, CREDIT_PACKS } from './content'
import { lowestPriceCents, packYield } from './pricing'

describe('packYield', () => {
  it('converte créditos em fotos e vídeos curtos, arredondando pra baixo', () => {
    expect(packYield({ id: 'x', name: 'X', credits: 100, priceCents: 1990, highlight: false })).toEqual({ photos: 20, shortVideos: 2 })
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
