import { z } from 'zod'

// Usuários no admin (0025 `admin_users_list` e `admin_user_profile`). Filtros combinam no banco;
// aqui ficam o contrato e os rótulos.

const num = z.coerce.number()
const nullableNum = z.coerce.number().nullable()

export const USERS_PAGE_SIZE = 25

export const userRowSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  display_name: z.string().nullable(),
  username: z.string(),
  avatar_path: z.string().nullable(),
  created_at: z.string(),
  last_sign_in_at: z.string().nullable(),
  suspended_at: z.string().nullable(),
  manual: z.boolean(),
  plan_slug: z.string(),
  subscription_status: z.string().nullable(),
  courtesy: z.boolean(),
  balance: num,
  consumed: num,
  generations: num,
  ai_cost_brl: nullableNum,
})
export type UserRow = z.infer<typeof userRowSchema>

export const userPageSchema = z.object({ total: num, rows: z.array(userRowSchema) })
export type UserPage = z.infer<typeof userPageSchema>

export const USER_SORTS = ['recent', 'active', 'credits', 'cost', 'seen'] as const
export type UserSort = (typeof USER_SORTS)[number]

export const SORT_LABELS: Readonly<Record<UserSort, string>> = {
  recent: 'Cadastro mais recente',
  active: 'Mais ativos (gerações)',
  credits: 'Mais créditos consumidos',
  cost: 'Maior custo de IA',
  seen: 'Acesso mais recente',
}

export interface UserFilters {
  readonly query: string
  readonly plan: string | null
  readonly subscription: string | null
  readonly account: 'active' | 'suspended' | null
  readonly createdFrom: string
  readonly createdTo: string
  readonly seen: '7d' | '30d' | 'idle30' | null
  readonly credits: 'with' | 'without' | null
  readonly manual: boolean | null
  readonly sort: UserSort
}

export const EMPTY_USER_FILTERS: UserFilters = {
  query: '',
  plan: null,
  subscription: null,
  account: null,
  createdFrom: '',
  createdTo: '',
  seen: null,
  credits: null,
  manual: null,
  sort: 'recent',
}

/** Quantos filtros estão ligados (a ordenação não conta). */
export function activeFilterCount(filters: UserFilters): number {
  const { sort: _sort, ...rest } = filters
  return Object.values(rest).filter((value) => value !== null && value !== '').length
}

export const SUBSCRIPTION_FILTER_LABELS: Readonly<Record<string, string>> = {
  none: 'Nunca assinou',
  active: 'Ativa',
  past_due: 'Em atraso',
  canceled: 'Cancelada',
  expired: 'Encerrada',
}

const ledgerSchema = z.object({
  id: num,
  delta: num,
  reason: z.string(),
  note: z.string().nullable(),
  balance_after: nullableNum,
  created_at: z.string(),
})

export const userProfileSchema = z.object({
  account: z.object({
    id: z.string(),
    email: z.string().nullable(),
    display_name: z.string().nullable(),
    username: z.string(),
    avatar_path: z.string().nullable(),
    created_at: z.string(),
    last_sign_in_at: z.string().nullable(),
    email_confirmed: z.boolean(),
    suspended_at: z.string().nullable(),
    suspended_reason: z.string().nullable(),
    created_by_admin_email: z.string().nullable(),
    balance: num,
    subscription_balance: num,
    purchased_balance: num,
  }),
  plan: z.object({ slug: z.string(), name: z.string() }),
  grant: z
    .object({ id: z.string(), plan_slug: z.string(), starts_at: z.string(), ends_at: z.string(), reason: z.string(), granted_by_email: z.string().nullable() })
    .nullable(),
  subscriptions: z.array(
    z.object({
      id: z.string(),
      plan_slug: z.string(),
      status: z.string(),
      price_cents: num,
      current_period_start: z.string().nullable(),
      current_period_end: z.string().nullable(),
      canceled_at: z.string().nullable(),
      ended_at: z.string().nullable(),
      created_at: z.string(),
    }),
  ),
  credits: z.object({ received: z.record(num), consumed: num, refunded: num }),
  ledger: z.array(ledgerSchema),
  generations: z.array(
    z.object({
      id: z.string(),
      model_slug: z.string(),
      model_name: z.string().nullable(),
      kind: z.string(),
      status: z.string(),
      credits: num,
      error: z.string().nullable(),
      created_at: z.string(),
      cost_brl: nullableNum,
      cost_basis: z.string().nullable(),
    }),
  ),
  top_models: z.array(z.object({ model_slug: z.string(), name: z.string().nullable(), total: num, credits: num })),
  ai_cost: z.object({ total_brl: num, last_30d_brl: num, metered: num, estimated: num, unknown: num }).nullable(),
  activity: z.object({ active_days_30d: num, generations_30d: num, last_generation_at: z.string().nullable() }),
  payments: z.array(z.object({ type: z.string(), amount_cents: num, status: z.string(), at: z.string() })).nullable(),
  admin_actions: z
    .array(
      z.object({
        id: num,
        action: z.string(),
        reason: z.string().nullable(),
        details: z.record(z.unknown()),
        result: z.string(),
        created_at: z.string(),
        admin_email: z.string().nullable(),
      }),
    )
    .nullable(),
})
export type UserProfile = z.infer<typeof userProfileSchema>

