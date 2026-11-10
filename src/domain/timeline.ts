// Datas no fuso de Brasília e agrupamento de listas por dia ("Hoje", "Ontem", mês).

const DAY_MS = 86_400_000
const BRT_OFFSET_MS = 3 * 3_600_000

/** "2026-11-10" no fuso de Brasília (sem horário de verão desde 2019). */
export const brtDay = (at: Date): string => new Date(at.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10)

/** Dias de calendário entre a data e hoje, em Brasília (0 = hoje). */
export function daysAgo(iso: string, now: Date): number {
  return Math.round((Date.parse(`${brtDay(now)}T00:00:00Z`) - Date.parse(`${brtDay(new Date(iso))}T00:00:00Z`)) / DAY_MS)
}

const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })

/** Rótulo da seção em que a data cai: Hoje, Ontem, Últimos 7 dias, Este mês ou "outubro de 2026". */
export function dayBucket(iso: string, now: Date): string {
  const days = daysAgo(iso, now)
  if (days <= 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  if (days < 7) return 'Últimos 7 dias'
  if (brtDay(new Date(iso)).slice(0, 7) === brtDay(now).slice(0, 7)) return 'Este mês'
  return monthLabel.format(new Date(iso))
}

export interface TimelineGroup<T> {
  readonly label: string
  readonly items: readonly T[]
}

/** Agrupa mantendo a ordem de entrada: a lista já chega ordenada. */
export function groupByBucket<T>(items: readonly T[], dateOf: (item: T) => string, now: Date): TimelineGroup<T>[] {
  const groups: { label: string; items: T[] }[] = []
  for (const item of items) {
    const label = dayBucket(dateOf(item), now)
    const last = groups.at(-1)
    if (last?.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}
