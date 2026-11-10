// Painel admin: tudo passa por funções SQL que conferem `is_admin()` no banco.
// O front só esconde a rota; quem barra quem não é admin é o servidor.

import { z } from 'zod'
import { aiCostsSchema, priceHistorySchema, type CostFilters } from '@/domain/aiCosts'
import { analyticsSchema } from '@/domain/adminAnalytics'
import { businessSchema, type ExpenseCategory } from '@/domain/business'
import { centerSchema } from '@/domain/commandCenter'
import { USERS_PAGE_SIZE, userPageSchema, userProfileSchema, type UserFilters } from '@/domain/adminUsers'
import { generationPageSchema, PAGE_SIZE, subscriptionPageSchema } from '@/domain/adminLists'
import { adminMeSchema, adminRoleSchema, dashboardSchema, type AdminMe, type AdminRole, type Period } from '@/domain/adminDashboard'
import { financeSchema, financeSettingsSchema, type FinanceSettings } from '@/domain/finance'
import { modelQuotesSchema, preflightSchema, type Tariff } from '@/domain/creditPolicy'
import { economicsSchema } from '@/domain/planEconomics'
import { supportSettingsSchema } from '@/domain/support'
import { spendGuardSchema } from '@/domain/spendGuard'
import { ApiError, invoke } from './api'
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
  mfa_required: 'Confirme o segundo fator para continuar.',
  invalid_period: 'Período inválido. Escolha até um ano.',
  user_not_found: 'Nenhuma conta com esse e-mail.',
  cannot_change_self: 'Você não pode mudar o próprio acesso.',
  last_super_admin: 'Precisa sobrar pelo menos um super admin.',
  invalid_cap_order: 'O limite do dia não pode passar o do mês.',
  activation_reason_required: 'Escreva o motivo da virada (pelo menos 10 caracteres).',
  pause_required: 'Pause as gerações na Guarda de gasto antes da virada.',
  open_generations: 'Ainda há geração em andamento. Espere terminar e tente de novo.',
  already_activated: 'Os preços v2 já estão ligados.',
  invalid_welcome_credits: 'Boas-vindas vai de 0 a 1.000 créditos.',
  source_required: 'Cole o link da página de preço do fornecedor.',
  cost_required: 'Cadastre o custo do fornecedor antes de confirmar.',
  budget_locked_after_activation: 'Depois da virada, o orçamento por crédito não muda pelo painel.',
  unverified_models: 'Há modelo ativo sem custo conferido. Cadastre a tarifa ou desligue o modelo antes da virada.',
  margin_below_target: 'Algum plano novo fica abaixo da meta de margem. Revise na calculadora ou aceite o risco explicitamente.',
  invalid_pricing: 'Tarifa inválida. Confira a unidade e os valores (texto cobra por token; foto e vídeo, por imagem ou segundo).',
  plan_not_draft: 'Só plano em rascunho muda por aqui. Plano no ar muda pela virada.',
  invalid_plan_values: 'Confira preço, créditos, exportações e orçamento: nenhum pode ser negativo.',
  rollback_reason_required: 'Escreva o motivo da volta (pelo menos 10 caracteres).',
  not_activated: 'Os preços v2 não estão ligados.',
  snapshot_not_found: 'Não há foto da virada para voltar.',
  v2_subscribers_exist: 'Já há assinante em plano novo. A volta pelo painel ficou travada; fale com o suporte técnico.',
  invalid_checks: 'Resposta do fornecedor fora do formato.',
  invalid_sort: 'Ordenação inválida.',
  invalid_days: 'Escolha de 1 a 365 dias.',
  grant_not_found: 'Essa conta não tem cortesia em vigor.',
  invalid_date: 'Data inválida.',
  expense_not_found: 'Despesa não encontrada ou já anulada.',
  email_taken: 'Já existe uma conta com esse e-mail.',
  invalid_email: 'E-mail inválido.',
  demo_only: 'No modo demo essa ação não roda. Nada foi alterado.',
}

async function rpc<T>(name: string, args: Record<string, unknown>, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    const known = ADMIN_ERRORS[error.message]
    if (known) throw new ApiError(error.message, known)
    console.error(name, error)
    throw new ApiError('admin_failed', 'A operação não foi concluída. Confira os valores.')
  }
  return schema.parse(data)
}

/** Papel, permissões e nível da sessão; nulo para quem não administra. */
export async function fetchAdminMe(): Promise<AdminMe | null> {
  const { data, error } = await supabase.rpc('admin_me')
  if (error) throw new ApiError('admin_me_failed', 'Não deu para conferir seu acesso.')
  return data === null ? null : adminMeSchema.parse(data)
}

