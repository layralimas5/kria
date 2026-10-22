import { describe, expect, it } from 'vitest'
import { ASSISTANT_TOOLS, briefFromIdea, toolByPath } from './assistant'

describe('ferramentas do assistente', () => {
  it('acha a ferramenta pela rota', () => {
    expect(toolByPath('ugc')?.tool).toBe('ugc-roteiro')
    expect(toolByPath('nada')).toBeNull()
    expect(toolByPath(undefined)).toBeNull()
  })

  it('só o UGC depende do Estúdio UGC do plano', () => {
    expect(ASSISTANT_TOOLS.filter((info) => info.planTool === 'ugc_studio').map((info) => info.tool)).toEqual(['ugc-roteiro'])
  })

  it('a ideia vira briefing do roteiro sem passar do limite', () => {
    expect(briefFromIdea('Bastidor', 'Mostrar o preparo')).toBe('Bastidor\n\nMostrar o preparo')
    expect(briefFromIdea('x', 'y'.repeat(3000))).toHaveLength(2000)
  })
})
