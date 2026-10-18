// Do custo do fornecedor (US$) ao preço em créditos, com folga de câmbio e markup.
// Os parâmetros vêm de `pricing_settings` e são editados no admin.

export interface PricingSettings {
  readonly usd_brl: number
  /** Folga sobre o câmbio, em fração (0,10 = 10%). */
  readonly fx_buffer: number
  /** Quantas vezes o custo a gente cobra (2,5 = margem bruta de 60%). */
  readonly markup: number
  /** Quanto vale um crédito no plano mais barato por crédito, em reais. */
  readonly credit_value_brl: number
}

/** Custo da geração em reais, já com a folga do câmbio. */
export function costInBrl(costUsd: number, settings: PricingSettings): number {
  return costUsd * settings.usd_brl * (1 + settings.fx_buffer)
}

/** Créditos que cobrem o custo com o markup desejado. */
export function suggestedCredits(costUsd: number, settings: PricingSettings): number {
  return Math.max(1, Math.ceil((costInBrl(costUsd, settings) * settings.markup) / settings.credit_value_brl))
}

/** Margem bruta de cobrar `credits` por uma geração que custa `costUsd`. Negativa = prejuízo. */
export function grossMargin(credits: number, costUsd: number, settings: PricingSettings): number {
  const revenue = credits * settings.credit_value_brl
  return revenue > 0 ? 1 - costInBrl(costUsd, settings) / revenue : -1
}