/** Plano e ferramenta nulos = todos. */
export interface DashboardScope {
  readonly plan: string | null
  readonly model: string | null
}

export const fetchDashboard = (period: Period, scope: DashboardScope = { plan: null, model: null }) =>
  rpc(
    'admin_dashboard',
    { p_from: period.from.toISOString(), p_to: period.to.toISOString(), p_plan: scope.plan, p_model: scope.model },
    dashboardSchema,
  )

export const fetchAnalytics = (period: Period) =>
  rpc('admin_analytics', { p_from: period.from.toISOString(), p_to: period.to.toISOString() }, analyticsSchema)

export interface GenerationFilters {
  readonly status: string | null
  readonly model: string | null
  readonly email: string
}

export const fetchGenerations = (filters: GenerationFilters, page: number) =>
  rpc(
    'admin_generations',
    { p_status: filters.status, p_model: filters.model, p_email: filters.email || null, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE },
    generationPageSchema,
  )

export const fetchSubscriptions = (status: string | null, email: string, page: number) =>
  rpc('admin_subscriptions', { p_status: status, p_email: email || null, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }, subscriptionPageSchema)

const numeric = z.coerce.number()

export const pricingSettingsSchema = z.object({
  usd_brl: numeric,
  fx_buffer: numeric,
  markup: numeric,
  credit_value_brl: numeric,
  payment_fee_rate: numeric,
})

export const adminPlanSchema = z.object({
  slug: z.string(),
  name: z.string(),
  /** Rascunho não vende: só entra no checkout com a virada (0018/0019). */
  status: z.enum(['draft', 'live', 'legacy']).catch('live'),
  line: z.enum(['creator', 'business']).catch('creator'),
  price_cents: numeric,
  monthly_credits: numeric,
  max_concurrent: numeric,
  daily_credit_limit: numeric.nullable(),
  monthly_credit_limit: numeric.nullable(),
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
  entity: z.string(),
  result: z.enum(['success', 'failed']),
  admin_id: z.string().nullable(),
  target_user_id: z.string().nullable(),
  target: z.string().nullable(),
  reason: z.string().nullable(),
  details: z.record(z.unknown()),
  created_at: z.string(),
})
export type AuditEntry = z.infer<typeof auditEntrySchema>

export const fetchPricing = () => rpc('admin_pricing', {}, pricingSettingsSchema)

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

export const updatePlanLimits = (slug: string, daily: number | null, monthly: number | null) =>
  rpc('admin_update_plan_limits', { p_slug: slug, p_daily: daily, p_monthly: monthly }, adminPlanSchema)

export const fetchSpendGuard = () => rpc('admin_spend_guard', {}, spendGuardSchema)

export interface SpendGuardUpdate {
  readonly dailyCapUsd: number | null
  readonly monthlyCapUsd: number | null
  readonly alertRatio: number
  readonly paused: boolean
  readonly reason: string | null
}

export const updateSpendGuard = (update: SpendGuardUpdate) =>
  rpc(
    'admin_update_spend_guard',
    {
      p_daily_cap_usd: update.dailyCapUsd,
      p_monthly_cap_usd: update.monthlyCapUsd,
      p_alert_ratio: update.alertRatio,
      p_paused: update.paused,
      p_reason: update.reason,
    },
    spendGuardSchema,
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
    .select('id, action, entity, result, admin_id, target_user_id, target, reason, details, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new ApiError('audit_unavailable', 'Não deu para carregar a auditoria.')
  return z.array(auditEntrySchema).parse(data)
}

export const adminMemberSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().nullable(),
  display_name: z.string().nullable(),
  role: adminRoleSchema,
  created_at: z.string(),
  updated_at: z.string(),
  granted_by_email: z.string().nullable(),
})
export type AdminMember = z.infer<typeof adminMemberSchema>

export const fetchAdmins = () => rpc('admin_list_admins', {}, z.array(adminMemberSchema))

export const setAdminRole = (email: string, role: AdminRole, reason: string) =>
  rpc('admin_set_role', { p_email: email, p_role: role, p_reason: reason }, z.object({ user_id: z.string(), role: adminRoleSchema }))

export const removeAdmin = (userId: string, reason: string) =>
  rpc('admin_remove_admin', { p_user_id: userId, p_reason: reason }, z.boolean())

// ------------------------------------------------- financeiro e preços v2 (0018)

export const fetchFinance = (period: Period) =>
  rpc('admin_finance', { p_from: period.from.toISOString(), p_to: period.to.toISOString() }, financeSchema)

export const fetchFinanceSettings = () => rpc('admin_finance_settings', {}, financeSettingsSchema)

