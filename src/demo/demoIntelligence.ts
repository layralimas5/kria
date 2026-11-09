// Central de inteligência no modo demo (0025): mesmos formatos de `admin_ai_costs`, `admin_business`,
// `admin_users_list` e `admin_user_profile`, calculados sobre o estado falso do navegador. Só existe
// para conferir as telas; nenhum número daqui vai para o banco.

import { brtDay } from '@/domain/adminDashboard'
import type { DemoState, Row } from './demoData'

const DAY_MS = 24 * 60 * 60 * 1000
const USD_BRL = 5.5
const CREDIT_VALUE_BRL = 0.1
/** Texto no demo: custo medido por pedido, como se viesse dos tokens da resposta. */
const TEXT_COST_USD = 0.03
const num = (value: unknown) => Number(value ?? 0)
const sum = <T>(rows: readonly T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0)

interface DemoEvent {
  readonly generation_id: string
  readonly user_id: string
  readonly model_slug: string
  readonly provider: string
  readonly kind: string
  readonly credits: number
  readonly cost_brl: number | null
  readonly basis: 'metered' | 'estimated' | 'unknown'
  readonly at: number
}

export const demoExpenses: Row[] = []

function events(state: DemoState): DemoEvent[] {
  return state.generations
    .filter((row) => row.status === 'succeeded')
    .map((row) => {
      const model = state.models.find((item) => item.slug === row.model_slug)
      const usd = row.kind === 'text' ? TEXT_COST_USD : model?.provider_cost_usd === null || model?.provider_cost_usd === undefined ? null : num(model.provider_cost_usd)
      return {
        generation_id: String(row.id),
        user_id: String(row.user_id),
        model_slug: String(row.model_slug),
        provider: String(model?.provider ?? 'fal'),
        kind: String(row.kind),
        credits: num(row.credits),
        cost_brl: usd === null ? null : Math.round(usd * USD_BRL * 10000) / 10000,
        basis: row.kind === 'text' ? 'metered' : usd === null ? 'unknown' : 'estimated',
        at: new Date(String(row.completed_at ?? row.created_at)).getTime(),
      }
    })
}

function days(from: Date, to: Date): string[] {
  const list: string[] = []
  for (let at = from.getTime(); at < to.getTime(); at += DAY_MS) list.push(brtDay(new Date(at)))
  return [...new Set(list)]
}

const costOf = (rows: readonly DemoEvent[]) => sum(rows, (row) => row.cost_brl ?? 0)

