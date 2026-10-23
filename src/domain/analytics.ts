import { z } from 'zod'

// Vynkio Analytics (0013): leitura do CSV exportado da rede e os indicadores do período.
// Regra que vale para tudo: métrica que não veio no arquivo é "sem dado", nunca zero.

export const ANALYTICS_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin'] as const
export type AnalyticsPlatform = (typeof ANALYTICS_PLATFORMS)[number]

export const PLATFORM_LABELS: Record<AnalyticsPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
}

export const COUNT_METRICS = ['views', 'reach', 'impressions', 'likes', 'comments', 'shares', 'saves', 'followers', 'clicks', 'conversions'] as const
export const RATE_METRICS = ['retention_rate', 'ctr'] as const
export type CountMetric = (typeof COUNT_METRICS)[number]
export type RateMetric = (typeof RATE_METRICS)[number]
export type Metric = CountMetric | RateMetric | 'watch_time_seconds'

export const METRIC_LABELS: Record<Metric, string> = {
  views: 'Visualizações',
  reach: 'Alcance',
  impressions: 'Impressões',
  likes: 'Curtidas',
  comments: 'Comentários',
  shares: 'Compartilhamentos',
  saves: 'Salvamentos',
  followers: 'Seguidores',
  clicks: 'Cliques',
  conversions: 'Conversões',
  watch_time_seconds: 'Tempo de exibição',
  retention_rate: 'Retenção',
  ctr: 'CTR',
}

/** Uma linha do arquivo depois de validada: é o que vai para `import_analytics`. */
export interface AnalyticsRow {
  readonly metric_date: string
  readonly content_ref: string
  readonly views: number | null
  readonly reach: number | null
  readonly impressions: number | null
  readonly likes: number | null
  readonly comments: number | null
  readonly shares: number | null
  readonly saves: number | null
  readonly followers: number | null
  readonly clicks: number | null
  readonly conversions: number | null
  readonly watch_time_seconds: number | null
  readonly retention_rate: number | null
  readonly ctr: number | null
}

type Column = keyof AnalyticsRow

// Nomes aceitos no cabeçalho, já sem acento e em minúsculas: o modelo do Vynkio e os
// nomes mais comuns das exportações das redes.
const HEADER_ALIASES: Record<Column, readonly string[]> = {
  metric_date: ['data', 'date', 'dia', 'day'],
  content_ref: ['conteudo', 'post', 'publicacao', 'video', 'titulo', 'title', 'content', 'link'],
  views: ['visualizacoes', 'views', 'plays', 'reproducoes', 'video views'],
  reach: ['alcance', 'reach', 'contas alcancadas'],
  impressions: ['impressoes', 'impressions'],
  likes: ['curtidas', 'likes', 'gostei'],
  comments: ['comentarios', 'comments'],
  shares: ['compartilhamentos', 'shares'],
  saves: ['salvamentos', 'saves', 'salvos'],
  followers: ['seguidores', 'followers', 'inscritos', 'subscribers'],
  clicks: ['cliques', 'clicks', 'cliques no link', 'link clicks'],
  conversions: ['conversoes', 'conversions'],
  watch_time_seconds: ['tempo_exibicao_segundos', 'tempo de exibicao (segundos)', 'watch time (seconds)', 'watch_time_seconds'],
  retention_rate: ['retencao_pct', 'retencao', 'retention', 'average percentage viewed (%)'],
  ctr: ['ctr_pct', 'ctr', 'click-through rate', 'taxa de cliques'],
}

/** O modelo para baixar: cabeçalho do Vynkio e uma linha de exemplo marcada como exemplo. */
export const CSV_TEMPLATE = [
  'data;conteudo;visualizacoes;alcance;impressoes;curtidas;comentarios;compartilhamentos;salvamentos;seguidores;tempo_exibicao_segundos;retencao_pct;ctr_pct;cliques;conversoes',
  '2026-10-01;Exemplo: apague esta linha;;;;;;;;;;;;;',
].join('\n')

export const MAX_ROWS = 5000
export const MAX_FILE_BYTES = 2 * 1024 * 1024

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^﻿/, '')
    .trim()
    .toLowerCase()

/** Divide uma linha respeitando aspas ("a;b" fica inteiro). */
function splitLine(line: string, separator: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else quoted = !quoted
    } else if (char === separator && !quoted) {
      cells.push(current)
      current = ''
    } else current += char
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

/** `2026-10-01` ou `01/10/2026`; devolve `AAAA-MM-DD` ou nulo se não for uma data real. */
export function parseDate(raw: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw)
  const [year, month, day] = iso ? [iso[1], iso[2], iso[3]] : br ? [br[3], br[2], br[1]] : []
  if (!year || !month || !day) return null
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null
  return `${year}-${month}-${day}`
}

