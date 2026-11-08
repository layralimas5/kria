// Preços v3 no modo demo (0019): tarifa por modelo, calculadora, checagem da virada e vitrine,
// com o mesmo contrato e as mesmas recusas das funções do banco, sobre o estado do navegador.
// A virada e a volta mexem em saldo real: aqui elas só mostram a recusa de segurança.

import { quoteCredits, tariffCostUsd, tariffSchema } from '@/domain/creditPolicy'
import type { DemoState, Row } from './demoData'

type Refusal = { readonly code: string }
const refuse = (code: string): Refusal => ({ code })

export const V3_POLICY_DEFAULTS = {
  credit_budget_brl: 0.01,
  safety_factor: 1.15,
  legacy_cost_per_credit_brl: 0.09,
  cost_stale_days: 30,
  welcome_credits: 20,
  credit_scale: 1,
  next_welcome_credits: 100,
  require_trusted_cost: false,
  max_operation_cost_usd: 5,
  welcome_daily_cap: 300,
  price_drift_tolerance: 0.01,
  payment_fee_rate: 0.035,
}

export function policyOf(state: DemoState) {
  return { ...V3_POLICY_DEFAULTS, ...state.pricing } as typeof V3_POLICY_DEFAULTS & Row & { usd_brl: number }
}

const num = (value: unknown) => Number(value ?? 0)

export function modelTrusted(model: Row, staleDays: number): boolean {
  const checked = model.cost_checked_at ? new Date(String(model.cost_checked_at)).getTime() : null
  return model.provider_cost_usd !== null && model.provider_cost_usd !== undefined && checked !== null && Date.now() - checked <= staleDays * 86_400_000 && !model.cost_drift_at
}

/** Mesma regra de `plan_full_use_margin`: todo crédito vira custo no orçamento e toda exportação é usada. */
function fullUseMargin(state: DemoState, plan: Row): number | null {
  const policy = policyOf(state)
  const finance = state.finance ?? {}
  const price = num(plan.price_cents)
  if (price <= 0) return null
  const brlPerCredit = plan.status === 'draft' || policy.credit_scale === 2 ? policy.credit_budget_brl : policy.legacy_cost_per_credit_brl * policy.safety_factor
  const variable =
    price * (num(policy.payment_fee_rate) + num(finance.tax_rate ?? 0.06)) +
    num(finance.payment_fee_fixed_cents) +
    num(plan.monthly_credits) * 100 * brlPerCredit +
    num(plan.max_exports_month) * num(finance.render_cost_cents_per_export) +
    num(finance.storage_cents_per_subscriber) +
    num(finance.transfer_cents_per_subscriber) +
    num(finance.other_variable_cents_per_subscriber)
  return Math.round(((price - variable) / price) * 10_000) / 10_000
}

const budgetOf = (state: DemoState, slug: unknown) => (state.planBudgets[String(slug)] ?? null) as number | null

export function planEconomics(state: DemoState): Row {
  const policy = policyOf(state)
  const finance = state.finance ?? {}
  return {
    settings: {
      usd_brl: policy.usd_brl,
      payment_fee_rate: policy.payment_fee_rate,
      credit_budget_brl: policy.credit_budget_brl,
      safety_factor: policy.safety_factor,
      legacy_cost_per_credit_brl: policy.legacy_cost_per_credit_brl,
      credit_scale: policy.credit_scale,
      welcome_credits: policy.welcome_credits,
      next_welcome_credits: policy.next_welcome_credits,
    },
    finance: {
      tax_rate: finance.tax_rate ?? 0.06,
      render_cost_cents_per_export: finance.render_cost_cents_per_export ?? 0,
      min_margin_rate: finance.min_margin_rate ?? 0.6,
      payment_fee_fixed_cents: finance.payment_fee_fixed_cents ?? 0,
      storage_cents_per_subscriber: finance.storage_cents_per_subscriber ?? 0,
      transfer_cents_per_subscriber: finance.transfer_cents_per_subscriber ?? 0,
      other_variable_cents_per_subscriber: finance.other_variable_cents_per_subscriber ?? 0,
    },
    plans: state.plans.map((plan) => ({
      slug: plan.slug,
      name: plan.name,
      line: plan.line ?? 'creator',
      status: plan.status ?? 'live',
      public: plan.public ?? false,
      contact_only: plan.contact_only ?? false,
      price_cents: plan.price_cents,
      monthly_credits: plan.monthly_credits,
      max_exports_month: plan.max_exports_month ?? null,
      ai_budget_cents: budgetOf(state, plan.slug),
      full_use_margin: fullUseMargin(state, plan),
    })),
    models: state.models.map((model) => ({
      slug: model.slug,
      name: model.name,
      kind: model.kind,
      active: model.active,
      credits: model.credits,
      provider_cost_usd: model.provider_cost_usd ?? null,
      trusted: modelTrusted(model, policy.cost_stale_days),
      quoted_credits: model.provider_cost_usd === null || model.provider_cost_usd === undefined ? null : quoteCredits(num(model.provider_cost_usd), policy),
    })),
  }
}

