import { COSTS, type CreditPack } from './content'

export interface PackYield {
  readonly photos: number
  readonly shortVideos: number
}

export function packYield(pack: CreditPack): PackYield {
  return {
    photos: Math.floor(pack.credits / COSTS.photo),
    shortVideos: Math.floor(pack.credits / COSTS.videoShort),
  }
}

/** Menor preço possível, em centavos, de algo que custa `credits` créditos. */
export function lowestPriceCents(packs: readonly CreditPack[], credits: number): number {
  if (packs.length === 0) throw new Error('Nenhum pacote de créditos cadastrado')
  const cheapestPerCredit = Math.min(...packs.map((pack) => pack.priceCents / pack.credits))
  return Math.round(cheapestPerCredit * credits)
}
