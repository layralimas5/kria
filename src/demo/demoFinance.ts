// Preços v2 no modo demo (0018): cota de exportação, financeiro e cotação por custo, com o mesmo
// contrato e as mesmas recusas das funções do banco, calculados sobre o estado do navegador.

import type { DemoState, Row } from './demoData'
import { fullUseMarginOf, modelTrusted, policyOf } from './demoPricingV3'

const FINANCE_DEFAULTS: Row = {
  tax_rate: 0.06,
  fixed_costs_cents: 0,
  infra_costs_cents: 0,
  storage_costs_cents: 0,
  render_cost_cents_per_export: 0,
  pro_labore_cents: 0,
  reserve_rate: 0.1,
  min_margin_rate: 0.6,
  payment_fee_fixed_cents: 0,
  storage_cents_per_subscriber: 0,
  transfer_cents_per_subscriber: 0,
  other_variable_cents_per_subscriber: 0,
}
const STALE_MINUTES = 30

const monthStart = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

type Refusal = { readonly code: string }
const refuse = (code: string): Refusal => ({ code })
export const isRefusal = (value: unknown): value is Refusal => typeof value === 'object' && value !== null && 'code' in value

export function financeSettings(state: DemoState): Row {
  return { ...FINANCE_DEFAULTS, ...(state.finance ?? {}) }
}

function exportsUsed(state: DemoState): number {
  const since = monthStart()
  const staleBefore = Date.now() - STALE_MINUTES * 60_000
  return state.multiplierExports.filter((item) => {
    const created = new Date(String(item.created_at))
    return created >= since && (item.status === 'done' || (item.status === 'started' && created.getTime() > staleBefore))
  }).length
}

export function exportUsage(state: DemoState, plan: Row): Row {
  return { exports_limit: plan.max_exports_month ?? null, exports_used: exportsUsed(state) }
}

export function startExport(state: DemoState, plan: Row, body: Row): Row | Refusal {
  const key = String(body.p_idempotency_key ?? '')
  if (key.length < 8 || key.length > 80) return refuse('invalid_idempotency_key')
  if (!state.multiplierVariations.some((item) => item.id === body.p_variation_id)) return refuse('variation_not_found')
  const limit = plan.max_exports_month === null || plan.max_exports_month === undefined ? null : Number(plan.max_exports_month)
  const existing = state.multiplierExports.find((item) => item.idempotency_key === key)
  const used = exportsUsed(state)
  if (existing) return { id: existing.id, used, limit }
  if (limit !== null && used >= limit) return refuse('export_limit_reached')
  const open = state.multiplierExports.filter((item) => item.status === 'started' && new Date(String(item.created_at)).getTime() > Date.now() - STALE_MINUTES * 60_000)
  if (open.length >= Number(plan.max_concurrent ?? 3)) return refuse('too_many_exports')
  const row = { id: crypto.randomUUID(), variation_id: body.p_variation_id, idempotency_key: key, status: 'started', created_at: new Date().toISOString() }
  state.multiplierExports.push(row)
  return { id: row.id, used: used + 1, limit }
}

export function settleExport(state: DemoState, body: Row, status: 'done' | 'failed'): boolean {
  const row = state.multiplierExports.find((item) => item.id === body.p_export_id && item.status === 'started')
  if (!row) return false
  Object.assign(row, {
    status,
    finished_at: new Date().toISOString(),
    render_ms: body.p_render_ms ?? null,
    bytes: body.p_bytes ?? null,
    duration_seconds: body.p_duration_seconds ?? null,
    width: body.p_width ?? null,
    height: body.p_height ?? null,
  })
  return true
}

