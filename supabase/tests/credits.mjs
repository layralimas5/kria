// Testa a migration num Postgres de verdade (pglite), sem Docker.
// Roda com: npm run db:test
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const MIGRATIONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations')

const SUPABASE_STUBS = [
  `create role anon nologin`,
  `create role authenticated nologin`,
  `create role service_role nologin bypassrls`,
  `grant usage on schema public to anon, authenticated, service_role`,
  `alter default privileges in schema public grant all on tables to anon, authenticated, service_role`,
  `alter default privileges in schema public grant all on functions to anon, authenticated, service_role`,
  `create schema auth`,
  `create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb)`,
  `create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$`,
  `grant usage on schema auth to anon, authenticated, service_role`,
  `create schema storage`,
  `create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[])`,
  `create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid)`,
  `create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$`,
  `grant usage on schema storage to authenticated, service_role`,
  `grant select on storage.objects to authenticated`,
]

async function boot() {
  const db = new PGlite({ extensions: { pgcrypto } })
  for (const statement of SUPABASE_STUBS) await db.exec(statement)
  for (const file of fs.readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'))
  }
  return db
}

async function as(db, role, userId, fn) {
  await db.exec(`set role ${role}`)
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(userId ? { sub: userId } : {})])
  try {
    return await fn()
  } finally {
    await db.exec(`reset role`)
  }
}

async function expectError(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.match(error.message, new RegExp(code))
    return true
  })
}

const balanceOf = async (db, userId) =>
  (await db.query(`select balance from credit_balances where user_id = $1`, [userId])).rows[0].balance

async function newUser(db, email) {
  const { rows } = await db.query(`insert into auth.users (email) values ($1) returning id`, [email])
  return rows[0].id
}

const create = (db, userId, model, prompt = 'retrato de uma mulher no café', persona = null, source = null) =>
  db.query(`select * from create_generation($1, $2, $3, $4, $5)`, [userId, model, prompt, persona, source])

let passed = 0
async function test(name, fn) {
  const db = await boot()
  await fn(db)
  passed += 1
  console.log(`ok  ${name}`)
}

await test('conta nova ganha 20 créditos com uma linha no extrato', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  assert.equal(await balanceOf(db, ana), 20)
  const ledger = await db.query(`select delta, reason from credit_ledger where user_id = $1`, [ana])
  assert.deepEqual(ledger.rows, [{ delta: 20, reason: 'signup_bonus' }])
})

await test('gerar debita o preço do modelo e registra no extrato', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const { rows } = await create(db, ana, 'foto')
  assert.equal(rows[0].status, 'queued')
  assert.equal(rows[0].credits, 5)
  assert.equal(await balanceOf(db, ana), 15)
})

await test('sem saldo não gera e não debita', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await db.query(`update credit_balances set balance = 4 where user_id = $1`, [ana])
  await expectError(create(db, ana, 'foto'), 'insufficient_credits')
  assert.equal(await balanceOf(db, ana), 4)
  assert.equal((await db.query(`select count(*)::int as n from generations`)).rows[0].n, 0)
})

await test('no máximo 3 gerações abertas por pessoa', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  for (let i = 0; i < 3; i += 1) await create(db, ana, 'foto')
  await expectError(create(db, ana, 'foto'), 'too_many_running')
  assert.equal(await balanceOf(db, ana), 5)
})

await test('modelo que pede imagem exige persona ou imagem de origem da própria pessoa', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  await db.query(`update credit_balances set balance = 500`)
  await expectError(create(db, ana, 'video-kling'), 'image_required')

  const { rows } = await create(db, bia, 'foto')
  await db.query(`select complete_generation($1, $2, 'image/png')`, [rows[0].id, `${bia}/${rows[0].id}.png`])
  await expectError(create(db, ana, 'video-kling', 'ela sorri', null, rows[0].id), 'source_not_found')

  const ok = await create(db, bia, 'video-kling', 'ela sorri', null, rows[0].id)
  assert.equal(ok.rows[0].kind, 'video')
  await expectError(create(db, ana, 'foto', 'teste', null, rows[0].id), 'model_takes_no_image')
})

await test('falha estorna uma vez só, mesmo chamada duas vezes', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const { rows } = await create(db, ana, 'foto')
  const first = await db.query(`select fail_generation($1, 'timeout') as ok`, [rows[0].id])
  const second = await db.query(`select fail_generation($1, 'timeout') as ok`, [rows[0].id])
  assert.equal(first.rows[0].ok, true)
  assert.equal(second.rows[0].ok, false)
  assert.equal(await balanceOf(db, ana), 20)
})

await test('geração concluída não pode mais falhar nem estornar', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const { rows } = await create(db, ana, 'foto')
  await db.query(`select complete_generation($1, 'x.png', 'image/png')`, [rows[0].id])
  const failed = await db.query(`select fail_generation($1, 'tarde') as ok`, [rows[0].id])
  assert.equal(failed.rows[0].ok, false)
  assert.equal(await balanceOf(db, ana), 15)
})