export const updateFinanceSettings = (settings: FinanceSettings) =>
  rpc(
    'admin_update_finance_settings',
    {
      p_tax_rate: settings.tax_rate,
      p_fixed_costs_cents: settings.fixed_costs_cents,
      p_infra_costs_cents: settings.infra_costs_cents,
      p_storage_costs_cents: settings.storage_costs_cents,
      p_render_cost_cents_per_export: settings.render_cost_cents_per_export,
      p_pro_labore_cents: settings.pro_labore_cents,
      p_reserve_rate: settings.reserve_rate,
      p_min_margin_rate: settings.min_margin_rate,
      p_payment_fee_fixed_cents: settings.payment_fee_fixed_cents,
      p_storage_cents_per_subscriber: settings.storage_cents_per_subscriber,
      p_transfer_cents_per_subscriber: settings.transfer_cents_per_subscriber,
      p_other_variable_cents_per_subscriber: settings.other_variable_cents_per_subscriber,
    },
    financeSettingsSchema,
  )

export const fetchModelQuotes = () => rpc('admin_model_quotes', {}, modelQuotesSchema)

export interface CreditPolicyUpdate {
  readonly safetyFactor: number
  readonly creditBudgetBrl: number
  readonly legacyCostPerCreditBrl: number
  readonly costStaleDays: number
}

export const updateCreditPolicy = (update: CreditPolicyUpdate) =>
  rpc(
    'admin_update_credit_policy',
    {
      p_safety_factor: update.safetyFactor,
      p_credit_budget_brl: update.creditBudgetBrl,
      p_legacy_cost_per_credit_brl: update.legacyCostPerCreditBrl,
      p_cost_stale_days: update.costStaleDays,
    },
    z.unknown(),
  )

export const confirmModelCost = (slug: string, source: string) => rpc('admin_confirm_model_cost', { p_slug: slug, p_source: source }, z.unknown())

// ------------------------------------------------------ preços v3 (0019)

export const fetchPlanEconomics = () => rpc('admin_plan_economics', {}, economicsSchema)

export interface DraftPlanUpdate {
  readonly slug: string
  readonly priceCents: number
  readonly monthlyCredits: number
  readonly exportsPerMonth: number | null
  readonly aiBudgetCents: number
  readonly reason: string
}

export const updateDraftPlan = (update: DraftPlanUpdate) =>
  rpc(
    'admin_update_draft_plan',
    {
      p_slug: update.slug,
      p_price_cents: update.priceCents,
      p_monthly_credits: update.monthlyCredits,
      p_max_exports_month: update.exportsPerMonth,
      p_ai_budget_cents: update.aiBudgetCents,
      p_reason: update.reason,
    },
    z.unknown(),
  )

export const setModelTariff = (slug: string, tariff: Tariff, source: string) =>
  rpc('admin_set_model_tariff', { p_slug: slug, p_pricing: tariff, p_source: source }, z.unknown())

export interface CostGuardUpdate {
  readonly maxOperationCostUsd: number
  readonly nextWelcomeCredits: number
  readonly welcomeDailyCap: number
  readonly priceDriftTolerance: number
}

export const updateCostGuard = (update: CostGuardUpdate) =>
  rpc(
    'admin_update_cost_guard',
    {
      p_max_operation_cost_usd: update.maxOperationCostUsd,
      p_next_welcome_credits: update.nextWelcomeCredits,
      p_welcome_daily_cap: update.welcomeDailyCap,
      p_price_drift_tolerance: update.priceDriftTolerance,
    },
    z.unknown(),
  )

const priceCheckSchema = z.object({
  checked: z.array(z.object({ slug: z.string(), observed: numeric.nullable(), stored: z.array(numeric), matches: z.boolean() })),
  missing: z.array(z.string()),
})
export type PriceCheck = z.infer<typeof priceCheckSchema>

/** Consulta a API de preço do fal (sem gerar nada) e marca modelo com preço mudado. Function `pricing-check`. */
export async function runPriceCheck(): Promise<PriceCheck> {
  return priceCheckSchema.parse(await invoke('pricing-check', {}))
}

export const fetchPreflight = () => rpc('admin_pricing_v2_preflight', {}, preflightSchema)

export const activatePricingV2 = (reason: string, acceptBelowTarget: boolean) =>
  rpc(
    'admin_activate_pricing_v2',
    { p_reason: reason, p_accept_below_target: acceptBelowTarget },
    z.object({ factor: numeric, wallets: numeric, snapshot: z.string() }),
  )

export const rollbackPricingV2 = (reason: string) =>
  rpc('admin_rollback_pricing_v2', { p_reason: reason }, z.object({ snapshot: z.string(), wallets: numeric }))