export function fullUseMarginOf(state: DemoState, slug: unknown): number | null {
  const plan = state.plans.find((item) => item.slug === slug)
  return plan ? fullUseMargin(state, plan) : null
}

export function updateDraftPlan(state: DemoState, body: Row): Row | Refusal {
  const plan = state.plans.find((item) => item.slug === body.p_slug)
  if (!plan) return refuse('plan_not_found')
  if (plan.status !== 'draft') return refuse('plan_not_draft')
  if (String(body.p_reason ?? '').trim().length < 5) return refuse('reason_required')
  const values = [body.p_price_cents, body.p_monthly_credits, body.p_ai_budget_cents].map(num)
  if (values.some((value) => !Number.isInteger(value) || value < 0) || (body.p_max_exports_month !== null && num(body.p_max_exports_month) < 0)) {
    return refuse('invalid_plan_values')
  }
  const credits = num(body.p_monthly_credits)
  Object.assign(plan, {
    price_cents: num(body.p_price_cents),
    monthly_credits: credits,
    max_exports_month: body.p_max_exports_month,
    daily_credit_limit: credits > 0 ? credits : plan.daily_credit_limit,
    monthly_credit_limit: credits > 0 ? credits * 5 : plan.monthly_credit_limit,
  })
  state.planBudgets[String(plan.slug)] = num(body.p_ai_budget_cents)
  return plan
}

export function setTariff(state: DemoState, body: Row): Row | Refusal {
  const model = state.models.find((item) => item.slug === body.p_slug)
  if (!model) return refuse('model_not_found')
  const parsed = tariffSchema.safeParse(body.p_pricing)
  if (!parsed.success || (parsed.data.unit === 'token') !== (model.kind === 'text')) return refuse('invalid_pricing')
  if (String(body.p_source ?? '').trim().length < 5) return refuse('source_required')
  const policy = policyOf(state)
  const cost = tariffCostUsd(parsed.data, (model.defaults ?? {}) as Record<string, unknown>)
  Object.assign(model, {
    pricing: parsed.data,
    provider_cost_usd: cost === null ? null : Math.round(cost * 10_000) / 10_000,
    cost_source: String(body.p_source).trim(),
    cost_checked_at: cost === null ? null : new Date().toISOString(),
    cost_drift_at: null,
    cost_drift_note: null,
    credits: policy.credit_scale === 2 && cost !== null ? quoteCredits(cost, policy) : model.credits,
  })
  return model
}

export function updateCostGuard(state: DemoState, body: Row): Row {
  state.pricing = {
    ...state.pricing,
    max_operation_cost_usd: body.p_max_operation_cost_usd,
    next_welcome_credits: body.p_next_welcome_credits,
    welcome_daily_cap: body.p_welcome_daily_cap,
    price_drift_tolerance: body.p_price_drift_tolerance,
  }
  return state.pricing
}

