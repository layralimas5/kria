import { describe, expect, it } from 'vitest'
import { checkUploadFile, defaultChoices, formatAllowed, formatCost, groupByNiche, type Format } from './formats'
import type { Model } from './types'

const model = (slug: string, credits: number, allowed_plans: string[] | null = null): Model => ({
  slug,
  name: slug,
  description: '',
  kind: 'video',
  requires_image: true,
  credits,
  position: 0,
  badge: null,
  defaults: {},
  options: {},
  allowed_plans,
  studio: true,
})

const format = (overrides: Partial<Format> = {}): Format => ({
  slug: 'tour-comodo',
  name: 'Tour',
  niche: 'Imóveis',
  description: '',
  flow: 'single',
  model_slug: 'video-kling',
  edit_model_slug: null,
  fields: [{ key: 'light', label: 'Luz', choices: [{ value: 'dia', label: 'Dia' }, { value: 'noite', label: 'Noite' }] }],
  example_path: null,
  badge: null,
  position: 10,
  ...overrides,
})

const models = [model('video-kling', 40), model('foto-edicao', 6), model('video-veo', 200, ['pro'])]

describe('formatCost', () => {
  it('soma a edição e o resultado no antes e depois', () => {
    expect(formatCost(format(), models)).toEqual({ edit: null, final: 40, total: 40 })
    expect(formatCost(format({ flow: 'before_after', edit_model_slug: 'foto-edicao' }), models)).toEqual({ edit: 6, final: 40, total: 46 })
  })

  it('fica nulo se o modelo não está no catálogo', () => {
    expect(formatCost(format({ model_slug: 'sumiu' }), models)).toBeNull()
  })
})

describe('formatAllowed', () => {
  it('exige que o plano libere todos os modelos do formato', () => {
    expect(formatAllowed(format(), models, 'gratis')).toBe(true)
    expect(formatAllowed(format({ model_slug: 'video-veo' }), models, 'gratis')).toBe(false)
    expect(formatAllowed(format({ model_slug: 'video-veo' }), models, 'pro')).toBe(true)
  })
})

describe('checkUploadFile', () => {
  it('aceita JPG, PNG e WEBP até 10 MB', () => {
    expect(checkUploadFile({ type: 'image/jpeg', size: 1000 })).toEqual({ ok: true, type: 'image/jpeg' })
    expect(checkUploadFile({ type: 'image/gif', size: 1000 }).ok).toBe(false)
    expect(checkUploadFile({ type: 'image/png', size: 11 * 1024 * 1024 }).ok).toBe(false)
  })
})

it('a primeira opção de cada campo é o padrão', () => {
  expect(defaultChoices(format().fields)).toEqual({ light: 'dia' })
})

it('agrupa por nicho mantendo a ordem do catálogo', () => {
  const groups = groupByNiche([format({ slug: 'a' }), format({ slug: 'b', niche: 'E-commerce' }), format({ slug: 'c' })])
  expect(groups.map((group) => [group.niche, group.formats.map((item) => item.slug)])).toEqual([
    ['Imóveis', ['a', 'c']],
    ['E-commerce', ['b']],
  ])
})
