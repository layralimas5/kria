// Modo demo da central financeira: movimentações fictícias, geradas no navegador, com os mesmos
// filtros e agregações de `admin_finance_explorer` (0029). Nada disso existe no banco.
import type { Movement } from '@/domain/financeExplorer'
import type { DemoState, Row } from './demoData'

const DAY = 86_400_000
const TZ_OFFSET = 3 * 3_600_000
const EMAILS = ['ana.ribeiro@demo.vynkio', 'bruno.melo@demo.vynkio', 'carla.dias@demo.vynkio', 'diego.souza@demo.vynkio', 'elisa.prado@demo.vynkio', 'fabio.lima@demo.vynkio', 'gabi.nunes@demo.vynkio', 'heitor.alves@demo.vynkio']
const PLANS = ['starter', 'pro', 'studio'] as const
const PRICES: Readonly<Record<string, number>> = { starter: 5990, pro: 7990, studio: 14990 }
const AI = [
  { model: 'foto', provider: 'fal', feature: 'image', cents: 42 },
  { model: 'foto-persona', provider: 'fal', feature: 'character', cents: 42 },
  { model: 'video-kling', provider: 'fal', feature: 'video', cents: 330 },
  { model: 'copy', provider: 'anthropic', feature: 'text', cents: 4 },
] as const
const FEE_RATE = 0.0499

function random(seed: number) {
  let value = seed
  return () => {
    value = (value * 1_103_515_245 + 12_345) % 2_147_483_648
    return value / 2_147_483_648
  }
}

let cache: { day: string; rows: Movement[] } | null = null

/** Um ano e meio de movimentações, regerado uma vez por dia. */
function allMovements(): Movement[] {
  const today = new Date(Date.now() - TZ_OFFSET).toISOString().slice(0, 10)
  if (cache?.day === today) return cache.rows
  const rand = random(42)
  const rows: Movement[] = []
  const base = (patch: Partial<Movement> & Pick<Movement, 'id' | 'occurred_at' | 'type' | 'status' | 'description' | 'amount_cents'>): Movement => ({
    source: null, category: null, plan_slug: null, user_id: null, email: null, net_cents: null, credits: null, method: null, reference: null,
    ai_provider: null, ai_model: null, ai_feature: null, cost_basis: null, events: null, details: null, ...patch,
  })
  const start = Date.now() - 540 * DAY
  for (let day = 0; day <= 540; day += 1) {
    const at = (hour: number) => new Date(start + day * DAY + hour * 3_600_000).toISOString()
    const growth = 0.3 + day / 540
    EMAILS.forEach((email, index) => {
      const userId = `00000000-0000-4000-8000-00000000000${index}`
      const plan = PLANS[index % 3] ?? 'pro'
      if ((day + index * 4) % 30 === 0 && rand() < growth) {
        const price = PRICES[plan] ?? 7990
        const refunded = rand() < 0.04
        const reconciled = rand() < 0.7
        const net = reconciled ? Math.round(price * (1 - FEE_RATE)) : null
        const id = `sp:${day}-${index}`
        rows.push(base({ id, occurred_at: at(10 + index), type: 'revenue', status: refunded ? 'refunded' : 'paid', source: day < 30 ? 'subscription_new' : 'renewal', plan_slug: plan, user_id: userId, email, description: `Mensalidade ${plan === 'studio' ? 'Max' : plan === 'pro' ? 'Pro' : 'Starter'}`, amount_cents: price, net_cents: net, method: 'card', reference: `pay_demo_${day}_${index}`, details: { invoice_url: null } }))
        rows.push(base({ id: `fee:${id}`, occurred_at: at(10 + index), type: 'expense', status: 'paid', category: 'payment_fees', plan_slug: plan, user_id: userId, email, description: 'Taxa do gateway', amount_cents: net === null ? Math.round(price * FEE_RATE) : price - net, method: 'card', reference: `pay_demo_${day}_${index}`, cost_basis: net === null ? 'estimated' : 'metered' }))
        if (refunded) rows.push(base({ id: `sr:${id}`, occurred_at: at(18), type: 'refund', status: 'refunded', source: 'renewal', plan_slug: plan, user_id: userId, email, description: 'Estorno da mensalidade', amount_cents: price, method: 'card', reference: `pay_demo_${day}_${index}`, details: { refund_date_known: true } }))
      }
      const generations = Math.floor(rand() * 6 * growth)
      if (generations > 0) {
        const ai = AI[Math.floor(rand() * AI.length)] ?? AI[0]
        rows.push(base({ id: `ai:${day}-${index}`, occurred_at: at(14), type: 'expense', status: 'paid', category: 'ai', plan_slug: plan, user_id: userId, email, description: `${ai.model} · ${generations} gerações`, amount_cents: ai.cents * generations, ai_provider: ai.provider, ai_model: ai.model, ai_feature: ai.feature, cost_basis: ai.provider === 'anthropic' ? 'estimated' : 'metered', events: generations, credits: generations * 5 }))
      }
    })
    if (rand() < 0.08 * growth) {
      const pix = rand() < 0.6
      const price = [1990, 4990, 11990][Math.floor(rand() * 3)] ?? 4990
      rows.push(base({ id: `pk:${day}`, occurred_at: at(20), type: 'revenue', status: rand() < 0.2 ? 'pending' : 'paid', source: 'credit_pack', plan_slug: 'gratis', description: `Pacote de créditos`, amount_cents: price, method: pix ? 'pix' : 'card', reference: `pay_pack_${day}` }))
    }
    if (day % 30 === 5) {
      rows.push(base({ id: `ex:infra-${day}`, occurred_at: at(3), type: 'expense', status: 'paid', category: 'infra', description: 'Supabase e Netlify', amount_cents: 22_000, cost_basis: 'registered' }))
      rows.push(base({ id: `ex:tools-${day}`, occurred_at: at(3), type: 'expense', status: 'paid', category: 'tools', description: 'Ferramentas de design e e-mail', amount_cents: 9_500, cost_basis: 'registered' }))
    }
    if (day === 538) rows.push(base({ id: 'od:demo', occurred_at: at(9), type: 'revenue', status: 'overdue', source: 'renewal', plan_slug: 'pro', user_id: '00000000-0000-4000-8000-000000000001', email: EMAILS[1] ?? null, description: 'Renovação Pro em atraso', amount_cents: 7990, method: 'card' }))
    if (day === 536) rows.push(base({ id: 'aj:demo', occurred_at: at(11), type: 'adjustment', status: 'paid', plan_slug: 'pro', user_id: '00000000-0000-4000-8000-000000000002', email: EMAILS[2] ?? null, description: 'Bônus por falha no vídeo', amount_cents: 0, credits: 50 }))
  }
  cache = { day: today, rows }
  return rows
}

