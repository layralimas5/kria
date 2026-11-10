import type { FinancialSummary } from './commandCenter'

// Leitura de uma frase do período, no topo da central: o que a dona precisa saber antes de rolar.

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const percent = (value: number) => `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`

export interface Verdict {
  readonly tone: 'good' | 'bad' | 'neutral'
  readonly text: string
}

/** "Lucro de R$ 1.200 no período, margem de 42%." ou o que falta para haver número. */
export function pulseVerdict(summary: FinancialSummary | null): Verdict {
  if (!summary) return { tone: 'neutral', text: 'Os números de dinheiro aparecem para quem tem acesso ao financeiro.' }
  if (summary.grossCents === 0 && summary.totalCostsCents === 0) {
    return { tone: 'neutral', text: 'Sem receita nem custo registrados no período.' }
  }
  const growth =
    summary.grossChange === null || Math.abs(summary.grossChange) < 0.05
      ? ''
      : ` Receita ${summary.grossChange > 0 ? 'subiu' : 'caiu'} ${percent(Math.abs(summary.grossChange))} contra o período anterior.`
  if (summary.profitCents < 0) {
    return { tone: 'bad', text: `Prejuízo de ${brl(-summary.profitCents)} no período: os custos passaram a receita.${growth}` }
  }
  const margin = summary.profitMargin === null ? '' : `, margem de ${percent(summary.profitMargin)}`
  return { tone: 'good', text: `Lucro de ${brl(summary.profitCents)} no período${margin}.${growth}` }
}

/** Saudação pela hora de Brasília. */
export function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(now))
  if (hour < 5 || hour >= 18) return 'Boa noite'
  if (hour < 12) return 'Bom dia'
  return 'Boa tarde'
}
