import { describe, expect, it } from 'vitest'
import { formatCredits, modelSpecs } from './format'

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
