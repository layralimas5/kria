import { describe, expect, it } from 'vitest'
import { checkPrompt } from '../../supabase/functions/_shared/generation'
import {
  buildPersonaPrompt,
  countSelected,
  PERSONA_PROMPT_PREFIX,
  PERSONA_TRAIT_GROUPS,
  randomTraits,
  summarizeTraits,
  toggleTrait,
  type TraitGroup,
} from './personaTraits'

const group = (id: string) => PERSONA_TRAIT_GROUPS.find((item) => item.id === id) as TraitGroup

describe('buildPersonaPrompt', () => {
  it('monta o retrato com as escolhas', () => {
    const prompt = buildPersonaPrompt({
      gender: ['feminino'],
      age: ['26'],
      ethnicity: ['parda'],
      hairstyle: ['trancas'],
      hairColor: ['mel'],
      eyeColor: ['verde'],
      features: ['sardas', 'oculos'],
    })
    expect(prompt.startsWith(PERSONA_PROMPT_PREFIX)).toBe(true)
    expect(prompt).toContain('adult around 29 years old mixed-race Brazilian woman')
    expect(prompt).toContain('honey blonde box braids')
    expect(prompt).toContain('green eyes')
    expect(prompt).toContain('freckles, stylish glasses')
    expect(prompt).toContain('plain neutral studio background')
  })

  it('funciona sem nenhuma escolha', () => {
    expect(buildPersonaPrompt({})).toContain(`${PERSONA_PROMPT_PREFIX}: person.`)
  })

  it('careca ignora a cor do cabelo', () => {
    expect(buildPersonaPrompt({ hairstyle: ['careca'], hairColor: ['rosa'] })).not.toContain('pastel pink')
  })

  it('acrescenta o texto livre no fim', () => {
    expect(buildPersonaPrompt({}, 'colar dourado')).toMatch(/Extra details: colar dourado\.$/)
  })

  it('nenhuma combinação sorteada esbarra no filtro do servidor', () => {
    let seed = 1
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (let i = 0; i < 300; i += 1) {
      const prompt = buildPersonaPrompt(randomTraits(random))
      expect(checkPrompt(prompt).ok, prompt).toBe(true)
      expect(prompt.length).toBeLessThan(2000)
    }
  })

  it('todas as opções juntas também passam no filtro', () => {
    for (const traitGroup of PERSONA_TRAIT_GROUPS) {
      for (const option of traitGroup.options) {
        expect(checkPrompt(buildPersonaPrompt({ [traitGroup.id]: [option.value] })).ok, option.value).toBe(true)
      }
    }
  })
})

describe('toggleTrait', () => {
  it('escolha única troca o valor e desmarca no segundo clique', () => {
    const once = toggleTrait({}, group('gender'), 'feminino')
    expect(once.gender).toEqual(['feminino'])
    expect(toggleTrait(once, group('gender'), 'masculino').gender).toEqual(['masculino'])
    expect(toggleTrait(once, group('gender'), 'feminino').gender).toEqual([])
  })

  it('grupo múltiplo acumula', () => {
    const selection = toggleTrait(toggleTrait({}, group('features'), 'sardas'), group('features'), 'oculos')
    expect(selection.features).toEqual(['sardas', 'oculos'])
    expect(countSelected(selection)).toBe(2)
  })
})

describe('randomTraits', () => {
  it('escolhe um valor por grupo de escolha única e mantém fundo neutro', () => {
    const selection = randomTraits(() => 0.4)
    for (const traitGroup of PERSONA_TRAIT_GROUPS.filter((item) => !item.multiple)) {
      expect(selection[traitGroup.id]).toHaveLength(1)
    }
    expect(selection.setting).toEqual(['estudio'])
  })

  it('não põe barba em persona feminina', () => {
    for (let i = 0; i < 50; i += 1) {
      const selection = randomTraits()
      if (selection.gender?.[0] === 'feminino') expect(selection.features).not.toContain('barba')
    }
  })
})

describe('summarizeTraits', () => {
  it('resume em português, na ordem dos grupos', () => {
    expect(summarizeTraits({ gender: ['feminino'], niche: ['fitness'] })).toBe('Fitness, Feminino')
  })
})
