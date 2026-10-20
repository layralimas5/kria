import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLAN_CATALOG } from './planCatalog'
import { subscriptionPlanSchema } from './plans'

const migration = (file: string) => fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations', file), 'utf8')
const seed = migration('0003_subscriptions.sql')
const benefits = migration('0004_plan_benefits.sql')

describe('PLAN_CATALOG', () => {
  it('tem o formato que a landing espera', () => {
    for (const plan of PLAN_CATALOG) expect(() => subscriptionPlanSchema.parse(plan)).not.toThrow()
  })

  it.each(PLAN_CATALOG)('$slug tem preço, créditos e limite iguais ao seed do banco', (plan) => {
    const row = `('${plan.slug}', '${plan.name}', '${plan.tagline}', ${plan.price_cents}, ${plan.monthly_credits}, ${plan.max_personas}, '${plan.cta_label}'`
    expect(seed).toContain(row)
  })

  it.each(PLAN_CATALOG)('$slug tem os mesmos benefícios e comparação da 0004', (plan) => {
    const block = benefits.slice(0, benefits.indexOf(`where slug = '${plan.slug}'`))
    const own = block.slice(block.lastIndexOf('update public.subscription_plans'))
    for (const feature of plan.features) expect(own).toContain(`{"label": "${feature.label}", "soon": ${feature.soon}}`)
    for (const [key, value] of Object.entries(plan.comparison)) expect(own).toContain(`"${key}": "${value}"`)
  })
})
