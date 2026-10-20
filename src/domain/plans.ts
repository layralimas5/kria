import type { Model, Plan, Subscription, SubscriptionStatus } from './types'

/** Carência depois do vencimento enquanto o Asaas tenta cobrar de novo. Espelha `effective_plan` (0004). */
const GRACE_MS = 3 * 24 * 60 * 60 * 1000

/**
 * A assinatura que vale agora, para mostrar na tela. Quem decide de verdade
 * é o banco (`effective_plan`); aqui é só leitura com a mesma regra.
 */
export function currentSubscription(subscriptions: readonly Subscription[], now = Date.now()): Subscription | null {
  const live = subscriptions.filter((subscription) => {
    if (!subscription.current_period_end) return false
    const end = new Date(subscription.current_period_end).getTime()
    if (subscription.status === 'active' || subscription.status === 'past_due') return end + GRACE_MS > now
    if (subscription.status === 'canceled') return end > now
    return false
  })
  return live.sort((a, b) => (b.current_period_end ?? '').localeCompare(a.current_period_end ?? ''))[0] ?? null
}

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  pending: 'Aguardando pagamento',
  active: 'Ativa',
  past_due: 'Pagamento em atraso',
  canceled: 'Cancelada',
  expired: 'Encerrada',
}

/** Quanto custa cada crédito no plano, em reais. */
export function pricePerCredit(plan: Pick<Plan, 'price_cents' | 'monthly_credits'>): number | null {
  return plan.monthly_credits > 0 ? plan.price_cents / plan.monthly_credits / 100 : null
}

/** Créditos que toda conta nova ganha. Espelha `signup_bonus` (0001). */
export const WELCOME_CREDITS = 20

/** O plano sem mensalidade: não tem checkout, é o que vale para quem não assinou. */
export function isFreePlan(plan: Pick<Plan, 'price_cents'>): boolean {
  return plan.price_cents === 0
}

export interface PlanYield {
  readonly model: string
  readonly count: number
}

/**
 * Quanto o plano rende se o usuário gastar tudo num modelo só: "300 créditos" não
 * diz nada para quem chega, "60 fotos" diz. Fica fora o modelo que o plano não libera
 * e o que não cabe nem uma vez.
 */
export function planYield(
  plan: Pick<Plan, 'slug' | 'monthly_credits'>,
  models: readonly Pick<Model, 'name' | 'credits' | 'allowed_plans'>[],
  credits = plan.monthly_credits,
): PlanYield[] {
  return models
    .filter((model) => model.credits > 0 && canUseModel(model.allowed_plans, plan.slug))
    .map((model) => ({ model: model.name, count: Math.floor(credits / model.credits) }))
    .filter((item) => item.count > 0)
}

export function canUseModel(allowedPlans: readonly string[] | null, planSlug: string): boolean {
  return allowedPlans === null || allowedPlans.includes(planSlug)
}

/** Ferramentas do menu que dependem do plano. Espelha o check de `subscription_plans.tools` (0005). */
export const PLAN_TOOLS = ['motion_control', 'ugc_studio', 'copy', 'prompt_library', 'projects'] as const
export type PlanTool = (typeof PLAN_TOOLS)[number]

/** Nome de cada ferramenta e se já existe. A que não existe aparece como "Breve", sem ação. */
export const PLAN_TOOL_INFO: Record<PlanTool, { readonly label: string; readonly ready: boolean }> = {
  motion_control: { label: 'Motion Control', ready: false },
  ugc_studio: { label: 'Estúdio UGC', ready: false },
  copy: { label: 'Copys e roteiros', ready: false },
  prompt_library: { label: 'Biblioteca de prompts', ready: false },
  projects: { label: 'Meus projetos', ready: false },
}

/** Sem plano carregado ainda, nada que dependa dele aparece: evita mostrar e depois sumir. */
export function planIncludes(plan: Pick<Plan, 'tools'> | null, tool: PlanTool): boolean {
  return plan?.tools.includes(tool) ?? false
}