// ------------------------------------------------- central de inteligência (0025)

export const fetchAiCosts = (period: Period, filters: CostFilters) =>
  rpc(
    'admin_ai_costs',
    {
      p_from: period.from.toISOString(),
      p_to: period.to.toISOString(),
      p_provider: filters.provider,
      p_kind: filters.kind,
      p_model: filters.model,
      p_active: filters.active,
    },
    aiCostsSchema,
  )

export const fetchModelPriceHistory = (slug: string) => rpc('admin_model_price_history', { p_slug: slug }, priceHistorySchema)

export const setModelTargetMargin = (slug: string, rate: number | null, reason: string) =>
  rpc('admin_set_model_target_margin', { p_slug: slug, p_rate: rate, p_reason: reason }, z.unknown())

export interface BusinessScope {
  readonly plan: string | null
  readonly model: string | null
  readonly provider: string | null
}

export const fetchBusiness = (period: Period, scope: BusinessScope) =>
  rpc(
    'admin_business',
    { p_from: period.from.toISOString(), p_to: period.to.toISOString(), p_plan: scope.plan, p_model: scope.model, p_provider: scope.provider },
    businessSchema,
  )

export const fetchCommandCenter = (period: Period) =>
  rpc('admin_command_center', { p_from: period.from.toISOString(), p_to: period.to.toISOString() }, centerSchema)

export const addExpense = (expense: { incurredOn: string; category: ExpenseCategory; description: string; amountCents: number }) =>
  rpc(
    'admin_add_expense',
    { p_incurred_on: expense.incurredOn, p_category: expense.category, p_description: expense.description, p_amount_cents: expense.amountCents },
    z.string(),
  )

export const voidExpense = (id: string, reason: string) => rpc('admin_void_expense', { p_id: id, p_reason: reason }, z.boolean())

const dayStart = (day: string) => (day ? new Date(`${day}T00:00:00-03:00`).toISOString() : null)
const dayEnd = (day: string) => (day ? new Date(new Date(`${day}T00:00:00-03:00`).getTime() + 86_400_000).toISOString() : null)

export const fetchUsersPage = (filters: UserFilters, page: number) =>
  rpc(
    'admin_users_list',
    {
      p_query: filters.query.trim() || null,
      p_plan: filters.plan,
      p_subscription_status: filters.subscription,
      p_account: filters.account,
      p_created_from: dayStart(filters.createdFrom),
      p_created_to: dayEnd(filters.createdTo),
      p_seen: filters.seen,
      p_credits: filters.credits,
      p_manual: filters.manual,
      p_sort: filters.sort,
      p_limit: USERS_PAGE_SIZE,
      p_offset: page * USERS_PAGE_SIZE,
    },
    userPageSchema,
  )

export const fetchUserProfile = (userId: string) => rpc('admin_user_profile', { p_user_id: userId }, userProfileSchema)

export const grantPlan = (userId: string, planSlug: string, days: number, reason: string) =>
  rpc('admin_grant_plan', { p_user_id: userId, p_plan_slug: planSlug, p_days: days, p_reason: reason }, z.unknown())

export const revokePlanGrant = (userId: string, reason: string) => rpc('admin_revoke_plan_grant', { p_user_id: userId, p_reason: reason }, z.boolean())

export interface NewUserInput {
  readonly email: string
  readonly displayName: string
  readonly planSlug: string | null
  readonly grantDays: number | null
  readonly credits: number
  readonly suspended: boolean
  readonly role: AdminRole | null
  readonly reason: string
}

const createdUserSchema = z.object({ user_id: z.string(), partial: z.boolean(), error: z.string().optional() })

/** Convite pelo Supabase Auth (function `admin-users`): a pessoa escolhe a própria senha pelo link do e-mail. */
export async function createUser(input: NewUserInput) {
  return createdUserSchema.parse(
    await invoke('admin-users', {
      email: input.email,
      display_name: input.displayName,
      plan_slug: input.planSlug,
      grant_days: input.grantDays,
      credits: input.credits,
      suspended: input.suspended,
      role: input.role,
      reason: input.reason,
    }),
  )
}

// ------------------------------------------------------------ suporte (0028)

export const fetchSupportSettings = () => rpc('admin_support_settings', {}, supportSettingsSchema)

export const setSupportSettings = (settings: { email: string; whatsapp: string; communityUrl: string; reason: string }) =>
  rpc(
    'admin_set_support_settings',
    { p_email: settings.email, p_whatsapp: settings.whatsapp, p_community_url: settings.communityUrl, p_reason: settings.reason },
    supportSettingsSchema,
  )
