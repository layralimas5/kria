import { describe, expect, it } from 'vitest'
import { normalizeAnalysis, normalizeScript, scriptDuration, type TakeInfo } from './multiplierScript'

const TAKES: TakeInfo[] = [
  { id: 'a', name: 'abrindo.mp4', kind: 'video', duration: 10, note: 'abrindo a caixa' },
  { id: 'b', name: 'produto.jpg', kind: 'image', duration: 3, note: '' },
]

const base = { angle: 'Dor', hook: 'Pele sem viço?', cta: 'Link na bio', caption: 'Legenda' }

describe('normalizeScript', () => {
  it('mantém um roteiro válido', () => {
    const script = normalizeScript({ ...base, beats: [{ take: 1, start: 2, duration: 3, text: 'Abre a caixa' }] }, TAKES)
    expect(script).toEqual({ ...base, beats: [{ take: 1, start: 2, duration: 3, text: 'Abre a caixa' }] })
  })

  it('encaixa a cena dentro do take e entre 1 e 8 segundos', () => {
    const script = normalizeScript({ ...base, beats: [{ take: 1, start: 9.5, duration: 6, text: 'fim' }, { take: 1, start: -3, duration: 30, text: '' }] }, TAKES)
    expect(script?.beats).toEqual([
      { take: 1, start: 9, duration: 1, text: 'fim' },
      { take: 1, start: 0, duration: 8, text: '' },
    ])
  })

  it('foto sempre começa do zero e aceita até 8 segundos', () => {
    const script = normalizeScript({ ...base, beats: [{ take: 2, start: 5, duration: 12, text: 'produto' }] }, TAKES)
    expect(script?.beats).toEqual([{ take: 2, start: 0, duration: 8, text: 'produto' }])
  })

  it('descarta cena de take inexistente e recusa roteiro sem cena ou sem gancho', () => {
    expect(normalizeScript({ ...base, beats: [{ take: 3, start: 0, duration: 2, text: 'x' }] }, TAKES)).toBeNull()
    expect(normalizeScript({ ...base, hook: '  ', beats: [{ take: 1, duration: 2 }] }, TAKES)).toBeNull()
    expect(normalizeScript('texto solto', TAKES)).toBeNull()
  })

  it('corta no limite de 60 segundos e de 8 cenas', () => {
    const beats = Array.from({ length: 12 }, () => ({ take: 2, duration: 8, text: 'x' }))
    const script = normalizeScript({ ...base, beats }, TAKES)
    expect(script?.beats).toHaveLength(7)
    expect(scriptDuration(script!)).toBe(56)
  })

  it('limpa espaços e corta textos longos', () => {
    const script = normalizeScript({ ...base, angle: '', hook: `  ${'a'.repeat(200)} `, beats: [{ take: 1, duration: 2, text: 'linha\n\nquebrada' }] }, TAKES)
    expect(script?.angle).toBe('Variação')
    expect(script?.hook).toHaveLength(90)
    expect(script?.beats[0]?.text).toBe('linha quebrada')
  })
})

describe('normalizeAnalysis', () => {
  it('guarda só listas de texto, com teto', () => {
    expect(normalizeAnalysis({ benefits: ['leve', 3, ''], limitations: 'x', opportunities: Array(10).fill('o') })).toEqual({
      benefits: ['leve'],
      limitations: [],
      opportunities: ['o', 'o', 'o', 'o', 'o', 'o'],
    })
    expect(normalizeAnalysis(null)).toEqual({ benefits: [], limitations: [], opportunities: [] })
  })
})
