import { describe, expect, it } from 'vitest'
import { activityFeed, creditsYield, cycleOf, dailyCounts, nextSteps, relativeTime } from './home'
import type { Generation } from './types'

const NOW = new Date('2026-11-10T15:00:00Z') // 12:00 em Brasília

const generation = (patch: Partial<Generation>): Generation => ({
  id: crypto.randomUUID(),
  model_slug: 'foto',
  kind: 'image',
  prompt: 'retrato',
  persona_id: null,
  source_generation_id: null,
  project_id: null,
  options: {},
  format_slug: null,
  upload_id: null,
  from_upload: false,
  credits: 52,
  status: 'succeeded',
  output_path: 'a.png',
  output_type: 'image/png',
  error: null,
  created_at: NOW.toISOString(),
  completed_at: NOW.toISOString(),
  ...patch,
})

describe('tempo relativo', () => {
  it('fala como gente', () => {
    expect(relativeTime('2026-11-10T14:59:30Z', NOW)).toBe('agora')
    expect(relativeTime('2026-11-10T14:40:00Z', NOW)).toBe('há 20 min')
    expect(relativeTime('2026-11-10T04:00:00Z', NOW)).toBe('há 11 h')
    expect(relativeTime('2026-11-09T20:00:00Z', NOW)).toBe('ontem')
    expect(relativeTime('2026-11-07T15:00:00Z', NOW)).toBe('há 3 dias')
    expect(relativeTime('2026-10-01T15:00:00Z', NOW)).toMatch(/out/)
  })

  it('vira o dia pelo horário de Brasília', () => {
    // 01:00 UTC do dia 10 ainda é dia 9 em Brasília: "ontem", não "há 14 h".
    expect(relativeTime('2026-11-10T01:00:00Z', NOW)).toBe('ontem')
  })
})

describe('ritmo e ciclo', () => {
  it('conta criações concluídas por dia, hoje no fim', () => {
    const counts = dailyCounts(
      [
        generation({}),
        generation({ completed_at: '2026-11-09T15:00:00Z' }),
        generation({ completed_at: '2026-11-09T16:00:00Z' }),
        generation({ status: 'failed', completed_at: null }),
        generation({ completed_at: '2026-10-01T15:00:00Z' }),
      ],
      NOW,
      3,
    )
    expect(counts).toEqual([0, 2, 1])
  })

  it('calcula dias até a renovação e quanto do período passou', () => {
    expect(cycleOf({ current_period_start: '2026-11-01T15:00:00Z', current_period_end: '2026-12-01T15:00:00Z' }, NOW)).toEqual({ daysLeft: 21, elapsed: 0.3 })
    expect(cycleOf(null, NOW)).toBeNull()
    expect(cycleOf({ current_period_start: null, current_period_end: '2026-12-01T15:00:00Z' }, NOW)).toBeNull()
  })

  it('saldo em criações da mais barata', () => {
    expect(creditsYield(500, 52)).toBe(9)
    expect(creditsYield(500, null)).toBeNull()
  })
})

describe('primeiros passos e atividade', () => {
  it('marca o que a conta já fez e só oferece vídeo a quem pode', () => {
    const steps = nextSteps({ generations: [generation({})], personas: 0, videoAllowed: false, paying: true })
    expect(steps.map((step) => [step.id, step.done])).toEqual([
      ['image', true],
      ['persona', false],
      ['plan', true],
    ])
  })

  it('linha do tempo diz o que ficou pronto, o que roda e o que devolveu crédito', () => {
    const feed = activityFeed(
      [generation({ status: 'running', completed_at: null }), generation({ status: 'failed', credits: 52 }), generation({ kind: 'video', model_slug: 'kling' })],
      (slug) => (slug === 'kling' ? 'Kling 3.0' : 'Nano Banana 2'),
    )
    expect(feed.map((item) => item.tone)).toEqual(['running', 'failed', 'done'])
    expect(feed[1]?.detail).toBe('Nano Banana 2 · 52 créditos devolvidos')
    expect(feed[2]?.title).toBe('Vídeo pronto')
  })
})
