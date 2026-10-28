import { describe, expect, it } from 'vitest'
import { SHOWCASE, showcase, showcaseByPrefix, toShowcaseImage } from './showcase'
import specs from './showcase.json'

const SPEC = { id: 'teste', title: 'Teste', category: 'Produto', aspect: '1:1', prompt: 'foto' }

describe('toShowcaseImage', () => {
  it('fica sem mídia enquanto a foto não foi gerada', () => {
    expect(toShowcaseImage(SPEC, undefined).media).toBeNull()
  })

  it('recusa proporção que a landing não usa', () => {
    expect(() => toShowcaseImage({ ...SPEC, aspect: '21:9' }, undefined)).toThrow()
  })
})

describe('showcase.json', () => {
  it('tem ids únicos', () => {
    const ids = specs.map((spec) => spec.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('só referencia imagens que saem do zero', () => {
    for (const spec of specs) {
      if (!('ref' in spec)) continue
      const base = specs.find((other) => other.id === spec.ref)
      expect(base, `${spec.id} → ${spec.ref}`).toBeDefined()
      expect(base && 'ref' in base, `${spec.ref} também tem ref`).toBe(false)
    }
  })

  it('tem as fotos que as seções pedem', () => {
    for (const id of ['hero-criadora', 'hero-imovel', 'hero-produto', 'bento-cidade', 'marina', 'formato-antes', 'formato-depois']) {
      expect(showcase(id).id).toBe(id)
    }
    expect(showcaseByPrefix('marina-')).toHaveLength(6)
    expect(showcaseByPrefix('g-').length).toBeGreaterThanOrEqual(8)
    expect(SHOWCASE).toHaveLength(specs.length)
  })
})