/** Mesma conta do banco: custo (US$ × câmbio) ou preço atual × custo do crédito, × segurança ÷ orçamento. */
export function modelQuotes(state: DemoState): Row {
  const settings = policyOf(state)
  const usdBrl = Number(settings.usd_brl)
  return {
    settings: {
      usd_brl: usdBrl,
      safety_factor: settings.safety_factor,
      credit_budget_brl: settings.credit_budget_brl,
      legacy_cost_per_credit_brl: settings.legacy_cost_per_credit_brl,
      cost_stale_days: settings.cost_stale_days,
      credit_scale: settings.credit_scale,
      scale_activated_at: null,
      welcome_credits: settings.welcome_credits,
      next_welcome_credits: settings.next_welcome_credits,
      require_trusted_cost: settings.require_trusted_cost,
      max_operation_cost_usd: settings.max_operation_cost_usd,
      welcome_daily_cap: settings.welcome_daily_cap,
      price_drift_tolerance: settings.price_drift_tolerance,
    },
    models: state.models.map((model) => {
      const cost = model.provider_cost_usd === null || model.provider_cost_usd === undefined ? null : Number(model.provider_cost_usd)
      const estimated = cost === null ? Number(model.credits) * settings.legacy_cost_per_credit_brl : cost * usdBrl
      const checkedAt = (model.cost_checked_at as string | undefined) ?? null
      return {
        slug: model.slug,
        name: model.name,
        kind: model.kind,
        provider: model.provider,
        endpoint: model.endpoint,
        defaults: model.defaults ?? {},
        active: model.active,
        credits: model.credits,
        provider_cost_usd: cost,
        cost_checked_at: checkedAt,
        cost_source: model.cost_source ?? null,
        basis: cost === null ? 'legacy_estimate' : 'provider_cost',
        estimated_brl: Number(estimated.toFixed(4)),
        protected_brl: Number((estimated * settings.safety_factor).toFixed(4)),
        quoted_credits: Math.max(1, Math.ceil(Number(((estimated * settings.safety_factor) / settings.credit_budget_brl).toFixed(6)))),
        stale: checkedAt === null || Date.now() - new Date(checkedAt).getTime() > settings.cost_stale_days * 86_400_000,
        pricing: model.pricing ?? null,
        cost_drift_at: model.cost_drift_at ?? null,
        cost_drift_note: model.cost_drift_note ?? null,
        trusted: modelTrusted(model, settings.cost_stale_days),
        avg_input_tokens: null,
        avg_output_tokens: null,
        max_output_tokens: null,
        reconciled: 0,
      }
    }),
  }
}