export function buildDemoAiCosts(state: DemoState, from: Date, to: Date, body: Row): Row {
  const span = to.getTime() - from.getTime()
  const models = state.models.filter(
    (model) =>
      (!body.p_provider || model.provider === body.p_provider) &&
      (!body.p_kind || model.kind === body.p_kind) &&
      (!body.p_model || model.slug === body.p_model) &&
      (body.p_active === null || body.p_active === undefined || Boolean(model.active ?? true) === body.p_active),
  )
  const slugs = new Set(models.map((model) => model.slug))
  const all = events(state).filter((row) => slugs.has(row.model_slug))
  const cur = all.filter((row) => row.at >= from.getTime() && row.at < to.getTime())
  const prev = all.filter((row) => row.at >= from.getTime() - span && row.at < from.getTime())
  const now = Date.now()
  const today = new Date(`${brtDay(new Date())}T00:00:00-03:00`).getTime()
  const month = new Date(`${brtDay(new Date()).slice(0, 7)}-01T00:00:00-03:00`).getTime()
  const byDay = (rows: readonly DemoEvent[], day: string) => rows.filter((row) => brtDay(new Date(row.at)) === day)
  const group = (key: 'provider' | 'kind') =>
    [...new Set(cur.map((row) => row[key]))].map((value) => {
      const rows = cur.filter((row) => row[key] === value)
      return { [key]: value, generations: rows.length, cost_brl: costOf(rows), credits: sum(rows, (row) => row.credits) }
    })

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    usd_brl: USD_BRL,
    credit_value_brl: CREDIT_VALUE_BRL,
    min_margin_rate: 0.4,
    max_operation_cost_usd: 5,
    kpis: {
      cost_today_brl: costOf(all.filter((row) => row.at >= today)),
      cost_7d_brl: costOf(all.filter((row) => row.at >= now - 7 * DAY_MS)),
      cost_month_brl: costOf(all.filter((row) => row.at >= month)),
      cost_total_brl: costOf(all),
      cost_period_brl: costOf(cur),
      cost_previous_brl: costOf(prev),
      generations: cur.length,
      generations_previous: prev.length,
      failed_billed: 0,
      credits: sum(cur, (row) => row.credits),
      credits_previous: sum(prev, (row) => row.credits),
      active_users: new Set(cur.map((row) => row.user_id)).size,
      metered: cur.filter((row) => row.basis === 'metered').length,
      estimated: cur.filter((row) => row.basis === 'estimated').length,
      unknown: cur.filter((row) => row.basis === 'unknown').length,
      revenue_estimated_brl: sum(cur, (row) => row.credits) * CREDIT_VALUE_BRL,
    },
    models: models.map((model) => {
      const mine = (rows: readonly DemoEvent[]) => rows.filter((row) => row.model_slug === model.slug)
      const cost = model.provider_cost_usd === null || model.provider_cost_usd === undefined ? null : num(model.provider_cost_usd)
      const pricing = (model.pricing as Row | null | undefined) ?? null
      return {
        slug: model.slug,
        name: model.name,
        provider: model.provider ?? 'fal',
        endpoint: model.endpoint ?? '',
        kind: model.kind,
        active: model.active ?? true,
        credits: model.credits,
        pricing,
        provider_cost_usd: cost,
        target_margin_rate: model.target_margin_rate ?? null,
        cost_checked_at: model.cost_checked_at ?? null,
        cost_source: model.cost_source ?? null,
        unit: pricing?.unit ?? (model.kind === 'text' ? 'token' : model.kind === 'video' ? 'second' : 'image'),
        unit_margin: cost === null ? null : Math.round((1 - (cost * USD_BRL) / (num(model.credits) * CREDIT_VALUE_BRL)) * 10000) / 10000,
        uses_period: mine(cur).length,
        uses_previous: mine(prev).length,
        uses_total: mine(all).length,
        uses_7d: mine(all).filter((row) => row.at >= now - 7 * DAY_MS).length,
        uses_prev_7d: mine(all).filter((row) => row.at >= now - 14 * DAY_MS && row.at < now - 7 * DAY_MS).length,
        credits_period: sum(mine(cur), (row) => row.credits),
        cost_period_brl: costOf(mine(cur)),
        cost_total_brl: costOf(mine(all)),
        metered: mine(cur).filter((row) => row.basis === 'metered').length,
        unknown: mine(cur).filter((row) => row.basis === 'unknown').length,
      }
    }),
    series: days(from, to).map((day) => ({ day, cost_brl: costOf(byDay(cur, day)), credits: sum(byDay(cur, day), (row) => row.credits), generations: byDay(cur, day).length })),
    trend_30d: days(new Date(now - 29 * DAY_MS), new Date(now + 1)).map((day) => ({ day, cost_brl: costOf(byDay(all, day)) })),
    by_provider: group('provider'),
    by_kind: group('kind'),
    providers: [...new Set(state.models.map((model) => model.provider ?? 'fal'))],
  }
}

