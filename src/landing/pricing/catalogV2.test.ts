import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUSINESS_PLANS, CREATOR_PLANS, type V2Plan } from './catalogV2'

const MIGRATION = fs.readFileSync(path.resolve(__dirname, '../../../supabase/migrations/0018_pricing_v2.sql'), 'utf8')

interface SeedRow {
  readonly price_cents: number
  readonly monthly_credits: number
  readonly max_personas: number
  readonly max_brands: number
  readonly max_variations: number
  readonly exports: number | null
  readonly seats: number
  readonly contact_only: boolean
}

/** Linha do plano no `insert` da 0018, na ordem das colunas de lá. */
function seed(slug: string): SeedRow {
  const start = MIGRATION.indexOf(`('${slug}', `)
  if (start < 0) throw new Error(`plano ${slug} não está na 0018`)
  const row = MIGRATION.slice(start, MIGRATION.indexOf(')', MIGRATION.indexOf("'draft'", start)) + 1)
  const head = row.match(/^\('[^']+', '[^']*', '[^']*', (\d+), (\d+), \d+,/)
  const middle = row.match(/(?:false|true), (?:false|true), (?:false|true), \d+, (\d+), array\[[^\]]*\], (\d+), (?:\d+|null), (?:\d+|null), (\d+),/)
  const tail = row.match(/'(?:creator|business)', 'draft', (\d+|null), (\d+), (true|false)\)/)
  if (!head || !middle || !tail) throw new Error(`não deu para ler o plano ${slug} na 0018`)
  return {
    price_cents: Number(head[1]),
    monthly_credits: Number(head[2]),
    max_personas: Number(middle[1]),
    max_brands: Number(middle[2]),
    max_variations: Number(middle[3]),
    exports: tail[1] === 'null' ? null : Number(tail[1]),
    seats: Number(tail[2]),
    contact_only: tail[3] === 'true',
  }
}

const PAID: readonly V2Plan[] = [...CREATOR_PLANS.filter((plan) => plan.slug !== 'gratis'), ...BUSINESS_PLANS]

describe('vitrine v2', () => {
  it.each(PAID)('$slug mostra preço, créditos, exportações e usuários da 0018', (plan) => {
    const row = seed(plan.slug)
    expect(plan.price_cents ?? 0).toBe(row.price_cents)
    expect(plan.monthly_credits ?? 0).toBe(row.monthly_credits)
    expect(plan.exports_month).toBe(row.exports)
    if (plan.seats !== null) expect(plan.seats).toBe(row.seats)
  })

  it.each(PAID)('$slug só leva ao checkout se o plano é vendável', (plan) => {
    expect(plan.cta === 'contact').toBe(seed(plan.slug).contact_only)
  })

  it.each(PAID)('$slug promete o tamanho de lote e os limites que o banco aplica', (plan) => {
    const row = seed(plan.slug)
    const text = [...plan.features.map((feature) => feature.label), ...plan.limits].join(' ')
    const batch = text.match(/até (\d+) variações/i)
    if (batch) expect(Number(batch[1])).toBe(row.max_variations)
    const personas = text.match(/até (\d+) personagens/i)
    if (personas) expect(Number(personas[1])).toBe(row.max_personas)
    const brands = text.match(/(\d+) marcas/i)
    if (brands) expect(Number(brands[1])).toBe(row.max_brands)
  })

  it('Free mostra as exportações do plano grátis', () => {
    const free = CREATOR_PLANS.find((plan) => plan.slug === 'gratis')!
    expect(MIGRATION).toContain(`set max_exports_month = ${free.exports_month} where slug = 'gratis'`)
  })

  it('só um plano recomendado por aba, e é o Pro', () => {
    expect(CREATOR_PLANS.filter((plan) => plan.highlight).map((plan) => plan.slug)).toEqual(['creator-pro'])
    expect(BUSINESS_PLANS.filter((plan) => plan.highlight).map((plan) => plan.slug)).toEqual(['business-pro'])
  })

  it('Veo só é prometido onde o modelo libera', () => {
    const veoPlans = MIGRATION.match(/allowed_plans = allowed_plans \|\| array\[([^\]]*)\][^;]*where slug = 'video-veo'/)?.[1] ?? ''
    for (const plan of PAID) {
      const promises = plan.features.some((feature) => feature.label.includes('Veo') && !feature.soon)
      if (promises) expect(veoPlans).toContain(`'${plan.slug}'`)
    }
  })
})