/** Financeiro do período sobre o estado do demo. Custo de API no pior caso (o demo não tem custo cadastrado). */
export function demoFinance(state: DemoState, users: readonly Row[], from: Date, to: Date): Row {
  const inPeriod = (value: unknown) => {
    const at = new Date(String(value))
    return at >= from && at < to
  }
  const span = to.getTime() - from.getTime()
  const prevFrom = new Date(from.getTime() - span)
  const usdBrl = Number(state.pricing.usd_brl)
  const worstCase = Number(state.pricing.credit_value_brl) / usdBrl
  const billed = state.generations.filter((item) => item.status === 'succeeded' && inPeriod(item.created_at))
  const costOf = (item: Row) => (item.provider_cost_usd === null || item.provider_cost_usd === undefined ? Number(item.credits) * worstCase : Number(item.provider_cost_usd))
  const payments = state.subscriptionPayments.filter((item) => item.status === 'confirmed')
  const revenue = payments.filter((item) => inPeriod(item.paid_at)).reduce((sum, item) => sum + Number(item.amount_cents), 0)
  const revenuePrevious = payments
    .filter((item) => new Date(String(item.paid_at)) >= prevFrom && new Date(String(item.paid_at)) < from)
    .reduce((sum, item) => sum + Number(item.amount_cents), 0)
  const live = state.subscriptions.filter((item) => item.status === 'active' || item.status === 'past_due')
  const apiCost = billed.reduce((sum, item) => sum + costOf(item), 0)
  const exportsDone = state.multiplierExports.filter((item) => item.status === 'done' && inPeriod(item.created_at))
  const demoUser = users[0]
  const planOf = (slug: unknown) => state.plans.find((plan) => plan.slug === slug)
  const livePlan = planOf(live[0]?.plan_slug) ?? state.plans[0]!

  return {
    period: { from: from.toISOString(), to: to.toISOString(), days: Number((span / 86_400_000).toFixed(2)) },
    usd_brl: usdBrl,
    payment_fee_rate: 0.035,
    credit_scale: 1,
    credit_budget_brl: 0.01,
    settings: financeSettings(state),
    revenue_cents: revenue,
    revenue_previous_cents: revenuePrevious,
    refunds_cents: 0,
    mrr_cents: live.reduce((sum, item) => sum + Number(item.price_cents ?? 0), 0),
    active_subscriptions: live.length,
    api_cost_usd: Number(apiCost.toFixed(4)),
    api_cost_previous_usd: 0,
    api_cost_estimated_count: billed.filter((item) => item.provider_cost_usd === null || item.provider_cost_usd === undefined).length,
    failed_billed_usd: 0,
    credits_consumed: billed.reduce((sum, item) => sum + Number(item.credits), 0),
    exports_done: exportsDone.length,
    exports_failed: state.multiplierExports.filter((item) => item.status === 'failed' && inPeriod(item.created_at)).length,
    export_render_ms: exportsDone.reduce((sum, item) => sum + Number(item.render_ms ?? 0), 0),
    export_bytes: exportsDone.reduce((sum, item) => sum + Number(item.bytes ?? 0), 0),
    export_seconds: exportsDone.reduce((sum, item) => sum + Number(item.duration_seconds ?? 0), 0),
    export_resolutions: exportsDone.reduce<Record<string, number>>((sizes, item) => {
      if (item.width && item.height) sizes[`${item.width}x${item.height}`] = (sizes[`${item.width}x${item.height}`] ?? 0) + 1
      return sizes
    }, {}),
    by_plan: state.plans.map((plan) => ({
      slug: plan.slug,
      name: plan.name,
      line: plan.line ?? 'creator',
      status: plan.status ?? 'live',
      price_cents: plan.price_cents,
      monthly_credits: plan.monthly_credits,
      max_exports_month: plan.max_exports_month ?? null,
      ai_budget_cents: state.planBudgets[String(plan.slug)] ?? null,
      full_use_margin: fullUseMarginOf(state, plan.slug),
      subscribers: live.filter((item) => item.plan_slug === plan.slug).length,
      mrr_cents: live.filter((item) => item.plan_slug === plan.slug).reduce((sum, item) => sum + Number(item.price_cents ?? 0), 0),
      revenue_cents: payments
        .filter((item) => inPeriod(item.paid_at) && state.subscriptions.find((sub) => sub.id === item.subscription_id)?.plan_slug === plan.slug)
        .reduce((sum, item) => sum + Number(item.amount_cents), 0),
    })),
    by_user:
      billed.length === 0 || !demoUser
        ? []
        : [
            {
              user_id: demoUser.id,
              email: demoUser.email ?? null,
              plan_slug: livePlan.slug,
              ai_budget_cents: null,
              credits: billed.reduce((sum, item) => sum + Number(item.credits), 0),
              generations: billed.length,
              cost_usd: Number(apiCost.toFixed(4)),
              revenue_cents: revenue,
              exports: exportsDone.length,
            },
          ],
    by_model: state.models.map((model) => {
      const mine = state.generations.filter((item) => item.model_slug === model.slug && inPeriod(item.created_at))
      const ok = mine.filter((item) => item.status === 'succeeded')
      return {
        slug: model.slug,
        name: model.name,
        provider: model.provider,
        kind: model.kind,
        current_credits: model.credits,
        provider_cost_usd: model.provider_cost_usd ?? null,
        cost_checked_at: model.cost_checked_at ?? null,
        stale: !model.cost_checked_at,
        trusted: modelTrusted(model, 30),
        total: mine.length,
        failed: mine.filter((item) => item.status === 'failed').length,
        billed: ok.length,
        credits: ok.reduce((sum, item) => sum + Number(item.credits), 0),
        cost_usd: Number(ok.reduce((sum, item) => sum + costOf(item), 0).toFixed(4)),
        quoted_cost_usd: Number(ok.reduce((sum, item) => sum + costOf(item), 0).toFixed(4)),
        reconciled: 0,
        estimated: ok.filter((item) => item.provider_cost_usd === null || item.provider_cost_usd === undefined).length,
        deficit: 0,
      }
    }),
  }
}
