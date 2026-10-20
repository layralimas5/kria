import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLAN_CATALOG } from './planCatalog'
import { subscriptionPlanSchema } from './plans'

const migration = (file: string) => fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations', file), 'utf8')
const seed = migration('0003_subscriptions.sql')
const benefits = migration('0004_plan_benefits.sql')
const pricing = migration('0005_pricing_v2.sql')

/** O `update` de uma migration que termina em `where slug = '<slug>'`. */
function updateFor(sql: string, slug: string): string {
  const block = sql.slice(0, sql.indexOf(`where slug = '${slug}'`))
  return block.slice(block.lastIndexOf('update public.subscription_plans'))
}

describe('PLAN_CATALOG', () => {
  it('tem o formato que a landing espera', () => {
    for (const plan of PLAN_CATALOG) expect(() => subscriptionPlanSchema.parse(plan)).not.toThrow()
  })

  it.each(PLAN_CATALOG)('$slug tem preço e limite do seed e os créditos da 0005', (plan) => {
    const row = `('${plan.slug}', '${plan.name}', '${plan.tagline}', ${plan.price_cents}, `
    expect(seed).toContain(row)
    expect(seed).toContain(`, ${plan.max_personas}, '${plan.cta_label}'`)
    const credits = updateFor(pricing, plan.slug).match(/monthly_credits = (\d+)/)?.[1]
    if (credits) expect(plan.monthly_credits).toBe(Number(credits))
    else expect(seed).toContain(`${row}${plan.monthly_credits}, ${plan.max_personas}`)
  })

  it.each(PLAN_CATALOG)('$slug tem os benefícios da 0005 e a comparação da 0004 com os créditos da 0005', (plan) => {
    const own = updateFor(pricing, plan.slug)
    for (const feature of plan.features) expect(own).toContain(`{"label": "${feature.label}", "soon": ${feature.soon}}`)
    const { credits, ...rest } = plan.comparison
    const comparison = updateFor(benefits, plan.slug)
    for (const [key, value] of Object.entries(rest)) expect(comparison).toContain(`"${key}": "${value}"`)
    expect(own.includes(`"credits": "${credits}"`) || comparison.includes(`"credits": "${credits}"`)).toBe(true)
  })
})
