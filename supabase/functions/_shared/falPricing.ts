// API de preço do fal (só consulta, não gera nada): GET /v1/models/pricing?endpoint_id=a,b.
// Docs: https://fal.ai/docs/platform-apis/v1/models/pricing. Devolve o preço base por unidade,
// sem os ajustes de resolução e áudio; a comparação no banco aceita qualquer um dos preços guardados.

export const FAL_PRICING_URL = 'https://api.fal.ai/v1/models/pricing'
const MAX_ENDPOINTS = 50

export interface FalPrice {
  readonly endpoint_id: string
  readonly unit_price: number
  readonly unit: string
  readonly currency: string
}

export function pricingUrl(endpoints: readonly string[]): string {
  const unique = [...new Set(endpoints)].slice(0, MAX_ENDPOINTS)
  return `${FAL_PRICING_URL}?endpoint_id=${unique.map(encodeURIComponent).join(',')}`
}

/** Lê a resposta do fal; ignora item fora do formato em vez de inventar preço. */
export function parsePrices(body: unknown): FalPrice[] {
  if (typeof body !== 'object' || body === null || !Array.isArray((body as { prices?: unknown }).prices)) return []
  return (body as { prices: unknown[] }).prices.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const row = item as Record<string, unknown>
    if (typeof row.endpoint_id !== 'string' || typeof row.unit_price !== 'number' || !Number.isFinite(row.unit_price)) return []
    return [{ endpoint_id: row.endpoint_id, unit_price: row.unit_price, unit: String(row.unit ?? ''), currency: String(row.currency ?? '') }]
  })
}

export async function fetchFalPrices(key: string, endpoints: readonly string[]): Promise<FalPrice[]> {
  if (endpoints.length === 0) return []
  const response = await fetch(pricingUrl(endpoints), { headers: { Authorization: `Key ${key}` } })
  if (!response.ok) throw new Error(`fal pricing ${response.status}: ${(await response.text()).slice(0, 200)}`)
  return parsePrices(await response.json())
}
