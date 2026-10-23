// Painel admin: tudo passa por funções SQL que conferem `is_admin()` no banco.
// O front só esconde a rota; quem barra quem não é admin é o servidor.

import { z } from 'zod'
import { ledgerReasonSchema, subscriptionStatusSchema } from '@/domain/types'
import { ApiError } from './api'
import { supabase } from './supabase'

const ADMIN_ERRORS: Record<string, string> = {
  forbidden: 'Você não tem acesso ao painel.',
  reason_required: 'Escreva o motivo (pelo menos 5 caracteres).',
  insufficient_credits: 'O ajuste deixaria o saldo comprado negativo.',
  invalid_amount: 'Valor inválido.',
  cannot_suspend_self: 'Você não pode suspender a própria conta.',
  plan_not_found: 'Plano não encontrado.',
  model_not_found: 'Modelo não encontrado.',
  free_plan_is_free: 'O plano grátis não pode ter preço.',
  account_not_found: 'Conta não encontrada.',
}

async function rpc<T>(name: string, args: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    const known = ADMIN_ERRORS[error.message]
    if (known) throw new ApiError(error.message, known)
    console.error(name, error)
    throw new ApiError('admin_failed', 'A operação não foi concluída. Confira os valores.')
  }
  return schema.parse(data)
}

export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin')
  if (error) return false
  return data === true
}

const numeric = z.coerce.number()

export const overviewSchema = z.object({
  total_users: numeric,
  new_users_30d: numeric,
  active_subscribers: numeric,
  past_due: numeric,
  mrr_cents: numeric,
  new_subscriptions_30d: numeric,
  cancellations_30d: numeric,
  subscription_revenue_30d_cents: numeric,
  pack_revenue_30d_cents: numeric,
  generations_30d: numeric,
  generations_failed_30d: numeric,
  credits_consumed_30d: numeric,
  api_cost_usd_30d: numeric,
  api_cost_unknown_30d: numeric,
  pricing: z.object({ usd_brl: numeric, fx_buffer: numeric, markup: numeric, credit_value_brl: numeric }),
  revenue_by_plan: z.array(z.object({ slug: z.string(), name: z.string(), subscribers: numeric, mrr_cents: numeric })),
  by_model: z.array(
    z.object({ model_slug: z.string(), provider: z.string(), total: numeric, failed: numeric, credits: numeric, cost_usd: numeric }),
  ),
})
export type Overview = z.infer<typeof overviewSchema>

export const adminUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  display_name: z.string().nullable(),
  username: z.string(),
  balance: z.number().int().nullable(),
  subscription_balance: z.number().int().nullable(),
  purchased_balance: z.number().int().nullable(),
  plan_slug: z.string().nullable(),
  subscription_status: subscriptionStatusSchema.nullable(),
  suspended_at: z.string().nullable(),
  created_at: z.string(),
  generations: numeric,
})
export type AdminUser = z.infer<typeof adminUserSchema>

export const userDetailSchema = z.object({
  ledger: z.array(
    z.object({ id: numeric, delta: numeric, reason: ledgerReasonSchema, note: z.string().nullable(), balance_after: numeric.nullable(), created_at: z.string() }),
  ),
  generations: z.array(
    z.object({
      id: z.string(),
      model_slug: z.string(),
      kind: z.string(),
      status: z.string(),
      credits: numeric,
      provider_cost_usd: numeric.nullable(),
      error: z.string().nullable(),
      created_at: z.string(),
    }),
  ),
  subscriptions: z.array(
    z.object({ id: z.string(), plan_slug: z.string(), status: subscriptionStatusSchema, price_cents: numeric, current_period_end: z.string().nullable(), created_at: z.string() }),
  ),
  payments: z.array(z.object({ type: z.string(), amount_cents: numeric, status: z.string(), at: z.string() })),
})
export type UserDetail = z.infer<typeof userDetailSchema>

export const adminPlanSchema = z.object({
  slug: z.string(),
  name: z.string(),
  price_cents: numeric,
  monthly_credits: numeric,
  max_concurrent: numeric,
  features: z.array(z.string()),
  public: z.boolean(),
  active: z.boolean(),
  version: numeric,
})
export type AdminPlan = z.infer<typeof adminPlanSchema>

export const adminModelSchema = z.object({
  slug: z.string(),
  name: z.string(),
  kind: z.enum(['image', 'video', 'text']),
  provider: z.string(),
  endpoint: z.string(),
  credits: numeric,
  provider_cost_usd: numeric.nullable(),
  allowed_plans: z.array(z.string()).nullable(),
  active: z.boolean(),
})
export type AdminModel = z.infer<typeof adminModelSchema>

export const auditEntrySchema = z.object({
  id: numeric,
  action: z.string(),
  target_user_id: z.string().nullable(),
  target: z.string().nullable(),
  reason: z.string().nullable(),
  details: z.record(z.unknown()),
  created_at: z.string(),
})
export type AuditEntry = z.infer<typeof auditEntrySchema>

export const fetchOverview = () => rpc('admin_overview', {}, overviewSchema)

export const searchUsers = (query: string) => rpc('admin_search_users', { p_query: query, p_limit: 30 }, z.array(adminUserSchema))

export const fetchUserDetail = (userId: string) => rpc('admin_user_detail', { p_user_id: userId }, userDetailSchema)

export const adjustCredits = (userId: string, amount: number, reason: string) =>
  rpc('admin_adjust_credits', { p_user_id: userId, p_amount: amount, p_reason: reason }, numeric)

export const setSuspended = (userId: string, suspended: boolean, reason: string) =>
  rpc('admin_set_suspended', { p_user_id: userId, p_suspended: suspended, p_reason: reason }, z.boolean())

export const fetchAdminPlans = () => rpc('admin_plans', {}, z.array(adminPlanSchema))

export interface PlanUpdate {
  readonly priceCents: number
  readonly monthlyCredits: number
  readonly maxConcurrent: number
  readonly active: boolean
}

export const updatePlan = (slug: string, update: PlanUpdate) =>
  rpc(
    'admin_update_plan',
    {
      p_slug: slug,
      p_price_cents: update.priceCents,
      p_monthly_credits: update.monthlyCredits,
      p_max_concurrent: update.maxConcurrent,
      p_active: update.active,
      p_features: null,
    },
    adminPlanSchema,
  )

export const fetchAdminModels = () => rpc('admin_models', {}, z.array(adminModelSchema))

export interface ModelUpdate {
  readonly active: boolean
  readonly credits: number
  readonly providerCostUsd: number | null
  readonly allowedPlans: readonly string[] | null
}

export const updateModel = (slug: string, update: ModelUpdate) =>
  rpc(
    'admin_update_model',
    {
      p_slug: slug,
      p_active: update.active,
      p_credits: update.credits,
      p_provider_cost_usd: update.providerCostUsd,
      p_allowed_plans: update.allowedPlans,
    },
    adminModelSchema,
  )

export interface PricingUpdate {
  readonly usdBrl: number
  readonly fxBuffer: number
  readonly markup: number
  readonly creditValueBrl: number
}

export const updatePricing = (update: PricingUpdate) =>
  rpc(
    'admin_update_pricing',
    { p_usd_brl: update.usdBrl, p_fx_buffer: update.fxBuffer, p_markup: update.markup, p_credit_value_brl: update.creditValueBrl },
    z.object({ usd_brl: numeric }),
  )

export async function fetchAuditLog(): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('admin_audit_logs')
    .select('id, action, target_user_id, target, reason, details, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new ApiError('audit_unavailable', 'Não deu para carregar a auditoria.')
  return z.array(auditEntrySchema).parse(data)
}
