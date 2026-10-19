import type { Plan, Subscription, SubscriptionStatus } from './types'

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

export function canUseModel(allowedPlans: readonly string[] | null, planSlug: string): boolean {
  return allowedPlans === null || allowedPlans.includes(planSlug)
}