export function preflight(state: DemoState): Row {
  const policy = policyOf(state)
  const factor = (policy.legacy_cost_per_credit_brl * policy.safety_factor) / policy.credit_budget_brl
  const target = num(state.finance?.min_margin_rate ?? 0.6)
  const drafts = state.plans.filter((plan) => plan.line === 'creator' && plan.status === 'draft' && !plan.contact_only)
  const blockers: string[] = []
  if (!policy.generation_paused) blockers.push('pause_required')
  if (state.generations.some((item) => item.status === 'queued' || item.status === 'running')) blockers.push('open_generations')
  if (state.models.some((model) => model.active && !modelTrusted(model, policy.cost_stale_days))) blockers.push('unverified_models')
  const warnings: string[] = []
  if (drafts.some((plan) => (fullUseMargin(state, plan) ?? 0) < target)) warnings.push('margin_below_target')
  if (state.models.some((model) => model.active && num(model.provider_cost_usd) > policy.max_operation_cost_usd)) warnings.push('operation_above_cap')
  return {
    factor: Math.round(factor * 10_000) / 10_000,
    target_margin: target,
    next_welcome_credits: policy.next_welcome_credits,
    blockers,
    warnings,
    wallets: {
      accounts: 1,
      subscription_credits: state.subscriptionBalance,
      purchased_credits: state.purchasedBalance,
      subscription_after: Math.floor(state.subscriptionBalance * factor),
      purchased_after: Math.floor(state.purchasedBalance * factor),
    },
    welcome_granted: { accounts: 1, credits: 20 },
    held: { reservations: 0, credits: 0 },
    open_generations: state.generations.filter((item) => item.status === 'queued' || item.status === 'running').length,
    subscriptions: state.subscriptions.map((sub) => ({
      plan_slug: sub.plan_slug,
      status: sub.status,
      count: 1,
      monthly_credits: num(sub.monthly_credits),
      monthly_credits_after: Math.floor(num(sub.monthly_credits) * factor),
    })),
    packs: [
      { slug: 'inicial', name: 'Inicial', price_cents: 1990, credits: 100, credits_after: Math.floor(100 * factor) },
      { slug: 'criador', name: 'Criador', price_cents: 4990, credits: 300, credits_after: Math.floor(300 * factor) },
      { slug: 'estudio', name: 'Estúdio', price_cents: 13990, credits: 800, credits_after: Math.floor(800 * factor) },
    ],
    models: state.models.map((model) => {
      const cost = model.provider_cost_usd === null || model.provider_cost_usd === undefined ? null : num(model.provider_cost_usd)
      return {
        slug: model.slug,
        name: model.name,
        active: model.active,
        trusted: modelTrusted(model, policy.cost_stale_days),
        drift: model.cost_drift_note ?? null,
        credits: model.credits,
        provider_cost_usd: cost,
        credits_after: cost === null ? null : quoteCredits(cost, policy),
        legacy_brl_per_credit: cost === null || num(model.credits) === 0 ? null : Math.round(((cost * policy.usd_brl) / num(model.credits)) * 10_000) / 10_000,
      }
    }),
    plans: drafts.map((plan) => ({
      slug: plan.slug,
      name: plan.name,
      price_cents: plan.price_cents,
      monthly_credits: plan.monthly_credits,
      full_use_margin: fullUseMargin(state, plan),
    })),
  }
}

/**
 * Vitrine do demo: mostra a proposta v3 como se estivesse no ar, para ver a landing com a chave v2.
 * Em produção, `storefront_plans` só devolve Creator depois da virada.
 */
export function storefront(state: DemoState): Row {
  const visible = state.plans.filter((plan) => plan.slug === 'gratis' || plan.line === 'business' || (plan.line === 'creator' && plan.status === 'draft'))
  return {
    welcome_credits: policyOf(state).next_welcome_credits,
    credit_scale: 2,
    plans: visible
      .sort((a, b) => num(a.position) - num(b.position))
      .map((plan) => {
        const enterprise = plan.slug === 'enterprise'
        return {
          slug: plan.slug,
          line: plan.line ?? 'creator',
          name: plan.slug === 'gratis' ? 'Free' : plan.name,
          tagline: plan.description,
          price_cents: enterprise ? null : plan.price_cents,
          monthly_credits: enterprise ? null : plan.monthly_credits,
          exports_month: plan.max_exports_month ?? null,
          seats: enterprise ? null : (plan.max_seats ?? 1),
          highlight: plan.highlight ?? false,
          features: plan.storefront_features ?? plan.features ?? [],
          soon_features: plan.soon_features ?? [],
          limits: plan.limits ?? [],
          cta: plan.slug === 'gratis' ? 'signup' : plan.contact_only ? 'contact' : 'subscribe',
        }
      }),
  }
}