export function buildDemoBusiness(state: DemoState, from: Date, to: Date, body: Row): Row {
  const span = to.getTime() - from.getTime()
  const all = events(state).filter((row) => (!body.p_model || row.model_slug === body.p_model) && (!body.p_provider || row.provider === body.p_provider))
  const cur = all.filter((row) => row.at >= from.getTime() && row.at < to.getTime())
  const prev = all.filter((row) => row.at >= from.getTime() - span && row.at < from.getTime())
  const inPeriod = (iso: unknown) => {
    const at = new Date(String(iso)).getTime()
    return at >= from.getTime() && at < to.getTime()
  }
  const payments = state.subscriptionPayments.filter((row) => row.status !== 'refunded')
  const granted = state.ledger.filter((row) => num(row.delta) > 0 && row.reason !== 'generation_refund')
  const day = (rows: readonly DemoEvent[], key: string) => rows.filter((row) => brtDay(new Date(row.at)) === key)
  const periodDays = days(from, to)
  const expenses = demoExpenses.filter((row) => {
    const at = new Date(`${String(row.incurred_on)}T12:00:00-03:00`).getTime()
    return at >= from.getTime() && at < to.getTime()
  })
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (11 - index))
    return brtDay(date).slice(0, 7)
  })
  const mrr = sum(
    state.subscriptions.filter((row) => row.status === 'active' || row.status === 'past_due'),
    (row) => num(row.price_cents),
  )

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    filters: { plan: body.p_plan ?? null, model: body.p_model ?? null, provider: body.p_provider ?? null },
    ai: {
      cost_brl: costOf(cur),
      cost_previous_brl: costOf(prev),
      generations: cur.length,
      generations_previous: prev.length,
      unknown_cost: cur.filter((row) => row.basis === 'unknown').length,
      estimated_cost: cur.filter((row) => row.basis === 'estimated').length,
    },
    credits: {
      distributed: sum(granted.filter((row) => inPeriod(row.created_at)), (row) => num(row.delta)),
      consumed: sum(cur, (row) => row.credits),
      available: state.purchasedBalance + state.subscriptionBalance + sum(state.otherUsers, (row) => num(row.balance)),
    },
    credit_series: periodDays.map((key) => ({
      day: key,
      distributed: sum(granted.filter((row) => inPeriod(row.created_at) && brtDay(new Date(String(row.created_at))) === key), (row) => num(row.delta)),
      consumed: sum(day(cur, key), (row) => row.credits),
    })),
    conversion: { signups: 3, converted: 1, signups_previous: 2, converted_previous: 1 },
    unusual_users: [],
    money: {
      payment_fee_rate: 0.0399,
      min_margin_rate: 0.4,
      received_cents: sum(payments.filter((row) => inPeriod(row.paid_at)), (row) => num(row.amount_cents)),
      expenses_cents: sum(expenses.filter((row) => !row.voided_at), (row) => num(row.amount_cents)),
      expenses,
      mrr_series: months.map((month, index) => ({ month, mrr_cents: index === months.length - 1 ? mrr : Math.round((mrr * (index + 1)) / months.length) })),
      revenue_series: periodDays.map((key) => ({
        day: key,
        revenue_cents: sum(payments.filter((row) => inPeriod(row.paid_at) && brtDay(new Date(String(row.paid_at))) === key), (row) => num(row.amount_cents)),
        ai_cost_brl: costOf(day(cur, key)),
      })),
      plans: state.plans
        .filter((plan) => plan.status !== 'draft')
        .map((plan) => ({
          slug: plan.slug,
          name: plan.name,
          price_cents: num(plan.price_cents),
          users: plan.slug === 'gratis' ? 1 : state.subscriptions.filter((row) => row.plan_slug === plan.slug && row.status === 'active').length,
          received_cents: sum(
            payments.filter((row) => inPeriod(row.paid_at) && state.subscriptions.find((item) => item.id === row.subscription_id)?.plan_slug === plan.slug),
            (row) => num(row.amount_cents),
          ),
          ai_cost_brl: plan.slug === state.subscriptions.find((row) => row.status === 'active')?.plan_slug ? costOf(cur) : 0,
          credits: plan.slug === state.subscriptions.find((row) => row.status === 'active')?.plan_slug ? sum(cur, (row) => row.credits) : 0,
        })),
    },
  }
}

