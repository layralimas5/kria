import { describe, expect, it } from 'vitest'
import { applyQuery, EMPTY_QUERY, isFiltered, librarySummary, modelsInUse, reuseLink } from './library'
import { dayBucket, groupByBucket } from './timeline'
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
  credits: 5,
  status: 'succeeded',
  output_path: 'a.png',
  output_type: 'image/png',
  error: null,
  created_at: NOW.toISOString(),
  completed_at: NOW.toISOString(),
  ...patch,
})

describe('busca e filtros da biblioteca', () => {
  const list = [
    generation({ prompt: 'Mulher tomando café em Lisboa', created_at: '2026-11-10T14:00:00Z' }),
    generation({ prompt: 'Ela sorri para a câmera', kind: 'video', model_slug: 'video-kling', created_at: '2026-11-09T14:00:00Z' }),
    generation({ prompt: 'Cafeteria vazia', status: 'failed', created_at: '2026-11-08T14:00:00Z' }),
    generation({ prompt: 'Praia ao pôr do sol', status: 'running', created_at: '2026-11-07T14:00:00Z' }),
  ]

  it('acha sem acento e com mais de uma palavra', () => {
    expect(applyQuery(list, { ...EMPTY_QUERY, search: 'cafe' }).map((item) => item.prompt)).toEqual(['Mulher tomando café em Lisboa', 'Cafeteria vazia'])
    expect(applyQuery(list, { ...EMPTY_QUERY, search: 'CAFÉ lisboa' })).toHaveLength(1)
    expect(applyQuery(list, { ...EMPTY_QUERY, search: 'camera' })[0]?.kind).toBe('video')
  })

  it('combina tipo, status e modelo', () => {
    expect(applyQuery(list, { ...EMPTY_QUERY, kind: 'video' })).toHaveLength(1)
    expect(applyQuery(list, { ...EMPTY_QUERY, status: 'failed' })[0]?.prompt).toBe('Cafeteria vazia')
    expect(applyQuery(list, { ...EMPTY_QUERY, status: 'running' })[0]?.prompt).toBe('Praia ao pôr do sol')
    expect(applyQuery(list, { ...EMPTY_QUERY, model: 'foto', status: 'ready' })).toHaveLength(1)
  })

  it('inverte a ordem sem mexer na lista original', () => {
    const oldest = applyQuery(list, { ...EMPTY_QUERY, sort: 'oldest' })
    expect(oldest[0]?.prompt).toBe('Praia ao pôr do sol')
    expect(list[0]?.prompt).toBe('Mulher tomando café em Lisboa')
  })

  it('sabe quando há filtro ligado', () => {
    expect(isFiltered(EMPTY_QUERY)).toBe(false)
    expect(isFiltered({ ...EMPTY_QUERY, search: '  ' })).toBe(false)
    expect(isFiltered({ ...EMPTY_QUERY, model: 'foto' })).toBe(true)
  })

  it('resume sem contar crédito de falha', () => {
    expect(librarySummary(list)).toEqual({ total: 4, images: 3, videos: 1, running: 1, failed: 1, creditsSpent: 10 })
  })

  it('ordena modelos pelo uso', () => {
    expect(modelsInUse(list)).toEqual(['foto', 'video-kling'])
  })
})

describe('usar de novo', () => {
  it('leva o pedido e o tipo para o Estúdio', () => {
    expect(reuseLink(generation({ prompt: 'café & pão' }))).toBe('/estudio?modo=imagem&prompt=caf%C3%A9+%26+p%C3%A3o')
  })

  it('no vídeo, mantém a imagem ou o personagem de origem', () => {
    const origin = crypto.randomUUID()
    expect(reuseLink(generation({ kind: 'video', source_generation_id: origin }))).toContain(`origem=${origin}`)
    const persona = crypto.randomUUID()
    expect(reuseLink(generation({ kind: 'video', persona_id: persona }))).toContain(`persona=${persona}`)
  })
})

describe('agrupamento por dia', () => {
  it('nomeia as seções pelo calendário de Brasília', () => {
    expect(dayBucket('2026-11-10T03:30:00Z', NOW)).toBe('Hoje')
    expect(dayBucket('2026-11-10T02:30:00Z', NOW)).toBe('Ontem') // 23:30 do dia 9 em Brasília
    expect(dayBucket('2026-11-05T12:00:00Z', NOW)).toBe('Últimos 7 dias')
    expect(dayBucket('2026-11-02T12:00:00Z', NOW)).toBe('Este mês')
    expect(dayBucket('2026-10-20T12:00:00Z', NOW)).toBe('outubro de 2026')
  })

  it('junta itens seguidos da mesma seção', () => {
    const dates = ['2026-11-10T14:00:00Z', '2026-11-10T12:00:00Z', '2026-11-09T12:00:00Z', '2026-10-01T12:00:00Z']
    expect(groupByBucket(dates, (date) => date, NOW).map((group) => [group.label, group.items.length])).toEqual([
      ['Hoje', 2],
      ['Ontem', 1],
      ['outubro de 2026', 1],
    ])
  })
})
