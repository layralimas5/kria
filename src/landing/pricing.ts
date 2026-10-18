import { COSTS, type CreditPack } from './content'

export interface PackYield {
  readonly photos: number
  readonly shortVideos: number
  readonly talkingVideos: number
}

export function packYield(credits: number): PackYield {
  return {
    photos: Math.floor(credits / COSTS.photo),
    shortVideos: Math.floor(credits / COSTS.videoShort),
    talkingVideos: Math.floor(credits / COSTS.videoTalking),
  }
}

export function centsPerCredit(pack: CreditPack): number {
  return pack.priceCents / pack.credits
}

/** Quanto o crédito sai mais barato que no pacote de referência, em % inteiro (0 se não for mais barato). */
export function savingsPercent(pack: CreditPack, reference: CreditPack): number {
  const saving = 1 - centsPerCredit(pack) / centsPerCredit(reference)
  return Math.max(0, Math.round(saving * 100))
}

/** Menor preço possível, em centavos, de algo que custa `credits` créditos. */
export function lowestPriceCents(packs: readonly CreditPack[], credits: number): number {
  if (packs.length === 0) throw new Error('Nenhum pacote de créditos cadastrado')
  const cheapestPerCredit = Math.min(...packs.map(centsPerCredit))
  return Math.round(cheapestPerCredit * credits)
}
