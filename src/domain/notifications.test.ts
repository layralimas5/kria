import { describe, expect, it } from 'vitest'
import { badgeLabel, buildNotifications, relativeTime, unreadCount } from './notifications'
import type { Generation } from './types'

const NOW = new Date('2026-11-07T12:00:00.000Z')

function generation(overrides: Partial<Generation>): Generation {
  return {
    id: crypto.randomUUID(),
    model_slug: 'image-flux',
    kind: 'image',
    prompt: 'Luna segurando o sérum',
    persona_id: null,
    source_generation_id: null,
    project_id: null,
    options: {},
    format_slug: null,
    upload_id: null,
    from_upload: false,
    credits: 4,
    status: 'succeeded',
    output_path: 'x.png',
    output_type: 'image/png',
    error: null,
    created_at: '2026-11-07T11:00:00.000Z',
    completed_at: '2026-11-07T11:01:00.000Z',
    ...overrides,
  }
}

describe('buildNotifications', () => {
  it('traduz cada estado e ordena do mais recente', () => {
    const list = buildNotifications(
      [
        generation({ id: 'a', completed_at: '2026-11-07T10:00:00.000Z' }),
        generation({ id: 'b', kind: 'video', status: 'failed', credits: 40, completed_at: '2026-11-07T11:30:00.000Z' }),
        generation({ id: 'c', status: 'running', completed_at: null, created_at: '2026-11-07T11:50:00.000Z' }),
      ],
      NOW,
    )
    expect(list.map((item) => item.id)).toEqual(['c', 'b', 'a'])
    expect(list[1]).toMatchObject({ tone: 'failed', title: 'O vídeo não saiu', to: '/estudio?modo=video' })
    expect(list[1]!.text).toContain('40 créditos devolvidos')
    expect(list[2]).toMatchObject({ tone: 'done', title: 'Imagem pronta', to: '/galeria' })
  })

  it('deixa de fora o que passou da janela de 7 dias', () => {
    const old = generation({ completed_at: '2026-10-30T11:00:00.000Z' })
    expect(buildNotifications([old], NOW)).toHaveLength(0)
  })

  it('encurta prompt longo', () => {
    const [item] = buildNotifications([generation({ prompt: 'a '.repeat(80) })], NOW)
    expect(item!.text.length).toBeLessThanOrEqual(70)
    expect(item!.text.endsWith('…')).toBe(true)
  })
})

describe('unreadCount', () => {
  const list = buildNotifications(
    [
      generation({ completed_at: '2026-11-07T10:00:00.000Z' }),
      generation({ completed_at: '2026-11-07T11:30:00.000Z' }),
      generation({ status: 'running', completed_at: null }),
    ],
    NOW,
  )

  it('conta só o que terminou depois da última abertura', () => {
    expect(unreadCount(list, '2026-11-07T11:00:00.000Z')).toBe(1)
  })

  it('quem nunca abriu vê tudo que terminou, sem contar o que está rodando', () => {
    expect(unreadCount(list, null)).toBe(2)
  })
})

describe('formatação', () => {
  it('selo para no 9+', () => {
    expect(badgeLabel(3)).toBe('3')
    expect(badgeLabel(14)).toBe('9+')
  })

  it('tempo relativo', () => {
    expect(relativeTime('2026-11-07T11:59:40.000Z', NOW)).toBe('agora')
    expect(relativeTime('2026-11-07T11:45:00.000Z', NOW)).toBe('há 15 min')
    expect(relativeTime('2026-11-07T09:00:00.000Z', NOW)).toBe('há 3 h')
    expect(relativeTime('2026-11-06T09:00:00.000Z', NOW)).toBe('ontem')
    expect(relativeTime('2026-11-04T09:00:00.000Z', NOW)).toBe('há 3 dias')
  })
})
