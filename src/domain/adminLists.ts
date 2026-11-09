import { z } from 'zod'
import { generationStatusSchema, subscriptionStatusSchema } from './types'

// Listas do admin (0022 `admin_generations` e `admin_subscriptions`).

const count = z.coerce.number()

export const adminGenerationSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  email: z.string().nullable(),
  model_slug: z.string(),
  model_name: z.string(),
  kind: z.string(),
  status: generationStatusSchema,
  credits: count,
  prompt: z.string(),
  error: z.string().nullable(),
  format_slug: z.string().nullable(),
  billed_on_failure: z.boolean(),
  input_tokens: count.nullable(),
  output_tokens: count.nullable(),
  cost_usd: z.coerce.number().nullable(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
  duration_seconds: count.nullable(),
})
export type AdminGeneration = z.infer<typeof adminGenerationSchema>

export const generationPageSchema = z.object({ total: count, rows: z.array(adminGenerationSchema) })
export type GenerationPage = z.infer<typeof generationPageSchema>

export const adminSubscriptionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  email: z.string().nullable(),
  plan_slug: z.string(),
  plan_name: z.string(),
  plan_version: count,
  status: subscriptionStatusSchema,
  price_cents: count.nullable(),
  monthly_credits: count,
  current_period_end: z.string().nullable(),
  canceled_at: z.string().nullable(),
  ended_at: z.string().nullable(),
  created_at: z.string(),
  payments: count,
  last_paid_at: z.string().nullable(),
  paid_cents: count.nullable(),
})
export type AdminSubscription = z.infer<typeof adminSubscriptionSchema>

export const subscriptionPageSchema = z.object({
  total: count,
  counts: z.record(z.string(), count),
  rows: z.array(adminSubscriptionSchema),
})
export type SubscriptionPage = z.infer<typeof subscriptionPageSchema>

export const GENERATION_STATUS_LABELS: Readonly<Record<AdminGeneration['status'], string>> = {
  queued: 'Na fila',
  running: 'Gerando',
  succeeded: 'Pronta',
  failed: 'Falhou',
}

export const PAGE_SIZE = 50
