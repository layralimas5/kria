import { brtDay } from './timeline'
import type { CreditPack, LedgerEntry, LedgerReason, Model } from './types'

// Tela de Créditos: rendimento do saldo e dos pacotes, resumo do mês e filtros do extrato.

export type LedgerFilter = 'all' | 'in' | 'out'

export const REASON_LABELS: Readonly<Record<LedgerReason, string>> = {
  signup_bonus: 'Boas-vindas',
  purchase: 'Compra',
  generation: 'Geração',
  generation_refund: 'Estorno',
  adjustment: 'Ajuste',
  subscription_grant: 'Plano',
  subscription_expire: 'Fim do ciclo',
}

export function filterLedger<T extends Pick<LedgerEntry, 'delta'>>(entries: readonly T[], filter: LedgerFilter): T[] {
  if (filter === 'in') return entries.filter((entry) => entry.delta > 0)
  if (filter === 'out') return entries.filter((entry) => entry.delta < 0)
  return [...entries]
}

export interface MonthSummary {
  /** Créditos que entraram (plano, compra, bônus, ajuste positivo), sem contar estorno. */
  readonly received: number
  /** Créditos gastos em gerações, já descontado o que voltou por falha. */
  readonly spent: number
  readonly refunded: number
  readonly generations: number
}

/** Movimento do mês corrente em Brasília. */
export function monthSummary(entries: readonly Pick<LedgerEntry, 'delta' | 'reason' | 'created_at'>[], now: Date): MonthSummary {
  const month = brtDay(now).slice(0, 7)
  let received = 0
  let used = 0
  let refunded = 0
  let generations = 0
  for (const entry of entries) {
    if (brtDay(new Date(entry.created_at)).slice(0, 7) !== month) continue
    if (entry.reason === 'generation') {
      used += -entry.delta
      generations += 1
    } else if (entry.reason === 'generation_refund') refunded += entry.delta
    else if (entry.delta > 0) received += entry.delta
  }
  return { received, spent: Math.max(0, used - refunded), refunded, generations }
}

export interface ModelYield {
  readonly slug: string
  readonly name: string
  readonly kind: Model['kind']
  readonly count: number
}

/**
 * Quantas criações o valor paga em cada modelo do Studio, da mais barata para a mais cara.
 * É "uma OU outra": se usar tudo num modelo só.
 */
export function yieldByModel(credits: number, models: readonly Pick<Model, 'slug' | 'name' | 'kind' | 'credits' | 'studio'>[]): ModelYield[] {
  return models
    .filter((model) => model.studio && model.credits > 0)
    .map((model) => ({ slug: model.slug, name: model.name, kind: model.kind, count: Math.floor(credits / model.credits) }))
    .sort((a, b) => b.count - a.count)
}

/** Preço por crédito em reais, com 3 casas quando passa de centavo inteiro (pacote grande fica abaixo de R$ 0,05). */
export function pricePerCredit(pack: Pick<CreditPack, 'price_cents' | 'credits'>): string {
  const value = pack.price_cents / pack.credits / 100
  const digits = value < 0.1 ? 3 : 2
  return `R$ ${value.toFixed(digits).replace('.', ',')}`
}

/** Desconto do pacote em relação ao mais caro por crédito; 0 no próprio. */
export function packSavings(pack: Pick<CreditPack, 'price_cents' | 'credits'>, packs: readonly Pick<CreditPack, 'price_cents' | 'credits'>[]): number {
  const highest = Math.max(...packs.map((item) => item.price_cents / item.credits))
  if (!(highest > 0)) return 0
  return Math.max(0, Math.round((1 - pack.price_cents / pack.credits / highest) * 100))
}
