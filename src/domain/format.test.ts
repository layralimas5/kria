import { describe, expect, it } from 'vitest'
import { aspectOptionOf, formatCredits, generationRatio, modelSpecs, ratioLabel } from './format'

describe('modelSpecs', () => {
  it('mostra formato, duração e áudio', () => {
    expect(modelSpecs({ duration: '8s', aspect_ratio: '9:16', generate_audio: true })).toEqual(['9:16', '8s', 'Áudio'])
  })

  it('normaliza duração sem unidade', () => {
    expect(modelSpecs({ duration: '5' })).toEqual(['5s'])
  })

  it('ignora formato automático e campos internos', () => {
    expect(modelSpecs({ aspect_ratio: 'auto', num_images: 1, safety_tolerance: '2' })).toEqual([])
  })
})

describe('formatCredits', () => {
  it('usa singular e plural', () => {
    expect(formatCredits(1)).toBe('1 crédito')
    expect(formatCredits(40)).toBe('40 créditos')
  })
})

describe('formato por image_size (FLUX e Ideogram)', () => {
  it('acha o campo que escolhe o formato', () => {
    expect(aspectOptionOf({ aspect_ratio: ['4:5', '1:1'] })).toBe('aspect_ratio')
    expect(aspectOptionOf({ image_size: ['portrait_4_3', 'square_hd'] })).toBe('image_size')
    expect(aspectOptionOf({})).toBeNull()
  })

  it('mostra o enum do fal como proporção', () => {
    expect(ratioLabel('image_size', 'portrait_16_9')).toBe('9:16')
    expect(ratioLabel('aspect_ratio', '4:5')).toBe('4:5')
    expect(generationRatio({ image_size: 'landscape_16_9' })).toBe('16:9')
    expect(generationRatio({ aspect_ratio: '1:1' })).toBe('1:1')
    expect(generationRatio({})).toBeNull()
  })
})
