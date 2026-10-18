import { z } from 'zod'

// Planos de assinatura, como vêm de `subscription_plans` (migration 0003).
// Preço, créditos, limites, benefícios e tabela comparativa são editados no
// banco; aqui só ficam o formato e os rótulos das linhas da comparação.

export const planFeatureSchema = z.object({
  label: z.string().min(1),
  soon: z.boolean().default(false),
})
export type PlanFeature = z.infer<typeof planFeatureSchema>

/** Valor de uma célula da comparação: texto livre ou um dos marcadores. */
export type ComparisonValue = 'yes' | 'no' | 'soon' | (string & {})

export const subscriptionPlanSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  price_cents: z.number().int().positive(),
  monthly_credits: z.number().int().positive(),
  max_personas: z.number().int().positive(),
  cta_label: z.string(),
  badge: z.string().nullable(),
  highlight: z.boolean(),
  features: z.array(planFeatureSchema),
  comparison: z.record(z.string(), z.string()),
  position: z.number().int(),
})
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>

export const PLAN_COLUMNS =
  'slug, name, tagline, price_cents, monthly_credits, max_personas, cta_label, badge, highlight, features, comparison, position'

export const subscriptionStatusSchema = z.enum(['pending', 'active', 'overdue', 'canceled', 'expired'])
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>

export const subscriptionSchema = z.object({
  id: z.string(),
  plan_slug: z.string(),
  status: subscriptionStatusSchema,
  price_cents: z.number().int(),
  current_period_end: z.string().nullable(),
  canceled_at: z.string().nullable(),
  created_at: z.string(),
})
export type Subscription = z.infer<typeof subscriptionSchema>

export const SUBSCRIPTION_COLUMNS = 'id, plan_slug, status, price_cents, current_period_end, canceled_at, created_at'

/** Linhas da tabela comparativa, na ordem em que aparecem. A chave casa com `comparison` do banco. */
export const COMPARISON_ROWS: readonly { readonly key: string; readonly label: string }[] = [
  { key: 'credits', label: 'Créditos' },
  { key: 'personas', label: 'Personagens salvos' },
  { key: 'images', label: 'Geração de imagens' },
  { key: 'videos', label: 'Geração de vídeos' },
  { key: 'motion_control', label: 'Motion Control' },
  { key: 'ugc', label: 'Recursos de UGC' },
  { key: 'copy', label: 'Copys e roteiros' },
  { key: 'prompts', label: 'Biblioteca de prompts' },
  { key: 'premium_models', label: 'Modelos premium' },
  { key: 'history', label: 'Histórico de criações' },
  { key: 'priority', label: 'Processamento prioritário' },
  { key: 'support', label: 'Suporte' },
]

/** O plano vale enquanto o período pago não acabou, mesmo cancelado. Pendente nunca vale. */
export function isEntitled(subscription: Subscription, now: Date = new Date()): boolean {
  if (!['active', 'overdue', 'canceled'].includes(subscription.status)) return false
  return subscription.current_period_end !== null && new Date(subscription.current_period_end) > now
}
