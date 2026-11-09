import { z } from 'zod'

// Analytics do painel (0020 `admin_analytics`): retenção, ferramentas e créditos/tokens.
// Contrato com o banco e as contas derivadas ficam aqui; a tela só desenha.

const count = z.coerce.number()
const usd = z.coerce.number().nullable()

const returningSchema = z.object({ day: count, eligible: count, returned: count })

const cohortSchema = z.object({
  week_start: z.string(),
  size: count,
  weeks: z.array(count).nullable().transform((weeks) => weeks ?? []),
})

const subscriptionMonthSchema = z.object({ month: z.string(), live_at_start: count, new: count, canceled: count })

const dormantSchema = z.object({
  user_id: z.string(),
  email: z.string().nullable(),
  last_activity_at: z.string(),
  last_sign_in_at: z.string().nullable(),
  actions: count,
  plan_slug: z.string(),
  balance: count,
})

const toolSchema = z.object({
  model_slug: z.string(),
  name: z.string(),
  kind: z.string(),
  total: count,
  users: count,
  succeeded: count,
  failed: count,
  credits: count,
  cost_usd: usd,
  previous_total: count,
})

const toolPlanSchema = z.object({ plan_slug: z.string(), total: count, users: count, image: count, video: count, text: count })

const toolDaySchema = z.object({ day: z.string(), image: count, video: count, text: count, users: count })

const reasonSchema = z.object({
  reason: z.string(),
  entries: count,
  credited: count,
  debited: count,
  subscription_net: count,
  purchased_net: count,
})

const spenderSchema = z.object({ user_id: z.string(), email: z.string().nullable(), spent: count, generations: count, balance: count })

const tokenModelSchema = z.object({ model_slug: z.string(), name: z.string(), requests: count, input: count, output: count, cost_usd: usd })

const tokenUserSchema = z.object({ user_id: z.string(), email: z.string().nullable(), requests: count, input: count, output: count, cost_usd: usd })

const list = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(item)
    .nullable()
    .transform((rows) => rows ?? [])

export const analyticsSchema = z.object({
  retention: z.object({
    dau: count,
    wau: count,
    mau: count,
    logins_7d: count,
    logins_30d: count,
    ever_active: count,
    total_users: count,
    returning: list(returningSchema),
    activation: z.object({ signed_up: count, activated: count, activated_24h: count }),
    cohorts: list(cohortSchema),
    subscriptions: list(subscriptionMonthSchema),
    dormant_count: count,
    dormant: z.array(dormantSchema).nullable(),
  }),
  tools: z.object({
    total: count,
    previous_total: count,
    multiplier_exports: count,
    by_tool: list(toolSchema),
    by_plan: list(toolPlanSchema),
    by_format: list(z.object({ slug: z.string(), total: count, users: count })),
    series: list(toolDaySchema),
  }),
  credits: z.object({
    by_reason: list(reasonSchema),
    granted: count,
    spent: count,
    expired: count,
    outstanding: count,
    outstanding_subscription: count,
    outstanding_purchased: count,
    wallets_with_balance: count,
    held: count,
    series: list(z.object({ day: z.string(), granted: count, spent: count })),
    top_spenders: z.array(spenderSchema).nullable(),
  }),
  tokens: z.object({
    input: count,
    output: count,
    measured: count,
    unmeasured: count,
    cost_usd: usd,
    by_model: list(tokenModelSchema),
    series: list(z.object({ day: z.string(), input: count, output: count })),
    top_users: z.array(tokenUserSchema).nullable(),
  }),
})

export type Analytics = z.infer<typeof analyticsSchema>
export type ToolUsage = z.infer<typeof toolSchema>
export type Cohort = z.infer<typeof cohortSchema>
export type DormantUser = z.infer<typeof dormantSchema>

/** Fração segura: sem base, sem número (nunca 0% inventado). */
export const ratio = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null)

/** Variação contra o período anterior; nula sem base. */
export const change = (current: number, previous: number): number | null => (previous > 0 ? (current - previous) / previous : null)

/** Churn do mês: canceladas sobre as vivas no começo do mês. */
export const monthlyChurn = (month: { live_at_start: number; canceled: number }) => ratio(month.canceled, month.live_at_start)

export const LEDGER_REASON_LABELS: Readonly<Record<string, string>> = {
  signup_bonus: 'Boas-vindas',
  purchase: 'Pacote avulso',
  generation: 'Gerações',
  generation_refund: 'Estornos de falha',
  adjustment: 'Ajuste manual',
  subscription_grant: 'Créditos do plano',
  subscription_expire: 'Expirados no fim do ciclo',
}

export const KIND_LABELS: Readonly<Record<string, string>> = { image: 'Imagem', video: 'Vídeo', text: 'Texto' }

/** Tokens em formato curto: 1,2 mil, 3,4 mi. */
export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (value >= 1_000) return `${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return value.toLocaleString('pt-BR')
}
