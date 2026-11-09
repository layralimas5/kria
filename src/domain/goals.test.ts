import { describe, expect, it } from 'vitest'
import { HOME_ACTION_IDS, homeActions } from './goals'
import type { PlanTool } from './plans'

const allTools = () => true
const without = (missing: PlanTool) => (tool: PlanTool) => tool !== missing

describe('homeActions', () => {
  it('com tudo liberado, mostra as oito portas, sem repetir', () => {
    const actions = homeActions('all_tools', allTools)
    expect(actions.map((action) => action.id)).toEqual([...HOME_ACTION_IDS])
  })

  it('o objetivo do onboarding decide o que vem primeiro', () => {
    const ids = homeActions('ugc_ads', allTools).map((action) => action.id)
    expect(ids.slice(0, 3)).toEqual(['ugc', 'persona', 'copy'])
    expect(new Set(ids).size).toBe(8)
  })

  it('sem projetos no plano, a última porta leva à biblioteca', () => {
    const last = homeActions('all_tools', without('projects')).at(-1)
    expect(last).toMatchObject({ to: '/galeria', title: 'Criações anteriores' })
    expect(last?.tool).toBeUndefined()
  })

  it('o que o plano não libera não aparece: UGC sem a ferramenta, vídeo sem modelo de vídeo', () => {
    const ids = homeActions('all_tools', without('ugc_studio'), (kind) => kind !== 'video').map((action) => action.id)
    expect(ids).not.toContain('ugc')
    expect(ids).not.toContain('video')
    expect(ids).toContain('image')
  })
})
