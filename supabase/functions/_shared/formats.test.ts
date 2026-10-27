import { describe, expect, it } from 'vitest'
import { parseFormatFields, planFormatStep, type FormatRow } from './formats.ts'

const fields = parseFormatFields([
  { key: 'movement', label: 'Movimento', choices: [{ value: 'entrar', label: 'Entrar', prompt: 'Slow dolly-in' }, { value: 'revelar', label: 'Revelar', prompt: 'Pull-back reveal' }] },
  { key: 'light', label: 'Luz', choices: [{ value: 'dia', label: 'Dia', prompt: 'daylight' }] },
])

const tour: FormatRow = {
  slug: 'tour-comodo',
  flow: 'single',
  model_slug: 'video-kling',
  prompt_template: '{movement} through this room, {light}.',
  edit_model_slug: null,
  edit_prompt_template: null,
  fields,
}

const beforeAfter: FormatRow = {
  ...tour,
  slug: 'antes-depois',
  flow: 'before_after',
  prompt_template: 'Transform the room.',
  edit_model_slug: 'foto-edicao',
  edit_prompt_template: 'Furnish it, {light}.',
}

describe('planFormatStep', () => {
  it('monta o prompt com as escolhas e usa a primeira opção do que faltou', () => {
    expect(planFormatStep(tour, 'final', { movement: 'revelar' })).toEqual({
      ok: true,
      model: 'video-kling',
      prompt: 'Pull-back reveal through this room, daylight.',
    })
  })

  it('recusa opção ou valor fora do formato', () => {
    expect(planFormatStep(tour, 'final', { movement: 'voar' }).ok).toBe(false)
    expect(planFormatStep(tour, 'final', { cor: 'azul' }).ok).toBe(false)
  })

  it('acrescenta o detalhe só se passar pelo filtro', () => {
    const plan = planFormatStep(tour, 'final', {}, ' sofá verde ')
    expect(plan.ok && plan.prompt.endsWith('Details: sofá verde')).toBe(true)
    expect(planFormatStep(tour, 'final', {}, 'mulher nua no sofá').ok).toBe(false)
    expect(planFormatStep(tour, 'final', {}, 'x'.repeat(201)).ok).toBe(false)
  })

  it('a etapa de edição usa o modelo e o texto de edição', () => {
    expect(planFormatStep(beforeAfter, 'edit', {})).toEqual({ ok: true, model: 'foto-edicao', prompt: 'Furnish it, daylight.' })
    expect(planFormatStep(beforeAfter, 'final', {})).toMatchObject({ ok: true, model: 'video-kling' })
    expect(planFormatStep(tour, 'edit', {}).ok).toBe(false)
  })
})

describe('parseFormatFields', () => {
  it('descarta campo malformado ou sem escolhas', () => {
    expect(parseFormatFields([{ key: 'a', label: 'A', choices: [] }, { key: 1 }, null])).toEqual([])
    expect(parseFormatFields('x')).toEqual([])
  })
})