export const ADMIN_ACTION_LABELS: Readonly<Record<string, string>> = {
  'credits.adjust': 'Ajuste de créditos',
  'user.suspend': 'Conta bloqueada',
  'user.unsuspend': 'Conta reativada',
  'user.create': 'Conta criada pelo admin',
  'user.plan_grant': 'Plano de cortesia',
  'user.plan_revoke': 'Cortesia encerrada',
  'user.password': 'Senha trocada pelo admin',
  'user.reset_link': 'E-mail de redefinição de senha',
  'user.view_as': 'Visualizou como usuário',
}

/** Nome para mostrar e iniciais do avatar. */
export const displayName = (user: { display_name: string | null; username: string }) => user.display_name?.trim() || user.username

export function initials(name: string): string {
  const parts = name.replace(/[@._-]/g, ' ').trim().split(/\s+/)
  return ((parts[0]?.[0] ?? 'V') + (parts[1]?.[0] ?? '')).toUpperCase()
}

// ------------------------------------------------------------ ver como usuário (0031)

/** Retorno da function `admin-users` com `action: 'view'`: o Dashboard da pessoa, só leitura. */
export const userViewSchema = z.object({
  profile: z.object({
    id: z.string(),
    display_name: z.string().nullable(),
    username: z.string(),
    avatar_path: z.string().nullable(),
    email: z.string().nullable(),
    created_at: z.string(),
  }),
  goal: z.string().nullable(),
  plan: z.object({
    slug: z.string(),
    name: z.string(),
    price_cents: num,
    monthly_credits: num,
    max_concurrent: num,
    daily_credit_limit: nullableNum,
    monthly_credit_limit: nullableNum,
  }),
  wallet: z.object({ balance: num, subscription_balance: num, purchased_balance: num }),
  subscription: z
    .object({
      id: z.string(),
      plan_slug: z.string(),
      status: z.string(),
      price_cents: num,
      monthly_credits: num,
      current_period_start: z.string().nullable(),
      current_period_end: z.string().nullable(),
      canceled_at: z.string().nullable(),
      created_at: z.string(),
    })
    .nullable(),
  usage: z.object({ used_today: num, used_month: num, daily_limit: nullableNum, monthly_limit: nullableNum }),
  generations: z.array(
    z.object({
      id: z.string(),
      model_slug: z.string(),
      model_name: z.string().nullable(),
      kind: z.enum(['image', 'video']),
      prompt: z.string(),
      status: z.enum(['queued', 'running', 'succeeded', 'failed']),
      credits: num,
      output_path: z.string().nullable(),
      output_type: z.string().nullable(),
      error: z.string().nullable(),
      created_at: z.string(),
      completed_at: z.string().nullable(),
    }),
  ),
  personas: z.array(z.object({ id: z.string(), name: z.string(), image_path: z.string() })),
  media_urls: z.record(z.string()),
})
export type UserView = z.infer<typeof userViewSchema>
