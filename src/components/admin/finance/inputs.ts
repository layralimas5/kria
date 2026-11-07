// Entradas do painel em formato brasileiro: "1.234,56" para reais, "6" ou "6,5" para porcentagem.

export function parseMoneyCents(value: string): number {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.')
  if (normalized === '') return 0
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : Number.NaN
}

export function parsePercent(value: string): number {
  const parsed = Number.parseFloat(value.trim().replace(',', '.'))
  return Number.isFinite(parsed) ? parsed / 100 : Number.NaN
}

export function parseDecimal(value: string): number {
  return Number.parseFloat(value.trim().replace(',', '.'))
}

export const moneyInput = (cents: number) => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const percentInput = (rate: number) => (rate * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
