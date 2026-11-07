/**
 * Vitrine dos preços v2 (Creator e Business). Desligada, a landing mostra os planos que estão à
 * venda hoje. Ligar só junto com a virada no admin (`admin_activate_pricing_v2`): antes dela os
 * planos v2 são rascunho e o checkout recusa.
 */
export const PRICING_V2 = import.meta.env.VITE_PRICING_V2 === 'true'
