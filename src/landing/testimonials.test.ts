import { describe, expect, it, vi } from 'vitest'
import { parseTestimonials } from './testimonials'

const real = {
  id: 'ana',
  author: 'Ana',
  consent: true,
  messages: [{ from: 'cliente', time: '19:30', text: 'Fiz meu primeiro vídeo' }],
}

describe('parseTestimonials', () => {
  it('aceita depoimento autorizado no formato certo', () => {
    expect(parseTestimonials([real])).toHaveLength(1)
  })

  it('descarta quem não autorizou e mídia fora da pasta de depoimentos', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const unauthorized = { ...real, id: 'b', consent: false }
    const foreignMedia = { ...real, id: 'c', messages: [{ from: 'cliente', time: '10:00', video: 'https://outro-site.com/v.mp4' }] }
    expect(parseTestimonials([unauthorized, foreignMedia])).toEqual([])
  })
})