/** Contagem: aceita "1.234", "1,234" e "1234". Vazio é nulo; negativo ou quebrado é erro. */
export function parseCount(raw: string): number | null | 'invalid' {
  if (raw === '' || raw === '-') return null
  const digits = raw.replace(/[.\s]/g, '').replace(/,(?=\d{3}\b)/g, '')
  return /^\d+$/.test(digits) ? Number(digits) : 'invalid'
}

/** Decimal: aceita "45,5", "45.5" e "45,5%". */
export function parseDecimal(raw: string): number | null | 'invalid' {
  if (raw === '' || raw === '-') return null
  const value = Number(raw.replace('%', '').replace(',', '.').trim())
  return Number.isFinite(value) && value >= 0 ? value : 'invalid'
}

export interface ParseResult {
  readonly rows: readonly AnalyticsRow[]
  /** Erros com o número da linha do arquivo, para a pessoa corrigir e mandar de novo. */
  readonly errors: readonly string[]
  /** Métricas que vieram no arquivo; as outras aparecem como "sem dado". */
  readonly metrics: readonly Metric[]
}

const MAX_ERRORS = 8

export function parseAnalyticsCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  const headerLine = lines[0]
  if (!headerLine) return { rows: [], errors: ['O arquivo está vazio.'], metrics: [] }

  const separator = (headerLine.match(/;/g) ?? []).length >= (headerLine.match(/,/g) ?? []).length ? ';' : ','
  const headers = splitLine(headerLine, separator).map(normalize)
  const columns = new Map<Column, number>()
  for (const [column, aliases] of Object.entries(HEADER_ALIASES) as [Column, readonly string[]][]) {
    const index = headers.findIndex((header) => aliases.includes(header))
    if (index >= 0) columns.set(column, index)
  }
  if (!columns.has('metric_date')) return { rows: [], errors: ['Falta a coluna de data (data ou date).'], metrics: [] }
  const metrics = [...COUNT_METRICS, ...RATE_METRICS, 'watch_time_seconds' as const].filter((metric) => columns.has(metric))
  if (metrics.length === 0) return { rows: [], errors: ['Nenhuma coluna de métrica reconhecida. Use o modelo do Vynkio.'], metrics: [] }

  const body = lines.slice(1)
  if (body.length > MAX_ROWS) return { rows: [], errors: [`O arquivo tem mais de ${MAX_ROWS} linhas. Divida em partes.`], metrics }

  const rows: AnalyticsRow[] = []
  const errors: string[] = []
  body.forEach((line, offset) => {
    const lineNumber = offset + 2
    const cells = splitLine(line, separator)
    const cell = (column: Column) => {
      const index = columns.get(column)
      return index === undefined ? '' : (cells[index] ?? '')
    }
    const date = parseDate(cell('metric_date'))
    if (!date) {
      errors.push(`Linha ${lineNumber}: data "${cell('metric_date')}" inválida. Use AAAA-MM-DD ou DD/MM/AAAA.`)
      return
    }
    const values: Partial<Record<Metric, number | null>> = {}
    for (const metric of metrics) {
      const parsed = metric === 'watch_time_seconds' || metric === 'retention_rate' || metric === 'ctr' ? parseDecimal(cell(metric)) : parseCount(cell(metric))
      if (parsed === 'invalid' || ((metric === 'retention_rate' || metric === 'ctr') && parsed !== null && parsed > 100)) {
        errors.push(`Linha ${lineNumber}: ${METRIC_LABELS[metric]} com valor "${cell(metric)}" inválido.`)
        return
      }
      values[metric] = parsed
    }
    rows.push({
      metric_date: date,
      content_ref: cell('content_ref').slice(0, 200),
      views: values.views ?? null,
      reach: values.reach ?? null,
      impressions: values.impressions ?? null,
      likes: values.likes ?? null,
      comments: values.comments ?? null,
      shares: values.shares ?? null,
      saves: values.saves ?? null,
      followers: values.followers ?? null,
      clicks: values.clicks ?? null,
      conversions: values.conversions ?? null,
      watch_time_seconds: values.watch_time_seconds ?? null,
      retention_rate: values.retention_rate ?? null,
      ctr: values.ctr ?? null,
    })
  })

  const shown = errors.slice(0, MAX_ERRORS)
  if (errors.length > MAX_ERRORS) shown.push(`E mais ${errors.length - MAX_ERRORS} linhas com erro.`)
  if (rows.length === 0 && errors.length === 0) shown.push('O arquivo não tem linhas de dados.')
  return { rows: errors.length > 0 ? [] : rows, errors: shown, metrics }
}

// ------------------------------------------------------------------ leitura

const nullableNumber = z.union([z.number(), z.string().transform(Number)]).nullable()

