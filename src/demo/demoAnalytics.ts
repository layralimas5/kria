// Analytics no modo demo: o mesmo formato de `admin_analytics` (0020), com números de exemplo
// estáveis para conferir as telas. Nada aqui vem do banco nem vai para a produção.

import { brtDay } from '@/domain/adminDashboard'
import type { DemoState, Row } from './demoData'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

/** Sequência fixa (sem Math.random): a mesma tela a cada recarga. */
function seeded(seed: number) {
  let value = seed
  return (max: number) => {
    value = (value * 9301 + 49297) % 233280
    return Math.floor((value / 233280) * max)
  }
}

export function buildDemoAnalytics(state: DemoState, from: Date, to: Date): Row {
  const next = seeded(42)
  const days: string[] = []
  for (let at = from.getTime(); at < to.getTime(); at += DAY_MS) days.push(brtDay(new Date(at)))

  const tools = state.models.map((model, index) => {
    const total = Math.max(0, 140 - index * 17 + next(30))
    return {
      model_slug: String(model.slug),
      name: String(model.name),
      kind: String(model.kind),
      total,
      users: Math.max(1, Math.round(total / (3 + next(3)))),
      succeeded: total - Math.round(total * 0.04),
      failed: Math.round(total * 0.04),
      credits: total * Number(model.credits ?? 1),
      cost_usd: Number((total * (model.kind === 'video' ? 0.28 : model.kind === 'text' ? 0.012 : 0.03)).toFixed(4)),
      previous_total: Math.max(0, total - 20 + next(40)),
    }
  }).sort((a, b) => b.total - a.total)
  const textTools = tools.filter((tool) => tool.kind === 'text' && tool.total > 0)

  const weekStart = new Date(to.getTime() - 7 * WEEK_MS)
  const cohorts = Array.from({ length: 8 }, (_, index) => {
    const size = 18 + next(25)
    const elapsed = 7 - index
    return {
      week_start: new Date(weekStart.getTime() + index * WEEK_MS).toISOString(),
      size,
      weeks: Array.from({ length: elapsed + 1 }, (_, week) => (week === 0 ? Math.round(size * 0.72) : Math.round(size * (0.42 / Math.sqrt(week)) + next(3)))),
    }
  })

  const month = new Date()
  const subscriptions = Array.from({ length: 6 }, (_, index) => {
    const at = new Date(month.getFullYear(), month.getMonth() - 5 + index, 1)
    return { month: `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`, live_at_start: 20 + index * 9, new: 9 + next(8), canceled: 1 + next(4) }
  })

  const people = ['marina@exemplo.com', 'joao.criador@exemplo.com', 'loja.bella@exemplo.com', 'afiliado.top@exemplo.com', 'studio.ana@exemplo.com', 'pedro.ugc@exemplo.com']
  const tokenSeries = days.map((day) => ({ day, input: 20_000 + next(40_000), output: 8_000 + next(15_000) }))
  const creditSeries = days.map((day) => ({ day, granted: next(4) === 0 ? 4_800 + next(3_000) : 300 + next(400), spent: 300 + next(700) }))
  const input = tokenSeries.reduce((sum, day) => sum + day.input, 0)
  const output = tokenSeries.reduce((sum, day) => sum + day.output, 0)
  const granted = creditSeries.reduce((sum, day) => sum + day.granted, 0)
  const spent = creditSeries.reduce((sum, day) => sum + day.spent, 0)

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    retention: {
      dau: 23,
      wau: 71,
      mau: 164,
      logins_7d: 96,
      logins_30d: 231,
      ever_active: 288,
      total_users: 412,
      returning: [
        { day: 1, eligible: 120, returned: 46 },
        { day: 7, eligible: 98, returned: 27 },
        { day: 30, eligible: 41, returned: 9 },
      ],
      activation: { signed_up: 132, activated: 94, activated_24h: 71 },
      cohorts,
      subscriptions,
      dormant_count: 57,
      dormant: people.slice(0, 5).map((email, index) => ({
        user_id: `demo-${index}`,
        email,
        last_activity_at: new Date(Date.now() - (15 + index * 4) * DAY_MS).toISOString(),
        last_sign_in_at: new Date(Date.now() - (9 + index * 3) * DAY_MS).toISOString(),
        actions: 40 - index * 6,
        plan_slug: index < 2 ? 'pro' : 'gratis',
        balance: index < 2 ? 210 - index * 50 : 12,
      })),
    },
    tools: {
      total: tools.reduce((sum, tool) => sum + tool.total, 0),
      previous_total: tools.reduce((sum, tool) => sum + tool.previous_total, 0),
      multiplier_exports: 38,
      by_tool: tools,
      by_plan: [
        { plan_slug: 'pro', total: 410, users: 52, image: 220, video: 96, text: 94 },
        { plan_slug: 'gratis', total: 233, users: 141, image: 160, video: 8, text: 65 },
        { plan_slug: 'starter', total: 180, users: 33, image: 101, video: 41, text: 38 },
        { plan_slug: 'studio', total: 122, users: 9, image: 51, video: 49, text: 22 },
      ],
      by_format: [
        { slug: 'imovel-tour', total: 61, users: 14 },
        { slug: 'produto-vitrine', total: 47, users: 19 },
        { slug: 'prato-do-dia', total: 22, users: 7 },
      ],
      series: days.map((day) => ({ day, image: 10 + next(25), video: 2 + next(9), text: 4 + next(12), users: 12 + next(20) })),
    },
    credits: {
      by_reason: [
        { reason: 'subscription_grant', entries: 74, credited: Math.round(granted * 0.82), debited: 0, subscription_net: Math.round(granted * 0.82), purchased_net: 0 },
        { reason: 'signup_bonus', entries: 94, credited: Math.round(granted * 0.1), debited: 0, subscription_net: 0, purchased_net: Math.round(granted * 0.1) },
        { reason: 'purchase', entries: 6, credited: Math.round(granted * 0.08), debited: 0, subscription_net: 0, purchased_net: Math.round(granted * 0.08) },
        { reason: 'generation', entries: 945, credited: 0, debited: spent + 310, subscription_net: -(spent + 120), purchased_net: -190 },
        { reason: 'generation_refund', entries: 38, credited: 310, debited: 0, subscription_net: 120, purchased_net: 190 },
        { reason: 'subscription_expire', entries: 12, credited: 0, debited: 1_840, subscription_net: -1_840, purchased_net: 0 },
      ],
      granted,
      spent,
      expired: 1_840,
      outstanding: 18_420,
      outstanding_subscription: 15_100,
      outstanding_purchased: 3_320,
      wallets_with_balance: 203,
      held: 64,
      series: creditSeries,
      top_spenders: people.map((email, index) => ({ user_id: `demo-s${index}`, email, spent: 2_100 - index * 280, generations: 160 - index * 21, balance: 400 - index * 50 })),
    },
    tokens: {
      input,
      output,
      measured: textTools.reduce((sum, tool) => sum + tool.succeeded, 0),
      unmeasured: 3,
      cost_usd: Number(((input * 4 + output * 20) / 1_000_000).toFixed(4)),
      by_model: textTools.map((tool, index) => ({
        model_slug: tool.model_slug,
        name: tool.name,
        requests: tool.total,
        input: Math.round(input / (index + 2)),
        output: Math.round(output / (index + 2)),
        cost_usd: Number((((input / (index + 2)) * 4 + (output / (index + 2)) * 20) / 1_000_000).toFixed(4)),
      })),
      series: tokenSeries,
      top_users: people.map((email, index) => ({ user_id: `demo-t${index}`, email, requests: 90 - index * 12, input: 180_000 - index * 25_000, output: 70_000 - index * 9_000, cost_usd: Number((2.1 - index * 0.3).toFixed(4)) })),
    },
  }
}