export function demoUsersPage(users: readonly Row[], state: DemoState, body: Row): Row {
  const term = String(body.p_query ?? '').toLowerCase()
  const costs = events(state)
  const rows = users
    .map((user) => ({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      username: user.username,
      avatar_path: user.avatar_path ?? null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? user.created_at,
      suspended_at: user.suspended_at ?? null,
      manual: Boolean(user.manual),
      plan_slug: user.plan_slug ?? 'gratis',
      subscription_status: user.subscription_status ?? null,
      courtesy: false,
      balance: num(user.balance),
      consumed: sum(costs.filter((row) => row.user_id === user.id), (row) => row.credits) || num(user.generations) * 6,
      generations: num(user.generations),
      ai_cost_brl: costOf(costs.filter((row) => row.user_id === user.id)) || num(user.generations) * 0.44,
    }))
    .filter((user) => !term || [user.email, user.username, user.display_name].some((field) => String(field ?? '').toLowerCase().includes(term)))
    .filter((user) => !body.p_plan || user.plan_slug === body.p_plan)
    .filter((user) => !body.p_account || (body.p_account === 'suspended') === (user.suspended_at !== null))
    .filter((user) => !body.p_credits || (body.p_credits === 'with') === (user.balance > 0))
    .filter((user) => body.p_manual === null || body.p_manual === undefined || user.manual === body.p_manual)
  const sorted = [...rows].sort((a, b) => {
    if (body.p_sort === 'active') return b.generations - a.generations
    if (body.p_sort === 'cost') return b.ai_cost_brl - a.ai_cost_brl
    if (body.p_sort === 'credits') return b.consumed - a.consumed
    return String(b.created_at).localeCompare(String(a.created_at))
  })
  const offset = num(body.p_offset)
  return { total: sorted.length, rows: sorted.slice(offset, offset + num(body.p_limit || 25)) }
}

export function demoUserProfile(users: readonly Row[], state: DemoState, userId: string): Row | null {
  const user = users.find((row) => row.id === userId)
  if (!user) return null
  const mine = state.generations.filter((row) => row.user_id === userId)
  const costs = events(state).filter((row) => row.user_id === userId)
  return {
    account: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      username: user.username,
      avatar_path: user.avatar_path ?? null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? user.created_at,
      email_confirmed: true,
      suspended_at: user.suspended_at ?? null,
      suspended_reason: user.suspended_reason ?? null,
      created_by_admin_email: user.manual ? 'demo@kria.ia' : null,
      balance: num(user.balance),
      subscription_balance: num(user.subscription_balance),
      purchased_balance: num(user.purchased_balance),
    },
    plan: { slug: user.plan_slug ?? 'gratis', name: state.plans.find((plan) => plan.slug === (user.plan_slug ?? 'gratis'))?.name ?? 'Grátis' },
    grant: null,
    subscriptions: state.subscriptions
      .filter(() => userId === users[0]?.id)
      .map((row) => ({
        id: row.id,
        plan_slug: row.plan_slug,
        status: row.status,
        price_cents: num(row.price_cents),
        current_period_start: row.current_period_start ?? null,
        current_period_end: row.current_period_end ?? null,
        canceled_at: row.canceled_at ?? null,
        ended_at: null,
        created_at: row.created_at,
      })),
    credits: { received: { signup_bonus: 20 }, consumed: sum(mine.filter((row) => row.status === 'succeeded'), (row) => num(row.credits)), refunded: 0 },
    ledger: state.ledger.slice(0, 30).map((row, index) => ({ id: index + 1, delta: num(row.delta), reason: row.reason, note: row.note ?? null, balance_after: null, created_at: row.created_at })),
    generations: mine.slice(0, 50).map((row) => {
      const event = costs.find((item) => item.generation_id === row.id)
      return {
        id: row.id,
        model_slug: row.model_slug,
        model_name: state.models.find((model) => model.slug === row.model_slug)?.name ?? null,
        kind: row.kind,
        status: row.status,
        credits: num(row.credits),
        error: row.error ?? null,
        created_at: row.created_at,
        cost_brl: event?.cost_brl ?? null,
        cost_basis: event?.basis ?? null,
      }
    }),
    top_models: [...new Set(mine.map((row) => String(row.model_slug)))].map((slug) => ({
      model_slug: slug,
      name: state.models.find((model) => model.slug === slug)?.name ?? null,
      total: mine.filter((row) => row.model_slug === slug).length,
      credits: sum(mine.filter((row) => row.model_slug === slug), (row) => num(row.credits)),
    })),
    ai_cost: {
      total_brl: costOf(costs),
      last_30d_brl: costOf(costs.filter((row) => row.at >= Date.now() - 30 * DAY_MS)),
      metered: costs.filter((row) => row.basis === 'metered').length,
      estimated: costs.filter((row) => row.basis === 'estimated').length,
      unknown: costs.filter((row) => row.basis === 'unknown').length,
    },
    activity: {
      active_days_30d: new Set(mine.map((row) => brtDay(new Date(String(row.created_at))))).size,
      generations_30d: mine.length,
      last_generation_at: mine[0]?.created_at ?? null,
    },
    payments: [],
    admin_actions: [],
  }
}

