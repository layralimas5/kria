import { formatBRL } from '@/domain/format'

// Formatos da central. Dinheiro em centavos vira `R$ 1.234,56`; eixos usam a forma curta.

const compactNumber = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

export const money = (cents: number | null) => (cents === null ? null : formatBRL(cents))
export const moneyFromBrl = (brl: number | null) => (brl === null ? null : formatBRL(Math.round(brl * 100)))
export const axisBrl = (brl: number) => `${brl < 0 ? '−' : ''}R$ ${compactNumber.format(Math.abs(brl))}`
export const count = (value: number) => Math.round(value).toLocaleString('pt-BR')
export const pct = (value: number | null) => (value === null ? null : `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
export const seconds = (value: number) => (value >= 90 ? `${(value / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} min` : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`)
