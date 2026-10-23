import { describe, expect, it } from 'vitest'
import { parseAnalyticsCsv, parseCount, parseDate, parseDecimal, summarize, topContents, type Snapshot } from './analytics'

describe('valores do CSV', () => {
  it('lê datas nos dois formatos e recusa data que não existe', () => {
    expect(parseDate('2026-10-01')).toBe('2026-10-01')
    expect(parseDate('01/10/2026')).toBe('2026-10-01')
    expect(parseDate('31/02/2026')).toBeNull()
    expect(parseDate('ontem')).toBeNull()
  })

  it('contagem aceita separador de milhar e recusa negativo', () => {
    expect(parseCount('1.234')).toBe(1234)
    expect(parseCount('1,234')).toBe(1234)
    expect(parseCount('')).toBeNull()
    expect(parseCount('-5')).toBe('invalid')
    expect(parseCount('12a')).toBe('invalid')
  })

  it('decimal aceita vírgula e porcentagem', () => {
    expect(parseDecimal('45,5%')).toBe(45.5)
    expect(parseDecimal('3.2')).toBe(3.2)
    expect(parseDecimal('abc')).toBe('invalid')
  })
})

describe('parseAnalyticsCsv', () => {
  it('lê o modelo do Vynkio com ponto e vírgula e deixa nulo o que veio vazio', () => {
    const csv = 'data;conteudo;visualizacoes;curtidas\n2026-10-01;Reels da rotina;1.200;80\n02/10/2026;;900;'
    const result = parseAnalyticsCsv(csv)
    expect(result.errors).toEqual([])
    expect(result.metrics).toEqual(['views', 'likes'])
    expect(result.rows[1]).toMatchObject({ metric_date: '2026-10-02', views: 900, likes: null, reach: null })
  })

  it('aceita cabeçalho de exportação em inglês com vírgula e aspas', () => {
    const result = parseAnalyticsCsv('Date,Title,Views,Reach\n2026-10-01,"Post, com vírgula",10,8')
    expect(result.rows[0]).toMatchObject({ content_ref: 'Post, com vírgula', views: 10, reach: 8 })
  })

  it('aponta a linha com erro e não importa nada pela metade', () => {
    const result = parseAnalyticsCsv('data;visualizacoes;retencao_pct\n2026-10-01;10;40\n2026-13-01;5;10\n2026-10-03;5;140')
    expect(result.rows).toEqual([])
    expect(result.errors[0]).toContain('Linha 3')
    expect(result.errors[1]).toContain('Linha 4')
  })

  it('sem coluna de data ou de métrica, explica o que falta', () => {
    expect(parseAnalyticsCsv('visualizacoes\n10').errors[0]).toContain('data')
    expect(parseAnalyticsCsv('data;cor\n2026-10-01;azul').errors[0]).toContain('métrica')
  })
})

const snapshot = (overrides: Partial<Snapshot>): Snapshot => ({
  platform: 'instagram',
  brand_id: null,
  metric_date: '2026-10-01',
  content_ref: '',
  views: null,
  reach: null,
  impressions: null,
  likes: null,
  comments: null,
  shares: null,
  saves: null,
  followers: null,
  clicks: null,
  conversions: null,
  watch_time_seconds: null,
  retention_rate: null,
  ctr: null,
  ...overrides,
})

describe('summarize', () => {
  const rows = [
    snapshot({ metric_date: '2026-09-25', views: 500, followers: 900 }),
    snapshot({ metric_date: '2026-10-02', views: 600, reach: 400, likes: 30, comments: 10, followers: 950, retention_rate: 40 }),
    snapshot({ metric_date: '2026-10-05', views: 400, followers: 1000, retention_rate: 60 }),
  ]
  const byMetric = (metric: string) => summarize(rows, '2026-10-01', '2026-10-07', '2026-09-24').find((item) => item.metric === metric)

  it('soma o que é fluxo e compara com o período anterior', () => {
    expect(byMetric('views')).toMatchObject({ value: 1000, previous: 500, change: 100 })
  })

  it('seguidores vale o último dia, retenção a média, engajamento é calculado', () => {
    expect(byMetric('followers')?.value).toBe(1000)
    expect(byMetric('retention_rate')?.value).toBe(50)
    expect(byMetric('engagement_rate')?.value).toBe(10)
  })

  it('métrica que não veio fica sem dado, nunca zero', () => {
    expect(byMetric('shares')).toMatchObject({ value: null, change: null })
    expect(byMetric('reach')).toMatchObject({ value: 400, previous: null, change: null })
  })
})

describe('topContents', () => {
  it('ordena os posts do período por visualizações', () => {
    const rows = [
      snapshot({ content_ref: 'A', views: 10 }),
      snapshot({ content_ref: 'B', views: 30 }),
      snapshot({ content_ref: 'A', views: 25, metric_date: '2026-10-02' }),
      snapshot({ content_ref: '', views: 999 }),
    ]
    expect(topContents(rows, '2026-10-01', '2026-10-07')).toEqual([
      { ref: 'A', views: 35 },
      { ref: 'B', views: 30 },
    ])
  })
})
