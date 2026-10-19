import { describe, expect, it } from 'vitest'
import { checkPrompt } from '../../supabase/functions/_shared/generation'
import {
  buildPersonaPrompt,
  countSelected,
  countSelectedInSection,
  groupsOfSection,
  isGroupVisible,
  PERSONA_PROMPT_PREFIX,
  PERSONA_TRAIT_GROUPS,
  randomTraits,
  summarizeTraits,
  toggleTrait,
  TRAIT_SECTIONS,
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
  it('escolhe um valor por grupo visível de escolha única e mantém fundo neutro', () => {
    const selection = randomTraits(() => 0.4)
    for (const traitGroup of PERSONA_TRAIT_GROUPS.filter((item) => !item.multiple && isGroupVisible(item, selection))) {
      expect(selection[traitGroup.id]).toHaveLength(1)
    }
    expect(selection.setting).toEqual(['estudio'])
  })

  it('não põe barba em persona feminina', () => {
    for (let i = 0; i < 50; i += 1) {
      const selection = randomTraits()
      if (selection.gender?.[0] === 'feminino') expect(selection.facialHair).toEqual([])
    }
  })
})

describe('barba e bigode', () => {
  it('somem do prompt, do resumo e da contagem quando a persona é feminina', () => {
    const selection = { gender: ['feminino'], facialHair: ['barba-cheia'] }
    expect(buildPersonaPrompt(selection)).not.toContain('beard')
    expect(summarizeTraits(selection)).toBe('Feminino')
    expect(countSelected(selection)).toBe(1)
    expect(groupsOfSection('rosto', selection).map((item) => item.id)).not.toContain('facialHair')
  })

  it('valem para persona masculina', () => {
    expect(buildPersonaPrompt({ gender: ['masculino'], facialHair: ['cavanhaque'] })).toContain('goatee')
  })
})

describe('cor da roupa', () => {
  it('entra junto do estilo, e sozinha vira "outfit"', () => {
    expect(buildPersonaPrompt({ outfit: ['streetwear'], outfitColor: ['verde'] })).toContain('wearing a green streetwear outfit')
    expect(buildPersonaPrompt({ outfitColor: ['vinho'] })).toContain('wearing a burgundy outfit')
  })
})

describe('abas', () => {
  it('todo grupo está numa aba e a contagem por aba soma o total', () => {
    const selection = { niche: ['fitness'], hairstyle: ['coque'], build: ['atletico'], skin: ['media'], hairColor: ['preto'] }
    const total = TRAIT_SECTIONS.reduce((sum, section) => sum + countSelectedInSection(selection, section.id), 0)
    expect(total).toBe(countSelected(selection))
    expect(countSelectedInSection(selection, 'cores')).toBe(2)
  })
})

describe('summarizeTraits', () => {
  it('resume em português, na ordem dos grupos', () => {
    expect(summarizeTraits({ gender: ['feminino'], niche: ['fitness'] })).toBe('Fitness, Feminino')
  })
})
