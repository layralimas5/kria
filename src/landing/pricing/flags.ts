/**
 * Vitrine dos preços v2 (Starter, Pro e Max lidos de `storefront_plans`). Ligada desde a virada de
 * 09/11/2026 (0027). `VITE_PRICING_V2=false` volta para a vitrine antiga, junto com a volta da virada
 * no admin (`admin_rollback_pricing_v2`).
 */
export const PRICING_V2 = import.meta.env.VITE_PRICING_V2 !== 'false'
