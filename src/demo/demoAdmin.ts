// Dashboard da operação no modo demo: o mesmo formato de `admin_dashboard` (0014), calculado
// sobre o estado falso do navegador. Só existe para conferir as telas; nada vem do banco.

import { brtDay } from '@/domain/adminDashboard'
import type { DemoState, Row } from './demoData'

const DAY_MS = 24 * 60 * 60 * 1000
const num = (value: unknown) => Number(value ?? 0)
const sum = <T>(rows: readonly T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0)

export function buildDemoDashboard(state: DemoState, users: readonly Row[], from: Date, to: Date): Row {
  const span = to.getTime() - from.getTime()
  const prevFrom = new Date(from.getTime() - span)
  const between = (iso: unknown, start: Date, end: Date) => {
    const at = new Date(String(iso)).getTime()
    return at >= start.getTime() && at < end.getTime()
  }
  const inPeriod = (iso: unknown) => between(iso, from, to)
  const inPrevious = (iso: unknown) => between(iso, prevFrom, from)
  const since = (ms: number) => (iso: unknown) => new Date(String(iso)).getTime() >= Date.now() - ms

  const gens = state.generations.filter((row) => inPeriod(row.created_at))
  const succeeded = gens.filter((row) => row.status === 'succeeded')
  const live = users.filter((user) => user.subscription_status === 'active' || user.subscription_status === 'past_due')
  const priceOf = (slug: unknown) => num(state.plans.find((plan) => plan.slug === slug)?.price_cents)
  const received = [
    ...state.subscriptionPayments
      .filter((row) => row.status !== 'refunded')
      .map((row) => ({
        cents: num(row.amount_cents),
        at: row.paid_at,
        source: 'subscription',
        plan_slug: state.subscriptions.find((subscription) => subscription.id === row.subscription_id)?.plan_slug ?? null,
      })),
    ...state.purchases.filter((row) => row.status === 'paid').map((row) => ({ cents: num(row.price_cents), at: row.paid_at, source: 'pack', plan_slug: null })),
  ]
  const receivedIn = received.filter((row) => inPeriod(row.at))

  const days: string[] = []
  for (let at = from.getTime(); at < to.getTime(); at += DAY_MS) days.push(brtDay(new Date(at)))
  const onDay = (iso: unknown, day: string) => iso !== null && iso !== undefined && brtDay(new Date(String(iso))) === day

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    users: {
      total: users.length,
      new_in_period: users.filter((user) => inPeriod(user.created_at)).length,
      new_previous: users.filter((user) => inPrevious(user.created_at)).length,
      new_today: users.filter((user) => brtDay(new Date(String(user.created_at))) === brtDay(new Date())).length,
      new_7d: users.filter((user) => since(7 * DAY_MS)(user.created_at)).length,
      new_30d: users.filter((user) => since(30 * DAY_MS)(user.created_at)).length,
      active_1d: state.generations.some((row) => since(DAY_MS)(row.created_at)) ? 1 : 0,
      active_30d: state.generations.some((row) => since(30 * DAY_MS)(row.created_at)) ? 1 : 0,
      active_in_period: gens.length > 0 ? 1 : 0,
      paying: live.length,
      onboarded_in_period: users.filter((user) => inPeriod(user.created_at)).length,
      first_generation_in_period: users.filter((user) => inPeriod(user.created_at) && num(user.generations) > 0).length,
      converted_in_period: users.filter((user) => inPeriod(user.created_at) && user.plan_slug !== null).length,
    },
    generations: {
      total: gens.length,
      succeeded: succeeded.length,
      failed: gens.filter((row) => row.status === 'failed').length,
      open: gens.filter((row) => row.status === 'queued' || row.status === 'running').length,
      image: gens.filter((row) => row.kind === 'image').length,
      video: gens.filter((row) => row.kind === 'video').length,
      text: gens.filter((row) => row.kind === 'text').length,
      today: state.generations.filter((row) => brtDay(new Date(String(row.created_at))) === brtDay(new Date())).length,
      month: state.generations.filter((row) => since(30 * DAY_MS)(row.created_at)).length,
      credits_consumed: sum(succeeded, (row) => num(row.credits)),
      previous_total: state.generations.filter((row) => inPrevious(row.created_at)).length,
      previous_failed: state.generations.filter((row) => inPrevious(row.created_at) && row.status === 'failed').length,
    },
    plan_distribution: state.plans.map((plan) => ({
      slug: plan.slug,
      name: plan.name,
      users: plan.slug === 'gratis' ? users.length - live.length : live.filter((user) => user.plan_slug === plan.slug).length,
    })),
    by_model: state.models
      .map((model) => {
        const rows = gens.filter((row) => row.model_slug === model.slug)
        return {
          model_slug: model.slug,
          name: model.name,
          kind: model.kind,
          provider: model.provider ?? 'fal',
          total: rows.length,
          failed: rows.filter((row) => row.status === 'failed').length,
          credits: sum(rows.filter((row) => row.status === 'succeeded'), (row) => num(row.credits)),
          cost_usd: 0,
        }
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total),
    series: days.map((day) => ({
      day,
      signups: users.filter((user) => onDay(user.created_at, day)).length,
      succeeded: gens.filter((row) => row.status === 'succeeded' && onDay(row.created_at, day)).length,
      failed: gens.filter((row) => row.status === 'failed' && onDay(row.created_at, day)).length,
      credits: sum(succeeded.filter((row) => onDay(row.created_at, day)), (row) => num(row.credits)),
      new_subscriptions: 0,
      cancellations: 0,
      revenue_cents: sum(receivedIn.filter((row) => onDay(row.at, day)), (row) => row.cents),
      api_cost_usd: 0,
    })),
    top_consumers: [{ user_id: String(users[0]?.id), email: users[0]?.email ?? null, credits: sum(succeeded, (row) => num(row.credits)), generations: succeeded.length }].filter(
      (row) => row.credits > 0,
    ),
    finance: {
      mrr_cents: sum(live, (user) => priceOf(user.plan_slug)),
      past_due: live.filter((user) => user.subscription_status === 'past_due').length,
      received_cents: sum(receivedIn, (row) => row.cents),
      received_previous_cents: sum(received.filter((row) => inPrevious(row.at)), (row) => row.cents),
      received_total_cents: sum(received, (row) => row.cents),
      subscription_received_cents: sum(receivedIn.filter((row) => row.source === 'subscription'), (row) => row.cents),
      pack_received_cents: sum(receivedIn.filter((row) => row.source === 'pack'), (row) => row.cents),
      payments_count: receivedIn.length,
      refunds_cents: 0,
      new_subscriptions: state.subscriptions.filter((row) => row.status !== 'pending' && inPeriod(row.created_at)).length,
      cancellations: state.subscriptions.filter((row) => row.canceled_at && inPeriod(row.canceled_at)).length,
      cancellations_previous: 0,
      churn_base: 0,
      churn_lost: 0,
      // O demo não tem custo cadastrado: aparece como "sem custo", igual a um modelo sem conferência.
      api_cost_usd: 0,
      api_cost_previous_usd: 0,
      api_cost_unknown: succeeded.length,
      usd_brl: num(state.pricing.usd_brl),
      payment_fee_rate: 0.035,
      by_plan: state.plans
        .filter((plan) => plan.public)
        .map((plan) => {
          const subscribers = live.filter((user) => user.plan_slug === plan.slug)
          const paid = receivedIn.filter((row) => row.plan_slug === plan.slug)
          return { slug: plan.slug, name: plan.name, subscribers: subscribers.length, mrr_cents: subscribers.length * num(plan.price_cents), received_cents: sum(paid, (row) => row.cents) }
        }),
    },
  }
}