const list = (filters: Row, key: string): string[] | null => {
  const value = filters[key]
  return Array.isArray(value) && value.length > 0 ? value.map(String) : null
}

function passes(row: Movement, filters: Row): boolean {
  const checks: [string, string | null][] = [
    ['types', row.type], ['statuses', row.status], ['plans', row.plan_slug], ['sources', row.source], ['categories', row.category],
    ['ai_providers', row.ai_provider], ['ai_models', row.ai_model], ['ai_features', row.ai_feature], ['methods', row.method],
  ]
  for (const [key, value] of checks) {
    const allowed = list(filters, key)
    if (allowed && (value === null || !allowed.includes(value))) return false
  }
  const user = typeof filters.user === 'string' ? filters.user.toLowerCase() : ''
  if (user && !(row.email ?? '').toLowerCase().includes(user)) return false
  if (typeof filters.min_cents === 'number' && row.amount_cents < filters.min_cents) return false
  if (typeof filters.max_cents === 'number' && row.amount_cents > filters.max_cents) return false
  return true
}

function totals(rows: readonly Movement[]) {
  const sum = (pick: (row: Movement) => boolean, value: (row: Movement) => number = (row) => row.amount_cents) => rows.filter(pick).reduce((total, row) => total + value(row), 0)
  const paid = (row: Movement) => row.type === 'revenue' && (row.status === 'paid' || row.status === 'refunded')
  return {
    gross_cents: sum(paid),
    reconciled_gross_cents: sum((row) => paid(row) && row.net_cents !== null),
    reconciled_net_cents: sum(paid, (row) => row.net_cents ?? 0),
    refunds_cents: sum((row) => row.type === 'refund'),
    fees_cents: sum((row) => row.category === 'payment_fees'),
    fees_estimated_cents: sum((row) => row.category === 'payment_fees' && row.cost_basis === 'estimated'),
    ai_cents: sum((row) => row.category === 'ai'),
    ai_estimated_cents: sum((row) => row.category === 'ai' && row.cost_basis === 'estimated'),
    ai_unknown_events: 0,
    other_expenses_cents: sum((row) => row.type === 'expense' && row.category !== 'ai' && row.category !== 'payment_fees'),
    expenses_cents: sum((row) => row.type === 'expense'),
    pending_cents: sum((row) => row.type === 'revenue' && row.status === 'pending'),
    overdue_cents: sum((row) => row.type === 'revenue' && row.status === 'overdue'),
    paid_count: rows.filter(paid).length,
    paying_users: new Set(rows.filter(paid).map((row) => row.user_id)).size,
    rows: rows.length,
  }
}