const featureOfRow = (row: Row) =>
  row.kind === 'text' ? 'text' : row.format_slug ? 'format' : row.persona_id ? 'character' : String(row.kind)

/** `admin_command_center` (0026) no demo: mesmo formato, calculado sobre o estado falso. */
export function buildDemoCommandCenter(state: DemoState, from: Date, to: Date): Row {
  const span = to.getTime() - from.getTime()
  const now = Date.now()
  const today = new Date(`${brtDay(new Date())}T00:00:00-03:00`).getTime()
  const month = new Date(`${brtDay(new Date()).slice(0, 7)}-01T00:00:00-03:00`).getTime()
  const at = (iso: unknown) => new Date(String(iso)).getTime()
  const within = (time: number, start: number, end: number) => time >= start && time < end
  const all = events(state)
  const cur = all.filter((row) => within(row.at, from.getTime(), to.getTime()))
  const generations = state.generations
  const genCur = generations.filter((row) => within(at(row.created_at), from.getTime(), to.getTime()))
  const generationById = new Map(generations.map((row) => [String(row.id), row]))
  const featureOf = (event: DemoEvent) => featureOfRow(generationById.get(event.generation_id) ?? { kind: event.kind })
  const payments = state.subscriptionPayments
  const periodDays = days(from, to)
  const paidIn = (start: number, end: number) => payments.filter((row) => within(at(row.paid_at), start, end))
  const cents = (rows: readonly Row[]) => sum(rows, (row) => num(row.amount_cents))
  const users = [{ id: state.profile.id, balance: state.purchasedBalance + state.subscriptionBalance, created_at: state.profile.created_at }, ...state.otherUsers]
  const generatedBy = new Set(generations.map((row) => String(row.user_id)))
  const group = (rows: readonly DemoEvent[], key: (row: DemoEvent) => string) =>
    [...new Set(rows.map(key))].map((value) => {
      const mine = rows.filter((row) => key(row) === value)
      return { value, generations: mine.length, credits: sum(mine, (row) => row.credits), cost_brl: costOf(mine), users: new Set(mine.map((row) => row.user_id)).size }
    })
  const modelOf = (slug: unknown) => state.models.find((model) => model.slug === slug)
  const providerOf = (slug: unknown) => String(modelOf(slug)?.provider ?? 'fal')
  const topModels = group(cur, (row) => row.model_slug)
    .sort((a, b) => b.cost_brl - a.cost_brl)
    .slice(0, 5)
    .map((row) => row.value)
  const weekStart = (time: number) => {
    const date = new Date(`${brtDay(new Date(time))}T00:00:00Z`)
    return date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS
  }
  const thisWeek = weekStart(now)
  const cohorts = Array.from({ length: 8 }, (_, index) => thisWeek - (7 - index) * 7 * DAY_MS)
    .map((cohort) => {
      const members = users.filter((user) => weekStart(at(user.created_at)) === cohort)
      return {
        cohort: new Date(cohort).toISOString().slice(0, 10),
        size: members.length,
        active: Array.from({ length: 8 }, (_, week) =>
          cohort + week * 7 * DAY_MS > thisWeek
            ? null
            : members.filter((user) =>
                generations.some((row) => String(row.user_id) === String(user.id) && weekStart(at(row.created_at)) === cohort + week * 7 * DAY_MS),
              ).length,
        ),
      }
    })
    .filter((row) => row.size > 0)
  const durations = ['image', 'video', 'text']
    .map((kind) => {
      const seconds = genCur
        .filter((row) => row.kind === kind && row.status === 'succeeded' && row.completed_at)
        .map((row) => (at(row.completed_at) - at(row.created_at)) / 1000)
        .sort((a, b) => a - b)
      const avg = seconds.length ? sum(seconds, (value) => value) / seconds.length : 0
      return { kind, samples: seconds.length, avg_seconds: Math.round(avg * 10) / 10, p90_seconds: seconds[Math.floor(seconds.length * 0.9)] ?? 0 }
    })
    .filter((row) => row.samples > 0)
  const activeSubs = state.subscriptions.filter((row) => row.status === 'active')
  const mrr = sum(activeSubs, (row) => num(row.price_cents))
  const periodPaid = paidIn(from.getTime(), to.getTime())

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    settings: { credit_value_brl: CREDIT_VALUE_BRL, usd_brl: USD_BRL, payment_fee_rate: 0.0399, min_margin_rate: 0.4 },
    plans: state.plans
      .filter((plan) => plan.status !== 'draft')
      .map((plan) => ({ slug: plan.slug, name: plan.name, price_cents: num(plan.price_cents), monthly_credits: num(plan.monthly_credits), status: plan.status ?? 'active' })),
    revenue: {
      series: periodDays.map((day) => {
        const start = new Date(`${day}T00:00:00-03:00`).getTime()
        const rows = paidIn(start, start + DAY_MS)
        return {
          day,
          gross_cents: cents(rows),
          refunds_cents: cents(rows.filter((row) => row.status === 'refunded')),
          previous_gross_cents: cents(paidIn(start - span, start - span + DAY_MS)),
        }
      }),
      gross_cents: cents(periodPaid),
      refunds_cents: cents(periodPaid.filter((row) => row.status === 'refunded')),
      previous_gross_cents: cents(paidIn(from.getTime() - span, from.getTime())),
      previous_refunds_cents: 0,
      lifetime_gross_cents: cents(payments),
      lifetime_refunds_cents: cents(payments.filter((row) => row.status === 'refunded')),
      month_received_cents: cents(paidIn(month, now + 1).filter((row) => row.status !== 'refunded')),
      projected_next_month_cents: sum(activeSubs.filter((row) => !row.canceled_at), (row) => num(row.price_cents)),
      at_risk_cents: sum(state.subscriptions.filter((row) => row.status === 'past_due'), (row) => num(row.price_cents)),
      mrr_start_cents: mrr,
      mrr_lost_cents: 0,
      churn_30d: { base: activeSubs.length, lost: 0, base_cents: mrr, lost_cents: 0 },
      expenses_90d_cents: sum(demoExpenses.filter((row) => !row.voided_at), (row) => num(row.amount_cents)),
      expenses_by_day: [],
      marketing_cents: sum(demoExpenses.filter((row) => !row.voided_at && row.category === 'marketing'), (row) => num(row.amount_cents)),
      new_paying: activeSubs.filter((row) => within(at(row.created_at), from.getTime(), to.getTime())).length,
      paying_ai_cost_brl: costOf(cur.filter((row) => row.user_id === String(state.profile.id))),
    },
    ai: {
      cost_today_brl: costOf(all.filter((row) => row.at >= today)),
      cost_month_brl: costOf(all.filter((row) => row.at >= month)),
      cost_brl: costOf(cur),
      credits: sum(cur, (row) => row.credits),
      events: cur.length,
      unknown: cur.filter((row) => row.basis === 'unknown').length,
      series: periodDays.map((day) => {
        const rows = cur.filter((row) => brtDay(new Date(row.at)) === day)
        return { day, cost_brl: costOf(rows), generations: rows.length }
      }),
      by_feature: group(cur, featureOf).map((row) => ({ feature: row.value, generations: row.generations, credits: row.credits, cost_brl: row.cost_brl, users: row.users })),
      by_model: group(cur, (row) => row.model_slug).map((row) => ({
        model_slug: row.value,
        name: String(modelOf(row.value)?.name ?? row.value),
        provider: providerOf(row.value),
        generations: row.generations,
        credits: row.credits,
        cost_brl: row.cost_brl,
      })),
      model_series: periodDays.flatMap((day) =>
        topModels.map((slug) => ({ day, model_slug: slug, cost_brl: costOf(cur.filter((row) => row.model_slug === slug && brtDay(new Date(row.at)) === day)) })),
      ),
      top_users: group(cur, (row) => row.user_id)
        .sort((a, b) => b.cost_brl - a.cost_brl)
        .slice(0, 10)
        .map((row) => {
          const other = state.otherUsers.find((user) => String(user.id) === row.value)
          return {
            user_id: row.value,
            email: other ? String(other.email) : 'demo@kria.ia',
            plan_name: other ? String(other.plan_name ?? 'Grátis') : 'Pro',
            plan_slug: other ? String(other.plan_slug ?? 'gratis') : 'pro',
            generations: row.generations,
            credits: row.credits,
            cost_brl: row.cost_brl,
          }
        }),
    },
    users: {
      dau: new Set(generations.filter((row) => at(row.created_at) >= today).map((row) => String(row.user_id))).size,
      wau: new Set(generations.filter((row) => at(row.created_at) >= thisWeek).map((row) => String(row.user_id))).size,
      mau: new Set(generations.filter((row) => at(row.created_at) >= now - 30 * DAY_MS).map((row) => String(row.user_id))).size,
      active_period: new Set(genCur.map((row) => String(row.user_id))).size,
      generations_period: genCur.length,
      never_used: users.filter((user) => !generatedBy.has(String(user.id))).length,
      used_ai: users.filter((user) => generatedBy.has(String(user.id))).length,
      near_limit: users.filter((user) => num(user.balance) > 0 && num(user.balance) < 200).length,
      exhausted: users.filter((user) => num(user.balance) === 0 && generatedBy.has(String(user.id))).length,
      active_series: periodDays.map((day) => ({
        day,
        users: new Set(genCur.filter((row) => brtDay(new Date(at(row.created_at))) === day).map((row) => String(row.user_id))).size,
      })),
      cohorts,
    },
    operations: {
      total: genCur.length,
      succeeded: genCur.filter((row) => row.status === 'succeeded').length,
      failed: genCur.filter((row) => row.status === 'failed').length,
      open: generations.filter((row) => row.status === 'queued' || row.status === 'running').length,
      stuck: 0,
      failed_billed: 0,
      failed_billed_cost_brl: 0,
      duration: durations,
      providers: [...new Set(state.models.map((model) => String(model.provider ?? 'fal')))].map((provider) => {
        const mine = generations.filter((row) => providerOf(row.model_slug) === provider)
        const recent = mine.filter((row) => at(row.created_at) >= now - DAY_MS)
        const last = (status: string) =>
          mine
            .filter((row) => row.status === status)
            .map((row) => String(row.completed_at ?? row.created_at))
            .sort()
            .at(-1) ?? null
        return { provider, total_24h: recent.length, failed_24h: recent.filter((row) => row.status === 'failed').length, last_success_at: last('succeeded'), last_failure_at: last('failed') }
      }),
      errors: genCur
        .filter((row) => row.status === 'failed')
        .slice(0, 15)
        .map((row) => ({
          id: String(row.id),
          at: String(row.created_at),
          model_name: String(modelOf(row.model_slug)?.name ?? row.model_slug),
          provider: providerOf(row.model_slug),
          kind: String(row.kind),
          error: String(row.error ?? 'sem mensagem'),
          email: 'demo@kria.ia',
        })),
    },
  }
}
