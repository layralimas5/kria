// Guarda de gasto no modo demo: mesmo contrato de `my_usage`, `admin_spend_guard` e da trava
// em `create_generation` (0016), calculado sobre as gerações do navegador.

import type { DemoState, Row } from './demoData'

export interface DemoRefusal {
  readonly status: number
  readonly code: string
  readonly message: string
}

const PAUSED: DemoRefusal = {
  status: 503,
  code: 'generation_paused',
  message: 'As gerações estão pausadas por alguns instantes. Tente de novo mais tarde; nenhum crédito foi usado.',
}

const dayStart = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}
const monthStart = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

const counts = (generation: Row) => generation.status !== 'failed' || generation.billed_on_failure === true

function creditsSince(state: DemoState, since: Date): number {
  return state.generations
    .filter((item) => item.status !== 'failed' && new Date(String(item.created_at)) >= since)
    .reduce((sum, item) => sum + Number(item.credits), 0)
}

function spendSince(state: DemoState, since: Date): number {
  const value = Number(state.pricing.credit_value_brl) / Number(state.pricing.usd_brl)
  return state.generations
    .filter((item) => counts(item) && new Date(String(item.created_at)) >= since)
    .reduce((sum, item) => sum + Number(item.credits) * value, 0)
}

const limitOf = (value: unknown) => (value === null || value === undefined ? null : Number(value))

/** Nulo quando pode gerar; senão, o mesmo erro que a function devolveria. */
export function demoRefusal(state: DemoState, plan: Row, credits: number): DemoRefusal | null {
  if (state.pricing.generation_paused) return PAUSED
  const daily = limitOf(plan.daily_credit_limit)
  if (daily !== null && creditsSince(state, dayStart()) + credits > daily) {
    return { status: 429, code: 'daily_limit_reached', message: 'Você chegou ao limite de consumo de hoje do seu plano. Ele volta à meia-noite.' }
  }
  const monthly = limitOf(plan.monthly_credit_limit)
  if (monthly !== null && creditsSince(state, monthStart()) + credits > monthly) {
    return { status: 429, code: 'monthly_limit_reached', message: 'Você chegou ao limite de consumo do mês do seu plano. Ele volta no dia 1º.' }
  }
  return null
}

export function demoUsage(state: DemoState, plan: Row): Row {
  const nextDay = dayStart()
  nextDay.setDate(nextDay.getDate() + 1)
  const nextMonth = monthStart()
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  return {
    plan_slug: plan.slug,
    daily_limit: limitOf(plan.daily_credit_limit),
    monthly_limit: limitOf(plan.monthly_credit_limit),
    used_today: creditsSince(state, dayStart()),
    used_month: creditsSince(state, monthStart()),
    day_resets_at: nextDay.toISOString(),
    month_resets_at: nextMonth.toISOString(),
    paused: Boolean(state.pricing.generation_paused),
  }
}

export function demoSpendGuard(state: DemoState): Row {
  const { pricing } = state
  return {
    daily_cost_cap_usd: limitOf(pricing.daily_cost_cap_usd),
    monthly_cost_cap_usd: limitOf(pricing.monthly_cost_cap_usd),
    cost_alert_ratio: Number(pricing.cost_alert_ratio ?? 0.8),
    generation_paused: Boolean(pricing.generation_paused),
    paused_reason: pricing.paused_reason ?? null,
    spent_today_usd: Number(spendSince(state, dayStart()).toFixed(4)),
    spent_month_usd: Number(spendSince(state, monthStart()).toFixed(4)),
    failed_billed_month_usd: 0,
    estimated_month_count: state.generations.filter((item) => counts(item) && new Date(String(item.created_at)) >= monthStart()).length,
    top_today: [{ user_id: 'demo', email: 'demo@kria.ia', credits: creditsSince(state, dayStart()), spend_usd: Number(spendSince(state, dayStart()).toFixed(4)) }],
  }
}
