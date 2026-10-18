import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLAN_CATALOG } from './planCatalog'
import { subscriptionPlanSchema } from './plans'

const seed = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/0003_subscriptions.sql'), 'utf8')

describe('PLAN_CATALOG', () => {
  it('tem o formato que a landing espera', () => {
    for (const plan of PLAN_CATALOG) expect(() => subscriptionPlanSchema.parse(plan)).not.toThrow()
  })

  it.each(PLAN_CATALOG)('$slug tem preço, créditos e limite iguais ao seed do banco', (plan) => {
    const row = `('${plan.slug}', '${plan.name}', '${plan.tagline}', ${plan.price_cents}, ${plan.monthly_credits}, ${plan.max_personas}, '${plan.cta_label}'`
    expect(seed).toContain(row)
    for (const feature of plan.features) expect(seed).toContain(`{"label": "${feature.label}", "soon": ${feature.soon}}`)
  })
})