await test('compra paga credita uma vez, mesmo com webhook repetido', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const { rows } = await db.query(
    `insert into purchases (user_id, pack_slug, credits, price_cents) values ($1, 'criador', 300, 4990) returning id`,
    [ana],
  )
  const first = await db.query(`select grant_purchase($1, 'pay_1') as ok`, [rows[0].id])
  const again = await db.query(`select grant_purchase($1, 'pay_1') as ok`, [rows[0].id])
  assert.equal(first.rows[0].ok, true)
  assert.equal(again.rows[0].ok, false)
  assert.equal(await balanceOf(db, ana), 320)
})

await test('persona só nasce de imagem própria concluída, via auth.uid()', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  const { rows } = await create(db, ana, 'foto')
  const generationId = rows[0].id

  await as(db, 'authenticated', ana, () =>
    expectError(db.query(`select * from create_persona($1, 'Luna')`, [generationId]), 'source_not_found'),
  )
  await db.query(`select complete_generation($1, $2, 'image/png')`, [generationId, `${ana}/${generationId}.png`])

  await as(db, 'authenticated', bia, () =>
    expectError(db.query(`select * from create_persona($1, 'Luna')`, [generationId]), 'source_not_found'),
  )
  const persona = await as(db, 'authenticated', ana, () =>
    db.query(`select * from create_persona($1, 'Luna', 'criadora fitness')`, [generationId]),
  )
  assert.equal(persona.rows[0].image_path, `${ana}/${generationId}.png`)
})

await test('cliente não chama as funções de crédito nem escreve no saldo', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await as(db, 'authenticated', ana, async () => {
    await expectError(create(db, ana, 'foto'), 'permission denied')
    await expectError(db.query(`select grant_purchase(gen_random_uuid())`), 'permission denied')
    await expectError(db.query(`update credit_balances set balance = 9999`), 'permission denied')
    await expectError(db.query(`insert into credit_ledger (user_id, delta, reason) values ($1, 999, 'adjustment')`, [ana]), 'permission denied')
  })
})

await test('RLS: cada pessoa só enxerga o que é dela', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  await create(db, ana, 'foto')
  await create(db, bia, 'foto')
  const seen = await as(db, 'authenticated', ana, async () => ({
    generations: (await db.query(`select user_id from generations`)).rows,
    balances: (await db.query(`select user_id from credit_balances`)).rows,
    ledger: (await db.query(`select distinct user_id from credit_ledger`)).rows,
    models: (await db.query(`select slug from models`)).rows.length,
  }))
  assert.deepEqual(seen.generations, [{ user_id: ana }])
  assert.deepEqual(seen.balances, [{ user_id: ana }])
  assert.deepEqual(seen.ledger, [{ user_id: ana }])
  assert.equal(seen.models, 4)
})

await test('conta nova ganha um @ único e válido a partir do e-mail', async (db) => {
  const a = await newUser(db, 'Ana.Souza@x.com')
  const b = await newUser(db, 'ana.souza@y.com')
  const { rows } = await db.query(`select id, username from profiles where id in ($1, $2)`, [a, b])
  for (const row of rows) assert.match(row.username, /^anasouza\d{4}$/)
  assert.notEqual(rows[0].username, rows[1].username)
  const short = await newUser(db, 'x@x.com')
  const { rows: shortRows } = await db.query(`select username from profiles where id = $1`, [short])
  assert.match(shortRows[0].username, /^vynkio\d{4}$/)
})

await test('perfil: a pessoa edita o próprio, com avatar só da própria pasta', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  await as(db, 'authenticated', ana, async () => {
    await db.query(`update profiles set bio = 'Crio conteúdo', username = 'ana_cria', avatar_path = $2 where id = $1`, [ana, `${ana}/g1.png`])
    await expectError(db.query(`update profiles set avatar_path = $2 where id = $1`, [ana, `${bia}/g1.png`]), 'row-level security')
    const other = await db.query(`update profiles set bio = 'invadido' where id = $1 returning id`, [bia])
    assert.equal(other.rows.length, 0)
  })
  const { rows } = await db.query(`select bio, username from profiles where id = $1`, [ana])
  assert.deepEqual(rows[0], { bio: 'Crio conteúdo', username: 'ana_cria' })
})

await test('perfil: @ repetido ou fora do formato é recusado', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  await db.query(`update profiles set username = 'luna' where id = $1`, [ana])
  await expectError(db.query(`update profiles set username = 'luna' where id = $1`, [bia]), 'profiles_username_key')
  await expectError(db.query(`update profiles set username = 'Com Espaço' where id = $1`, [bia]), 'profiles_username_format')
  await expectError(db.query(`update profiles set instagram = 'https://x' where id = $1`, [bia]), 'check')
})

await test('perfil: cliente não muda campos fora da lista (id, created_at)', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await as(db, 'authenticated', ana, () =>
    expectError(db.query(`update profiles set created_at = now() - interval '1 year' where id = $1`, [ana]), 'permission denied'),
  )
})

console.log(`\n${passed} testes do banco passaram`)
