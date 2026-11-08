// Formatos do financeiro no painel: porcentagem com uma casa, número e reais a partir de centavos.

export const formatPercent = (value: number | null) => (value === null ? '–' : `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)

export const formatNumber = (value: number) => value.toLocaleString('pt-BR')

/** Diferença em pontos percentuais, com sinal: +4,8 p.p. */
export const formatPoints = (value: number) => `${value > 0 ? '+' : ''}${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`

export const formatUsd = (value: number | null) => (value === null ? 'sem custo' : `US$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}`)

export const formatBrlValue = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
