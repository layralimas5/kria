import { describe, expect, it } from 'vitest'
import { parsePrices, pricingUrl } from './falPricing'

describe('API de preço do fal', () => {
  it('monta uma consulta só, sem repetir endpoint', () => {
    expect(pricingUrl(['fal-ai/nano-banana-2', 'fal-ai/nano-banana-2/edit', 'fal-ai/nano-banana-2'])).toBe(
      'https://api.fal.ai/v1/models/pricing?endpoint_id=fal-ai%2Fnano-banana-2,fal-ai%2Fnano-banana-2%2Fedit',
    )
  })

  it('lê os preços e descarta o que vem fora do formato', () => {
    const body = {
      prices: [
        { endpoint_id: 'fal-ai/nano-banana-2', unit_price: 0.08, unit: 'image', currency: 'USD' },
        { endpoint_id: 'fal-ai/veo3.1/image-to-video', unit_price: '0.4', unit: 'second', currency: 'USD' },
        null,
      ],
      has_more: false,
    }
    expect(parsePrices(body)).toEqual([{ endpoint_id: 'fal-ai/nano-banana-2', unit_price: 0.08, unit: 'image', currency: 'USD' }])
    expect(parsePrices({ detail: 'unauthorized' })).toEqual([])
  })
})
