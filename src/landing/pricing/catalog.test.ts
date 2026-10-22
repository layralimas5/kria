import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLAN_CATALOG } from './catalog'
import { FREE_PLAN } from './freePlan'

// Junta todas as migrations na ordem: o último `update` de cada coisa é o que vale no banco.
const MIGRATIONS = path.resolve(__dirname, '../../../supabase/migrations')
const sql = fs
  .readdirSync(MIGRATIONS)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'))
  .join('\n')

/** Valor que o banco termina com, para o plano: o seed da 0004 e depois cada `update ... where slug`. */
function finalValue(slug: string, column: 'price_cents' | 'monthly_credits' | 'max_personas' | 'max_brands'): number {
  // Seed: (slug, nome, descrição, preço, créditos, ...). O limite de personagens só vem em `update`.
  const seed = sql.match(new RegExp(`\\('${slug}', '[^']*', '[^']*', (\\d+), (\\d+),`))
  const seedIndex = { price_cents: 1, monthly_credits: 2, max_personas: null, max_brands: null }[column]
  let value = seed && seedIndex ? Number(seed[seedIndex]) : NaN
  // O corpo não pode atravessar o `where` de outro plano.
  const updates = sql.matchAll(new RegExp(`update public\\.subscription_plans set((?:(?!where slug)[\\s\\S])*?)where slug = '${slug}'`, 'g'))
  for (const [, body = ''] of updates) {
    const match = body.match(new RegExp(`${column} = (\\d+)`))
    if (match) value = Number(match[1])
  }
  return value
}

/** Planos que podem gerar com o Veo 3.1, pelo último `update` da tabela `models`. */
function veoPlans(): string[] {
  const updates = [...sql.matchAll(/set allowed_plans = array\[([^\]]*)\][^;]*where slug = 'video-veo'/g)]
  const last = updates.at(-1)?.[1] ?? ''
  return [...last.matchAll(/'([a-z0-9-]+)'/g)].map((match) => match[1] ?? '')
}

describe('vitrine de planos', () => {
  it.each(PLAN_CATALOG)('$slug mostra o preço e os créditos que o app cobra', (plan) => {
    expect(plan.price_cents).toBe(finalValue(plan.slug, 'price_cents'))
    expect(plan.monthly_credits).toBe(finalValue(plan.slug, 'monthly_credits'))
  })

  it.each([FREE_PLAN, ...PLAN_CATALOG])('$slug promete o limite de personagens que o app aplica', (plan) => {
    expect(plan.max_personas).toBe(finalValue(plan.slug, 'max_personas'))
  })

  it.each([FREE_PLAN, ...PLAN_CATALOG])('$slug promete o limite de marcas que o app aplica', (plan) => {
    expect(plan.max_brands).toBe(finalValue(plan.slug, 'max_brands'))
  })

  it.each([FREE_PLAN, ...PLAN_CATALOG])('$slug só promete Veo 3.1 se o app libera', (plan) => {
    expect(plan.comparison.veo === 'yes').toBe(veoPlans().includes(plan.slug))
  })
})