function bucket(iso: string, granularity: string): string {
  const local = new Date(new Date(iso).getTime() - TZ_OFFSET)
  if (granularity === 'month') return local.toISOString().slice(0, 7)
  if (granularity === 'week') {
    const weekday = (local.getUTCDay() + 6) % 7
    return new Date(local.getTime() - weekday * DAY).toISOString().slice(0, 10)
  }
  return local.toISOString().slice(0, 10)
}

function series(rows: readonly Movement[], from: Date, to: Date, granularity: string) {
  const keys: string[] = []
  for (let at = from.getTime(); at < to.getTime(); at += DAY) {
    const key = bucket(new Date(at).toISOString(), granularity)
    if (!keys.includes(key)) keys.push(key)
  }
  const byKey = new Map<string, Movement[]>()
  for (const row of rows) {
    const key = bucket(row.occurred_at, granularity)
    const list = byKey.get(key)
    if (list) list.push(row)
    else byKey.set(key, [row])
  }
  return keys.map((key) => {
    const t = totals(byKey.get(key) ?? [])
    return { key, gross_cents: t.gross_cents, refunds_cents: t.refunds_cents, expenses_cents: t.expenses_cents, ai_cents: t.ai_cents, fees_cents: t.fees_cents }
  })
}

const inRange = (rows: readonly Movement[], from: Date, to: Date) => rows.filter((row) => row.occurred_at >= from.toISOString() && row.occurred_at < to.toISOString())

