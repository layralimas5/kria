// Guarda de gasto (0016): limite de consumo por plano e teto de custo da plataforma.
// A trava de verdade fica em `create_generation`; aqui só o que a tela precisa para mostrar.

import { z } from 'zod'

const numeric = z.coerce.number()
const optionalNumber = numeric.nullable()

/** Retorno de `my_usage()`: só créditos do próprio plano, nunca custo do fornecedor. */
export const usageSchema = z.object({
  plan_slug: z.string(),
  daily_limit: optionalNumber,
  monthly_limit: optionalNumber,
  used_today: numeric,
  used_month: numeric,
  /** Exportações editadas do Multiplicador no mês (0018). Nulo = sem limite. */
  exports_limit: optionalNumber.default(null),
  exports_used: numeric.default(0),
  day_resets_at: z.string(),
  month_resets_at: z.string(),
  paused: z.boolean(),
})
export type Usage = z.infer<typeof usageSchema>

/** Retorno de `admin_spend_guard()`; `top_today` é nulo para quem não tem `users.view`. */
export const spendGuardSchema = z.object({
  daily_cost_cap_usd: optionalNumber,
  monthly_cost_cap_usd: optionalNumber,
  cost_alert_ratio: numeric,
  generation_paused: z.boolean(),
  paused_reason: z.string().nullable(),
  spent_today_usd: numeric,
  spent_month_usd: numeric,
  failed_billed_month_usd: numeric,
  estimated_month_count: numeric,
  top_today: z
    .array(z.object({ user_id: z.string(), email: z.string().nullable(), credits: numeric, spend_usd: numeric }))
    .nullable(),
})
export type SpendGuard = z.infer<typeof spendGuardSchema>

export type GuardLevel = 'unlimited' | 'ok' | 'warning' | 'reached'

/** Onde o consumo está em relação ao teto. `warning` a partir da fração de alerta. */
export function guardLevel(used: number, limit: number | null, alertRatio: number): GuardLevel {
  if (limit === null) return 'unlimited'
  if (used >= limit) return 'reached'
  return used >= limit * alertRatio ? 'warning' : 'ok'
}

/** Fração usada, entre 0 e 1, para a barra de progresso. */
export function usedShare(used: number, limit: number | null): number {
  if (limit === null || limit <= 0) return 0
  return Math.min(1, Math.max(0, used / limit))
}

export interface SpendAlert {
  readonly text: string
  /** Grave = nenhuma geração passa agora. */
  readonly severe: boolean
}

/** Avisos do painel: pausa manual e tetos de custo em alerta ou atingidos. */
export function spendAlerts(guard: SpendGuard): SpendAlert[] {
  const alerts: SpendAlert[] = []
  if (guard.generation_paused) alerts.push({ text: `Gerações pausadas${guard.paused_reason ? `: ${guard.paused_reason}` : '.'}`, severe: true })
  const windows = [
    { label: 'de hoje', used: guard.spent_today_usd, cap: guard.daily_cost_cap_usd },
    { label: 'do mês', used: guard.spent_month_usd, cap: guard.monthly_cost_cap_usd },
  ]
  for (const { label, used, cap } of windows) {
    const level = guardLevel(used, cap, guard.cost_alert_ratio)
    if (level === 'reached') alerts.push({ text: `Teto ${label} atingido: novas gerações estão barradas até a virada.`, severe: true })
    if (level === 'warning') alerts.push({ text: `Custo ${label} passou de ${Math.round(guard.cost_alert_ratio * 100)}% do teto.`, severe: false })
  }
  if (guard.estimated_month_count > 0) {
    alerts.push({ text: `${guard.estimated_month_count} gerações do mês sem custo real cadastrado: a conta usa o pior caso.`, severe: false })
  }
  return alerts
}
