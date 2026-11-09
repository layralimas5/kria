// Listas do admin no modo demo: o mesmo formato de `admin_generations` e `admin_subscriptions`
// (0022), filtrando o estado falso do navegador. Nada aqui vem do banco.

import type { DemoState, Row } from './demoData'

const text = (value: unknown) => String(value ?? '')
const matches = (email: unknown, filter: unknown) => !filter || text(email).toLowerCase().includes(text(filter).trim().toLowerCase())

function page<T>(rows: readonly T[], body: Row) {
  const limit = Math.min(Math.max(Number(body.p_limit ?? 50), 1), 100)
  const offset = Math.max(Number(body.p_offset ?? 0), 0)
  return rows.slice(offset, offset + limit)
}

export function demoGenerations(state: DemoState, email: string, body: Row): Row {
  const modelName = (slug: unknown) => text(state.models.find((model) => model.slug === slug)?.name ?? slug)
  const rows = state.generations
    .filter((row) => (!body.p_status || row.status === body.p_status) && (!body.p_model || row.model_slug === body.p_model) && matches(email, body.p_email))
    .sort((a, b) => text(b.created_at).localeCompare(text(a.created_at)))
  return {
    total: rows.length,
    rows: page(rows, body).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      email,
      model_slug: row.model_slug,
      model_name: modelName(row.model_slug),
      kind: row.kind,
      status: row.status,
      credits: row.credits,
      prompt: text(row.prompt).slice(0, 160),
      error: row.error ?? null,
      format_slug: row.format_slug ?? null,
      billed_on_failure: false,
      input_tokens: row.input_tokens ?? null,
      output_tokens: row.output_tokens ?? null,
      cost_usd: row.provider_cost_usd ?? null,
      created_at: row.created_at,
      completed_at: row.completed_at ?? null,
      duration_seconds: row.completed_at ? Math.round((Date.parse(text(row.completed_at)) - Date.parse(text(row.created_at))) / 1000) : null,
    })),
  }
}

export function demoSubscriptions(state: DemoState, email: string, body: Row): Row {
  const planName = (slug: unknown) => text(state.plans.find((plan) => plan.slug === slug)?.name ?? slug)
  const all = state.subscriptions.map((row) => {
    const payments = state.subscriptionPayments.filter((payment) => payment.subscription_id === row.id && payment.status === 'confirmed')
    return {
      id: row.id,
      user_id: row.user_id,
      email,
      plan_slug: row.plan_slug,
      plan_name: planName(row.plan_slug),
      plan_version: row.plan_version ?? 1,
      status: row.status,
      price_cents: row.price_cents,
      monthly_credits: row.monthly_credits,
      current_period_end: row.current_period_end ?? null,
      canceled_at: row.canceled_at ?? null,
      ended_at: row.ended_at ?? null,
      created_at: row.created_at,
      payments: payments.length,
      last_paid_at: payments.map((payment) => text(payment.paid_at)).sort().at(-1) ?? null,
      paid_cents: payments.reduce((sum, payment) => sum + Number(payment.amount_cents ?? 0), 0),
    }
  })
  const counts: Record<string, number> = {}
  for (const row of all) counts[text(row.status)] = (counts[text(row.status)] ?? 0) + 1
  const rows = all.filter((row) => (!body.p_status || row.status === body.p_status) && matches(email, body.p_email))
  return { total: rows.length, counts, rows: page(rows, body) }
}
