import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CREDIT_PACKS, GENERATION_COSTS } from './costs'

const MIGRATIONS = path.resolve(__dirname, '../../../supabase/migrations')
const sql = fs
  .readdirSync(MIGRATIONS)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'))
  .join('\n')

/** Créditos do modelo: o seed e depois cada `update public.models set credits`. */
function modelCredits(slug: string): number {
  // Seed: ('slug', 'nome', 'descrição', 'kind', ..., <créditos>, '{defaults}'; a linha quebra
  // depois do kind e não tem parêntese até os créditos.
  const seed = sql.match(new RegExp(`\\('${slug}', '[^']*', '[^']*', '(?:image|video|text)',[^(]*?, (\\d+), '\\{`))
  let value = seed ? Number(seed[1]) : NaN
  for (const [, credits] of sql.matchAll(new RegExp(`update public\\.models set credits = (\\d+)[^;]*where slug = '${slug}'`, 'g'))) {
    value = Number(credits)
  }
  return value
}

/** Créditos ou preço do pacote: o seed e depois cada `update public.credit_packs`. */
function packValue(slug: string, column: 'credits' | 'price_cents'): number {
  const seed = sql.match(new RegExp(`\\('${slug}', '[^']*', (\\d+), (\\d+),`))
  let value = seed ? Number(seed[column === 'credits' ? 1 : 2]) : NaN
  for (const [, updated] of sql.matchAll(new RegExp(`update public\\.credit_packs set ${column} = (\\d+) where slug = '${slug}'`, 'g'))) {
    value = Number(updated)
  }
  return value
}

describe('custo por geração na vitrine', () => {
  it.each(GENERATION_COSTS)('$slug custa o que o app cobra', (cost) => {
    expect(cost.credits).toBe(modelCredits(cost.slug))
  })

  it.each(CREDIT_PACKS)('pacote $slug tem os créditos e o preço do banco', (pack) => {
    expect(pack.credits).toBe(packValue(pack.slug, 'credits'))
    expect(pack.price_cents).toBe(packValue(pack.slug, 'price_cents'))
  })
})