export const snapshotSchema = z.object({
  platform: z.enum(ANALYTICS_PLATFORMS),
  brand_id: z.string().uuid().nullable(),
  metric_date: z.string(),
  content_ref: z.string(),
  views: nullableNumber,
  reach: nullableNumber,
  impressions: nullableNumber,
  likes: nullableNumber,
  comments: nullableNumber,
  shares: nullableNumber,
  saves: nullableNumber,
  followers: nullableNumber,
  clicks: nullableNumber,
  conversions: nullableNumber,
  watch_time_seconds: nullableNumber,
  retention_rate: nullableNumber,
  ctr: nullableNumber,
})
export type Snapshot = z.infer<typeof snapshotSchema>

export const SNAPSHOT_COLUMNS =
  'platform, brand_id, metric_date, content_ref, views, reach, impressions, likes, comments, shares, saves, followers, clicks, conversions, watch_time_seconds, retention_rate, ctr'

export const analyticsImportSchema = z.object({
  id: z.string().uuid(),
  brand_id: z.string().uuid().nullable(),
  platform: z.enum(ANALYTICS_PLATFORMS),
  source: z.literal('manual_csv'),
  file_name: z.string(),
  row_count: z.number().int(),
  period_start: z.string(),
  period_end: z.string(),
  created_at: z.string(),
})
export type AnalyticsImport = z.infer<typeof analyticsImportSchema>

export const IMPORT_COLUMNS = 'id, brand_id, platform, source, file_name, row_count, period_start, period_end, created_at'

// ------------------------------------------------------------- indicadores

export interface MetricSummary {
  readonly metric: Metric | 'engagement_rate'
  /** Nulo quando nenhuma linha do período trouxe a métrica. */
  readonly value: number | null
  readonly previous: number | null
  /** Variação contra o período anterior; nula se faltar dado em um dos dois. */
  readonly change: number | null
}

const sumOf = (rows: readonly Snapshot[], metric: Metric): number | null => {
  const values = rows.map((row) => row[metric]).filter((value): value is number => value !== null)
  return values.length === 0 ? null : values.reduce((total, value) => total + value, 0)
}

const averageOf = (rows: readonly Snapshot[], metric: Metric): number | null => {
  const total = sumOf(rows, metric)
  const count = rows.filter((row) => row[metric] !== null).length
  return total === null || count === 0 ? null : total / count
}

/** Seguidores é um estoque: vale o último dia com dado, não a soma. */
const lastOf = (rows: readonly Snapshot[], metric: Metric): number | null => {
  const withValue = rows.filter((row) => row[metric] !== null).sort((a, b) => a.metric_date.localeCompare(b.metric_date))
  return withValue.at(-1)?.[metric] ?? null
}

function valueOf(rows: readonly Snapshot[], metric: Metric | 'engagement_rate'): number | null {
  if (metric === 'engagement_rate') {
    // Calculado: interações sobre alcance, só com as duas pontas no arquivo.
    const reach = sumOf(rows, 'reach')
    const interactions = (['likes', 'comments', 'shares', 'saves'] as const).map((item) => sumOf(rows, item))
    if (!reach || interactions.every((value) => value === null)) return null
    return (interactions.reduce<number>((total, value) => total + (value ?? 0), 0) / reach) * 100
  }
  if (metric === 'followers') return lastOf(rows, metric)
  if (metric === 'retention_rate' || metric === 'ctr') return averageOf(rows, metric)
  return sumOf(rows, metric)
}

export const SUMMARY_METRICS: readonly (Metric | 'engagement_rate')[] = [
  'views',
  'reach',
  'impressions',
  'engagement_rate',
  'likes',
  'comments',
  'shares',
  'saves',
  'followers',
  'watch_time_seconds',
  'retention_rate',
  'ctr',
  'clicks',
  'conversions',
]

/** Indicadores do período e do período anterior de mesmo tamanho. */
export function summarize(rows: readonly Snapshot[], start: string, end: string, previousStart: string): MetricSummary[] {
  const current = rows.filter((row) => row.metric_date >= start && row.metric_date <= end)
  const previous = rows.filter((row) => row.metric_date >= previousStart && row.metric_date < start)
  return SUMMARY_METRICS.map((metric) => {
    const value = valueOf(current, metric)
    const before = valueOf(previous, metric)
    const change = value !== null && before !== null && before > 0 ? ((value - before) / before) * 100 : null
    return { metric, value, previous: before, change }
  })
}

/** Os conteúdos com mais visualizações no período (linhas que dizem a qual post se referem). */
export function topContents(rows: readonly Snapshot[], start: string, end: string, limit = 5): { ref: string; views: number }[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (!row.content_ref || row.views === null || row.metric_date < start || row.metric_date > end) continue
    totals.set(row.content_ref, (totals.get(row.content_ref) ?? 0) + row.views)
  }
  return [...totals.entries()]
    .map(([ref, views]) => ({ ref, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit)
}