export function buildDemoFinanceExplorer(state: DemoState, body: Row): Row | { error: string } {
  const filters = (body.p_filters ?? {}) as Row
  const from = new Date(String(filters.from))
  const to = new Date(String(filters.to))
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to || to.getTime() - from.getTime() > 400 * DAY) return { error: 'invalid_period' }
  const span = to.getTime() - from.getTime()
  const compare = filters.compare === 'year' ? 'year' : 'previous'
  const compareFrom = compare === 'year' ? new Date(from.getTime() - 365 * DAY) : new Date(from.getTime() - span)
  const compareTo = compare === 'year' ? new Date(to.getTime() - 365 * DAY) : from
  const granularity = typeof filters.granularity === 'string' ? filters.granularity : 'day'
  const filtered = allMovements().filter((row) => passes(row, filters))
  const current = inRange(filtered, from, to)
  const previous = inRange(filtered, compareFrom, compareTo)
  const monthFrom = new Date(Math.min(from.getTime(), to.getTime() - 180 * DAY))
  const months = inRange(filtered, monthFrom, to)

  const group = <K extends string>(rows: readonly Movement[], key: (row: Movement) => K | null) => {
    const map = new Map<K, Movement[]>()
    for (const row of rows) {
      const value = key(row)
      if (value === null) continue
      const list = map.get(value)
      if (list) list.push(row)
      else map.set(value, [row])
    }
    return [...map.entries()]
  }
  const planName = (slug: string) => (slug === 'studio' ? 'Max' : ((state.plans.find((plan) => plan.slug === slug)?.name as string | undefined) ?? slug))
  const modelName = (slug: string) => (state.models.find((model) => model.slug === slug)?.name as string | undefined) ?? slug

  const search = typeof body.p_search === 'string' ? body.p_search.toLowerCase() : ''
  const tableRows = current.filter((row) => !search || `${row.description} ${row.reference ?? ''} ${row.email ?? ''}`.toLowerCase().includes(search))
  const sort = String(body.p_sort ?? 'occurred_at')
  const dir = body.p_dir === 'asc' ? 1 : -1
  const sortValue = (row: Movement): string | number =>
    sort === 'amount_cents' ? row.amount_cents : sort === 'email' ? (row.email ?? '') : sort === 'plan_slug' ? (row.plan_slug ?? '') : sort === 'type' ? row.type : sort === 'status' ? row.status : row.occurred_at
  tableRows.sort((a, b) => {
    const x = sortValue(a)
    const y = sortValue(b)
    return (x < y ? -1 : x > y ? 1 : 0) * dir || b.occurred_at.localeCompare(a.occurred_at)
  })
  const page = Number(body.p_page ?? 1)
  const size = Number(body.p_page_size ?? 25)
  const mrr = PLANS.reduce((sum, plan, index) => sum + (PRICES[plan] ?? 0) * (index + 2), 0)

  return {
    period: { from: from.toISOString(), to: to.toISOString(), compare_from: compareFrom.toISOString(), compare_to: compareTo.toISOString(), compare, granularity },
    totals: totals(current),
    previous: totals(previous),
    mrr: { now_cents: mrr, start_cents: Math.round(mrr * 0.86) },
    coverage: { months_without_expenses: 0, months: Math.max(1, Math.round(span / (30 * DAY))), payment_fee_rate: FEE_RATE },
    series: series(current, from, to, granularity),
    monthly: series(months, monthFrom, to, 'month'),
    by_plan: group(current, (row) => row.plan_slug).map(([slug, rows]) => {
      const t = totals(rows)
      return { slug, name: planName(slug), gross_cents: t.gross_cents, refunds_cents: t.refunds_cents, ai_cents: t.ai_cents, fees_cents: t.fees_cents, other_cents: t.other_expenses_cents, paying_users: t.paying_users, users: new Set(rows.map((row) => row.user_id)).size }
    }),
    by_category: group(current.filter((row) => row.type === 'expense'), (row) => row.category)
      .map(([category, rows]) => ({ category, cents: totals(rows).expenses_cents, estimated_cents: rows.filter((row) => row.cost_basis === 'estimated').reduce((sum, row) => sum + row.amount_cents, 0) }))
      .sort((a, b) => b.cents - a.cents),
    by_source: group(current.filter((row) => row.type === 'revenue' && (row.status === 'paid' || row.status === 'refunded')), (row) => row.source).map(([source, rows]) => ({ source, cents: totals(rows).gross_cents, count: rows.length })),
    by_method: group(current.filter((row) => row.type === 'revenue' && (row.status === 'paid' || row.status === 'refunded')), (row) => row.method).map(([method, rows]) => ({ method, cents: totals(rows).gross_cents, count: rows.length })),
    ai_by_model: group(current.filter((row) => row.category === 'ai'), (row) => row.ai_model)
      .map(([model, rows]) => ({ model, name: modelName(model), provider: rows[0]?.ai_provider ?? 'fal', cents: totals(rows).ai_cents, events: rows.reduce((sum, row) => sum + (row.events ?? 0), 0), unknown_events: 0, estimated_cents: totals(rows).ai_estimated_cents }))
      .sort((a, b) => b.cents - a.cents),
    ai_by_provider: group(current.filter((row) => row.category === 'ai'), (row) => row.ai_provider).map(([provider, rows]) => ({ provider, cents: totals(rows).ai_cents, events: rows.reduce((sum, row) => sum + (row.events ?? 0), 0) })),
    by_user: group(current, (row) => row.user_id)
      .map(([userId, rows]) => {
        const t = totals(rows)
        return { user_id: userId, email: rows[0]?.email ?? null, plan_slug: rows[0]?.plan_slug ?? null, revenue_cents: t.gross_cents - t.refunds_cents, costs_cents: t.expenses_cents, ai_cents: t.ai_cents }
      })
      .sort((a, b) => b.revenue_cents - a.revenue_cents)
      .slice(0, 20),
    options: {
      plans: [{ slug: 'gratis', name: 'Grátis', status: 'live' }, ...PLANS.map((slug) => ({ slug, name: planName(slug), status: 'live' }))],
      ai_providers: ['anthropic', 'fal'],
      ai_models: state.models.map((model) => ({ slug: String(model.slug), name: String(model.name), provider: String(model.provider ?? 'fal') })),
      can_filter_user: true,
    },
    table: { total: tableRows.length, page, page_size: size, rows: tableRows.slice((page - 1) * size, page * size) },
  }
}
