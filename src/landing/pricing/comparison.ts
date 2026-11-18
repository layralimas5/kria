import { z } from 'zod'
import { formatBRL } from '@/domain/format'
import { canUseModel, PLAN_TOOL_INFO, type PlanTool } from '@/domain/plans'
import { PLAN_COLUMNS, planSchema, type Model, type Plan } from '@/domain/types'
import { fetchModels } from '@/hooks/useCatalog'
import { supabase } from '@/lib/supabase'
import type { StorefrontPlan } from './storefront'

// "Comparar todos os recursos": preço, créditos e exportações vêm de `storefront_plans`; limites e
// ferramentas de `subscription_plans`; modelos liberados de `models.allowed_plans`. São os mesmos dados
// que travam o app, então a tabela nunca promete o que o plano não libera. Nada de número fixo aqui.

export interface PlanAccess {
  readonly plans: readonly Plan[]
  readonly models: readonly Model[]
}

export async function fetchPlanAccess(): Promise<PlanAccess> {
  const [plans, models] = await Promise.all([
    supabase
      .from('subscription_plans')
      .select(PLAN_COLUMNS)
      .then(({ data, error }) => {
        if (error) throw new Error(`subscription_plans: ${error.message}`)
        return z.array(planSchema).parse(data)
      }),
    fetchModels(),
  ])
  return { plans, models }
}

/** Valor de uma célula: texto, incluído ou não incluído. */
export type Cell = { readonly kind: 'text'; readonly value: string } | { readonly kind: 'yes' } | { readonly kind: 'no' }

export interface ComparisonRow {
  readonly label: string
  readonly cells: readonly Cell[]
}

export interface ComparisonGroup {
  readonly title: string
  readonly rows: readonly ComparisonRow[]
}

const text = (value: string): Cell => ({ kind: 'text', value })
const flag = (value: boolean): Cell => (value ? { kind: 'yes' } : { kind: 'no' })
const number = (value: number) => value.toLocaleString('pt-BR')

/** "Tudo do Starter" vira os itens do Starter, para a comparação saber o que cada plano herda. */
export function resolveFeatures(plan: StorefrontPlan, all: readonly StorefrontPlan[], seen = new Set<string>()): string[] {
  if (seen.has(plan.slug)) return []
  seen.add(plan.slug)
  return plan.features.flatMap((feature) => {
    const parent = feature.startsWith('Tudo do ') ? all.find((other) => other.name === feature.slice('Tudo do '.length)) : undefined
    return parent ? resolveFeatures(parent, all, seen) : [feature]
  })
}

// Itens da vitrine que não existem em coluna nenhuma do banco; só entram se algum plano tiver.
const EXTRAS = ['Comunidade Vynkio', 'Formatos prontos por nicho', 'Acesso antecipado a ferramentas novas'] as const
const TOOLS: readonly PlanTool[] = ['copy', 'ugc_studio', 'projects']

export function buildComparison(storefront: readonly StorefrontPlan[], access: PlanAccess, columns: readonly StorefrontPlan[]): ComparisonGroup[] {
  const limits = (slug: string) => access.plans.find((plan) => plan.slug === slug)
  const features = columns.map((plan) => resolveFeatures(plan, storefront))
  const imageModels = access.models.filter((model) => model.kind === 'image')
  const videoModels = access.models.filter((model) => model.kind === 'video')
  const fromLimits = (pick: (plan: Plan) => string) =>
    columns.map((column) => {
      const plan = limits(column.slug)
      return plan ? text(pick(plan)) : flag(false)
    })

  const support = features.map((items) => {
    const found = items.filter((item) => item.startsWith('Suporte'))
    return found.length > 0 ? text(found[found.length - 1] ?? '') : flag(false)
  })

  return [
    {
      title: 'Créditos e uso',
      rows: [
        { label: 'Preço', cells: columns.map((plan) => text(plan.price_cents === null ? 'Sob consulta' : plan.price_cents === 0 ? 'Grátis' : `${formatBRL(plan.price_cents)}/mês`)) },
        {
          label: 'Créditos de IA',
          cells: columns.map((plan) =>
            text(plan.monthly_credits === null ? 'Personalizado' : plan.price_cents === 0 ? `${number(plan.monthly_credits)} de boas-vindas` : `${number(plan.monthly_credits)} por mês`),
          ),
        },
        { label: 'Exportações editadas', cells: columns.map((plan) => text(plan.exports_month === null ? 'Personalizado' : `${number(plan.exports_month)} por mês`)) },
        { label: 'Gerações ao mesmo tempo', cells: fromLimits((plan) => number(plan.max_concurrent)) },
        { label: 'Variações por lote no Multiplicador', cells: fromLimits((plan) => `Até ${number(plan.max_variations)}`) },
      ],
    },
    {
      title: 'Criação',
      rows: [
        ...imageModels.map((model) => ({ label: `Imagem: ${model.name}`, cells: columns.map((plan) => flag(canUseModel(model.allowed_plans, plan.slug))) })),
        ...videoModels.map((model) => ({ label: `Vídeo: ${model.name}`, cells: columns.map((plan) => flag(canUseModel(model.allowed_plans, plan.slug))) })),
        { label: 'Personagens salvos', cells: fromLimits((plan) => (plan.max_personas === 1 ? '1' : `Até ${number(plan.max_personas)}`)) },
        { label: 'Marcas', cells: fromLimits((plan) => (plan.max_brands === 1 ? '1' : `Até ${number(plan.max_brands)}`)) },
        ...TOOLS.filter((tool) => PLAN_TOOL_INFO[tool].ready).map((tool) => ({
          label: PLAN_TOOL_INFO[tool].label,
          cells: columns.map((column) => flag(limits(column.slug)?.tools.includes(tool) ?? false)),
        })),
      ],
    },
    {
      title: 'Suporte e extras',
      rows: [
        { label: 'Suporte', cells: support },
        ...EXTRAS.filter((extra) => features.some((items) => items.includes(extra))).map((extra) => ({
          label: extra,
          cells: features.map((items) => flag(items.includes(extra))),
        })),
      ],
    },
  ]
}
