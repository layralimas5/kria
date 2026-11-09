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
  `create table auth.users (id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz default now(), raw_user_meta_data jsonb default '{}'::jsonb, last_sign_in_at timestamptz)`,
  `create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$`,
  `create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$`,
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

/** Sessão com segundo fator (aal2) por padrão; `aal1` imita quem só digitou a senha. */
async function as(db, role, userId, fn, aal = 'aal2') {
  await db.exec(`set role ${role}`)
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(userId ? { sub: userId, aal } : {})])
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

const create = (db, userId, model, prompt = 'retrato de uma mulher no café', persona = null, source = null, key = null) =>
  db.query(`select * from create_generation($1, $2, $3, $4, $5, $6)`, [userId, model, prompt, persona, source, key])

/** Põe saldo direto nos baldes, como se tivesse vindo de compra e de plano. */
const setWallet = (db, userId, purchased, subscription = 0) =>
  db.query(
    `update credit_balances set purchased_balance = $2, subscription_balance = $3, balance = $2::int + $3::int where user_id = $1`,
    [userId, purchased, subscription],
  )

const walletOf = async (db, userId) =>
  (await db.query(`select balance, subscription_balance, purchased_balance from credit_balances where user_id = $1`, [userId])).rows[0]

async function newSubscription(db, userId, plan = 'pro') {
  const { rows } = await db.query(
    `insert into subscriptions (user_id, plan_slug, price_cents, monthly_credits)
     select $1, slug, price_cents, monthly_credits from subscription_plans where slug = $2 returning id`,
    [userId, plan],
  )
  return rows[0].id
}

const activate = (db, subscriptionId, paymentId, providerId = null) =>
  db.query(`select activate_subscription_period($1, $2, 7990, current_date, null, $3) as result`, [subscriptionId, paymentId, providerId])

async function makeAdmin(db, userId, role = 'super_admin') {
  await db.query(`insert into admin_users (user_id, role) values ($1, $2)`, [userId, role])
}

let passed = 0
// DB_TEST_ONLY="admin|dashboard" roda só os testes cujo nome casa com a expressão (cada um sobe um Postgres).
const only = process.env.DB_TEST_ONLY
async function test(name, fn) {
  if (only && !new RegExp(only).test(name)) return
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
  await setWallet(db, ana, 4)
  await expectError(create(db, ana, 'foto'), 'insufficient_credits')
  assert.equal(await balanceOf(db, ana), 4)
  assert.equal((await db.query(`select count(*)::int as n from generations`)).rows[0].n, 0)
})

await test('o limite de gerações abertas vem do plano (grátis: 2, pro: 4)', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  for (let i = 0; i < 2; i += 1) await create(db, ana, 'foto')
  await expectError(create(db, ana, 'foto'), 'too_many_running')
  assert.equal(await balanceOf(db, ana), 10)

  await activate(db, await newSubscription(db, ana, 'pro'), 'pay_1')
  for (let i = 0; i < 2; i += 1) await create(db, ana, 'foto')
  await expectError(create(db, ana, 'foto'), 'too_many_running')
})

await test('modelo que pede imagem exige persona ou imagem de origem da própria pessoa', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  await setWallet(db, ana, 500)
  await setWallet(db, bia, 500)
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
    await expectError(db.query(`select wallet_move($1, 0, 999, 'adjustment', 'x')`, [ana]), 'permission denied')
    await expectError(db.query(`select activate_subscription_period(gen_random_uuid(), 'p', 1)`), 'permission denied')
    await expectError(db.query(`select expire_lapsed_subscriptions()`), 'permission denied')
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
  // 10 até a 0016 + o Multiplicador (0017).
  assert.equal(seen.models, 11)
  await as(db, 'authenticated', ana, () =>
    expectError(db.query(`select provider_cost_usd from models`), 'permission denied'),
  )
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

await test('gera gastando primeiro o crédito do plano e estorna para os mesmos baldes', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await setWallet(db, ana, 100, 3)
  const { rows } = await create(db, ana, 'foto')
  assert.deepEqual(await walletOf(db, ana), { balance: 98, subscription_balance: 0, purchased_balance: 98 })

  const reservation = (await db.query(`select * from credit_reservations where generation_id = $1`, [rows[0].id])).rows[0]
  assert.equal(reservation.status, 'held')
  assert.equal(reservation.subscription_amount, 3)
  assert.equal(reservation.purchased_amount, 2)

  await db.query(`select fail_generation($1, 'erro do modelo')`, [rows[0].id])
  assert.deepEqual(await walletOf(db, ana), { balance: 103, subscription_balance: 3, purchased_balance: 100 })
  const released = (await db.query(`select status from credit_reservations where generation_id = $1`, [rows[0].id])).rows[0]
  assert.equal(released.status, 'released')
})

await test('geração concluída captura a reserva', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const { rows } = await create(db, ana, 'foto')
  await db.query(`select complete_generation($1, 'x.png', 'image/png')`, [rows[0].id])
  const { rows: reservation } = await db.query(`select status from credit_reservations where generation_id = $1`, [rows[0].id])
  assert.equal(reservation[0].status, 'captured')
})

await test('a mesma chave idempotente não cobra duas vezes', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await create(db, ana, 'foto', 'um café na varanda', null, null, 'clique-0001')
  await expectError(create(db, ana, 'foto', 'um café na varanda', null, null, 'clique-0001'), 'duplicate_request')
  assert.equal(await balanceOf(db, ana), 15)
  // A mesma chave de outra pessoa não colide.
  const bia = await newUser(db, 'bia@x.com')
  await create(db, bia, 'foto', 'um café na varanda', null, null, 'clique-0001')
  const charges = await db.query(`select count(*)::int as n from credit_ledger where user_id = $1 and reason = 'generation'`, [ana])
  assert.equal(charges.rows[0].n, 1)
})

await test('extrato guarda o saldo depois de cada movimento', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await create(db, ana, 'foto')
  const { rows } = await db.query(`select delta, balance_after from credit_ledger where user_id = $1 order by id`, [ana])
  assert.deepEqual(rows, [{ delta: 20, balance_after: 20 }, { delta: -5, balance_after: 15 }])
})

await test('extrato é imutável, mas some junto com a conta excluída', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await expectError(db.query(`update credit_ledger set delta = 999 where user_id = $1`, [ana]), 'ledger_is_immutable')
  await expectError(db.query(`delete from credit_ledger where user_id = $1`, [ana]), 'ledger_is_immutable')
  await db.query(`delete from auth.users where id = $1`, [ana])
  const { rows } = await db.query(`select count(*)::int as n from credit_ledger where user_id = $1`, [ana])
  assert.equal(rows[0].n, 0)
})

await test('ciclo pago da assinatura credita uma vez, mesmo com webhook repetido', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const sub = await newSubscription(db, ana, 'pro')
  const first = await activate(db, sub, 'pay_1', 'sub_asaas_1')
  const again = await activate(db, sub, 'pay_1', 'sub_asaas_1')
  assert.equal(first.rows[0].result.outcome, 'activated')
  assert.equal(again.rows[0].result.outcome, 'already_applied')
  assert.deepEqual(await walletOf(db, ana), { balance: 470, subscription_balance: 450, purchased_balance: 20 })
  const { rows } = await db.query(
    `select status, provider_subscription_id, current_period_end > now() as live from subscriptions where id = $1`,
    [sub],
  )
  assert.deepEqual(rows[0], { status: 'active', provider_subscription_id: 'sub_asaas_1', live: true })
})

await test('na renovação o crédito do plano não acumula; o comprado fica', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const sub = await newSubscription(db, ana, 'starter')
  await activate(db, sub, 'pay_1')
  await create(db, ana, 'foto')
  assert.deepEqual(await walletOf(db, ana), { balance: 315, subscription_balance: 295, purchased_balance: 20 })
  await activate(db, sub, 'pay_2')
  assert.deepEqual(await walletOf(db, ana), { balance: 320, subscription_balance: 300, purchased_balance: 20 })
  const reasons = await db.query(
    `select reason, delta from credit_ledger where user_id = $1 and reason::text like 'subscription%' order by id`,
    [ana],
  )
  assert.deepEqual(reasons.rows, [
    { reason: 'subscription_grant', delta: 300 },
    { reason: 'subscription_expire', delta: -295 },
    { reason: 'subscription_grant', delta: 300 },
  ])
})

await test('trocar de plano encerra a assinatura anterior e devolve o id dela para cancelar no Asaas', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const starter = await newSubscription(db, ana, 'starter')
  await activate(db, starter, 'pay_1', 'sub_old')
  const studio = await newSubscription(db, ana, 'studio')
  const { rows } = await activate(db, studio, 'pay_2', 'sub_new')
  assert.deepEqual(rows[0].result.replaced, ['sub_old'])
  const statuses = await db.query(`select plan_slug, status from subscriptions where user_id = $1`, [ana])
  assert.deepEqual(statuses.rows.map((row) => `${row.plan_slug}:${row.status}`).sort(), ['starter:expired', 'studio:active'])
  assert.equal((await walletOf(db, ana)).subscription_balance, 1000)
})

await test('assinatura vencida expira e zera só o balde do plano', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const sub = await newSubscription(db, ana, 'pro')
  await activate(db, sub, 'pay_1')
  await db.query(`update subscriptions set current_period_end = now() - interval '4 days' where id = $1`, [sub])
  // A expiração é preguiçosa: acontece na próxima geração.
  await create(db, ana, 'foto')
  assert.deepEqual(await walletOf(db, ana), { balance: 15, subscription_balance: 0, purchased_balance: 15 })
  const { rows } = await db.query(`select status from subscriptions where id = $1`, [sub])
  assert.equal(rows[0].status, 'expired')
})

await test('cancelada continua valendo até o fim do período pago', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const sub = await newSubscription(db, ana, 'pro')
  await activate(db, sub, 'pay_1')
  await db.query(`select set_subscription_status($1, 'canceled')`, [sub])
  const planOf = async () => (await db.query(`select (effective_plan($1)).slug as slug`, [ana])).rows[0].slug
  assert.equal(await planOf(), 'pro')
  await db.query(`update subscriptions set current_period_end = now() - interval '1 minute' where id = $1`, [sub])
  const { rows } = await db.query(`select expire_lapsed_subscriptions() as closed`)
  assert.equal(rows[0].closed, 1)
  assert.equal(await planOf(), 'gratis')
  assert.equal((await walletOf(db, ana)).subscription_balance, 0)
})

await test('atraso só vale para assinatura ativa', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const sub = await newSubscription(db, ana, 'pro')
  const pending = await db.query(`select set_subscription_status($1, 'past_due') as ok`, [sub])
  assert.equal(pending.rows[0].ok, false)
  await activate(db, sub, 'pay_1')
  const active = await db.query(`select set_subscription_status($1, 'past_due') as ok`, [sub])
  assert.equal(active.rows[0].ok, true)
  const { rows } = await db.query(`select (effective_plan($1)).slug as slug`, [ana])
  assert.equal(rows[0].slug, 'pro')
})

await test('modelo restrito a planos exige o plano certo', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await setWallet(db, ana, 500)
  await db.query(`update models set allowed_plans = array['pro', 'studio'] where slug = 'foto'`)
  await expectError(create(db, ana, 'foto'), 'plan_required')
  await activate(db, await newSubscription(db, ana, 'pro'), 'pay_1')
  const { rows } = await create(db, ana, 'foto')
  assert.equal(rows[0].status, 'queued')
})

await test('conta suspensa não gera', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await db.query(`update profiles set suspended_at = now() where id = $1`, [ana])
  await expectError(create(db, ana, 'foto'), 'account_suspended')
  assert.equal(await balanceOf(db, ana), 20)
})

await test('admin: quem não é admin não chama nada do painel', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await as(db, 'authenticated', ana, async () => {
    assert.equal((await db.query(`select is_admin() as ok`)).rows[0].ok, false)
    await expectError(db.query(`select admin_dashboard(now() - interval '1 day', now())`), 'forbidden')
    await expectError(db.query(`select * from admin_search_users('')`), 'forbidden')
    await expectError(db.query(`select admin_adjust_credits($1, 1000, 'quero mais')`, [ana]), 'forbidden')
    await expectError(db.query(`select admin_update_plan('pro', 100, 99999, 20, true, null)`), 'forbidden')
    await expectError(db.query(`insert into admin_users (user_id) values ($1)`, [ana]), 'permission denied')
    assert.equal((await db.query(`select count(*)::int as n from admin_audit_logs`)).rows[0].n, 0)
  })
})

await test('admin: ajuste de crédito precisa de motivo, não deixa negativo e fica auditado', async (db) => {
  const lay = await newUser(db, 'lay@x.com')
  const ana = await newUser(db, 'ana@x.com')
  await makeAdmin(db, lay)
  await as(db, 'authenticated', lay, async () => {
    await expectError(db.query(`select admin_adjust_credits($1, 50, '')`, [ana]), 'reason_required')
    await expectError(db.query(`select admin_adjust_credits($1, -500, 'estorno manual')`, [ana]), 'insufficient_credits')
    const { rows } = await db.query(`select admin_adjust_credits($1, 50, 'Compensação por falha') as balance`, [ana])
    assert.equal(rows[0].balance, 70)
    const audit = await db.query(`select action, target_user_id, reason from admin_audit_logs`)
    assert.deepEqual(audit.rows, [{ action: 'credits.adjust', target_user_id: ana, reason: 'Compensação por falha' }])
  })
  const ledger = await db.query(`select reason, actor_id from credit_ledger where user_id = $1 and reason = 'adjustment'`, [ana])
  assert.deepEqual(ledger.rows, [{ reason: 'adjustment', actor_id: lay }])
})

await test('admin: busca, suspensão, plano e modelo', async (db) => {
  const lay = await newUser(db, 'lay@x.com')
  const ana = await newUser(db, 'ana.souza@x.com')
  await makeAdmin(db, lay)
  const proVersion = (await db.query(`select version from subscription_plans where slug = 'pro'`)).rows[0].version
  await as(db, 'authenticated', lay, async () => {
    const found = await db.query(`select id, email, balance from admin_search_users('souza')`)
    assert.deepEqual(found.rows, [{ id: ana, email: 'ana.souza@x.com', balance: 20 }])

    await db.query(`select admin_set_suspended($1, true, 'Uso abusivo de prompts')`, [ana])
    await expectError(db.query(`select admin_set_suspended($1, true, 'teste de si')`, [lay]), 'cannot_suspend_self')

    const plan = await db.query(`select * from admin_update_plan('pro', 8990, 800, 4, true, null)`)
    assert.equal(plan.rows[0].version, proVersion + 1)

    await db.query(`select admin_update_model('video-veo', true, 250, 3.2, array['pro', 'studio'])`)
    await expectError(db.query(`select admin_update_model('foto', true, 5, null, array['vip'])`), 'plan_not_found')

    const dash = (await db.query(`select admin_dashboard(now() - interval '1 day', now() + interval '1 day') as d`)).rows[0].d
    assert.equal(dash.users.total, 2)
    assert.equal(dash.finance.by_plan.length, 3)
  })
  await expectError(create(db, ana, 'foto'), 'account_suspended')
  const veo = await db.query(`select credits, provider_cost_usd::float as cost, allowed_plans from models where slug = 'video-veo'`)
  assert.deepEqual(veo.rows[0], { credits: 250, cost: 3.2, allowed_plans: ['pro', 'studio'] })
  const actions = await db.query(`select action from admin_audit_logs order by id`)
  assert.deepEqual(actions.rows.map((row) => row.action), ['user.suspend', 'plan.update', 'model.update'])
})

await test('preferências: cada pessoa grava só a própria meta', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  await as(db, 'authenticated', ana, async () => {
    await db.query(`update user_preferences set goal = 'ugc_ads', onboarded_at = now() where user_id = $1`, [ana])
    const other = await db.query(`update user_preferences set goal = 'images' where user_id = $1 returning user_id`, [bia])
    assert.equal(other.rows.length, 0)
    await expectError(db.query(`update user_preferences set goal = 'hackear' where user_id = $1`, [ana]), 'check')
  })
  const { rows } = await db.query(`select goal from user_preferences where user_id = $1`, [ana])
  assert.equal(rows[0].goal, 'ugc_ads')
})

/** Gera e conclui uma foto para poder virar persona. */
async function finishedImage(db, userId) {
  const { rows } = await create(db, userId, 'foto')
  await db.query(`select complete_generation($1, $2, 'image/png')`, [rows[0].id, `${userId}/${rows[0].id}.png`])
  return rows[0].id
}

const savePersona = (db, userId, generationId) =>
  as(db, 'authenticated', userId, () => db.query(`select * from create_persona($1, 'Luna')`, [generationId]))

await test('o limite de personagens vem do plano (grátis 1, starter 2, pro 5, studio 15)', async (db) => {
  const { rows } = await db.query(`select slug, max_personas from subscription_plans where status = 'live' order by position`)
  assert.deepEqual(rows, [
    { slug: 'gratis', max_personas: 1 },
    { slug: 'starter', max_personas: 2 },
    { slug: 'pro', max_personas: 5 },
    { slug: 'studio', max_personas: 15 },
  ])

  const ana = await newUser(db, 'ana@x.com')
  await setWallet(db, ana, 500)
  await savePersona(db, ana, await finishedImage(db, ana))
  await expectError(savePersona(db, ana, await finishedImage(db, ana)), 'too_many_personas')

  await activate(db, await newSubscription(db, ana, 'starter'), 'pay_1')
  await savePersona(db, ana, await finishedImage(db, ana))
  await expectError(savePersona(db, ana, await finishedImage(db, ana)), 'too_many_personas')
})

await test('Veo 3.1 gera em qualquer plano pago, não no Grátis', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const { rows } = await create(db, ana, 'foto')
  await db.query(`select complete_generation($1, $2, 'image/png')`, [rows[0].id, `${ana}/${rows[0].id}.png`])
  await setWallet(db, ana, 0, 1000)

  await expectError(create(db, ana, 'video-veo', 'ela acena', null, rows[0].id), 'plan_required')
  const kling = await create(db, ana, 'video-kling', 'ela acena', null, rows[0].id)
  assert.equal(kling.rows[0].status, 'queued')

  await activate(db, await newSubscription(db, ana, 'starter'), 'pay_1')
  const veo = await create(db, ana, 'video-veo', 'ela acena', null, rows[0].id)
  assert.equal(veo.rows[0].status, 'queued')
})

await test('ferramentas do menu por plano', async (db) => {
  const { rows } = await db.query(`select slug, tools from subscription_plans where status = 'live' order by position`)
  assert.deepEqual(rows, [
    { slug: 'gratis', tools: ['copy'] },
    { slug: 'starter', tools: ['copy'] },
    { slug: 'pro', tools: ['copy', 'ugc_studio'] },
    { slug: 'studio', tools: ['copy', 'ugc_studio', 'projects'] },
  ])
  await expectError(db.query(`update subscription_plans set tools = array['hackear'] where slug = 'pro'`), 'check')
})

const newBrand = (db, userId, name = 'Café da Ana') =>
  as(db, 'authenticated', userId, () => db.query(`insert into brands (name, tone) values ($1, 'leve') returning id`, [name]))

const newProject = (db, userId, brandId = null, name = 'Lançamento') =>
  as(db, 'authenticated', userId, () =>
    db.query(`insert into projects (name, brand_id) values ($1, $2) returning id`, [name, brandId]),
  )

await test('marcas: o limite vem do plano (grátis 1, pro 3)', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await newBrand(db, ana)
  await expectError(newBrand(db, ana, 'Outra'), 'too_many_brands')

  await activate(db, await newSubscription(db, ana, 'pro'), 'pay_1')
  await newBrand(db, ana, 'Segunda')
  await newBrand(db, ana, 'Terceira')
  await expectError(newBrand(db, ana, 'Quarta'), 'too_many_brands')
})

await test('marcas: cada pessoa vê e edita só as próprias, sem trocar o dono', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  const { rows } = await newBrand(db, ana)
  const brandId = rows[0].id

  const seen = await as(db, 'authenticated', bia, () => db.query(`select id from brands`))
  assert.equal(seen.rows.length, 0)
  const changed = await as(db, 'authenticated', bia, () => db.query(`update brands set name = 'roubada' where id = $1`, [brandId]))
  assert.equal(changed.affectedRows, 0)
  await expectError(
    as(db, 'authenticated', ana, () => db.query(`update brands set user_id = $2 where id = $1`, [brandId, bia])),
    'permission denied',
  )
  await expectError(
    as(db, 'authenticated', bia, () => db.query(`insert into brands (user_id, name) values ($1, 'falsa')`, [ana])),
    'permission denied',
  )
})

await test('projetos: só no plano com a ferramenta, e só com marca própria', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  await expectError(newProject(db, ana), 'plan_required')

  await activate(db, await newSubscription(db, ana, 'studio'), 'pay_1')
  const brandOfBia = (await newBrand(db, bia)).rows[0].id
  await expectError(newProject(db, ana, brandOfBia), 'brand_not_found')

  const brandOfAna = (await newBrand(db, ana)).rows[0].id
  const { rows } = await newProject(db, ana, brandOfAna)
  assert.ok(rows[0].id)
})

await test('geração só aponta para marca e projeto do próprio dono', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  const brandOfBia = (await newBrand(db, bia)).rows[0].id
  const brandOfAna = (await newBrand(db, ana)).rows[0].id
  const { rows } = await create(db, ana, 'foto')

  await expectError(db.query(`update generations set brand_id = $2 where id = $1`, [rows[0].id, brandOfBia]), 'brand_not_found')
  await db.query(`update generations set brand_id = $2 where id = $1`, [rows[0].id, brandOfAna])
  const saved = await db.query(`select brand_id from generations where id = $1`, [rows[0].id])
  assert.equal(saved.rows[0].brand_id, brandOfAna)
})

await test('texto: cobra 3 créditos, conclui com o resultado e captura a reserva', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const { rows } = await create(db, ana, 'copy', 'legenda para o café novo')
  assert.equal(rows[0].kind, 'text')
  assert.equal(await balanceOf(db, ana), 17)

  const output = JSON.stringify({ title: 'Legendas', items: [] })
  const done = await db.query(`select complete_text_generation($1, $2) as ok`, [rows[0].id, output])
  assert.equal(done.rows[0].ok, true)
  const again = await db.query(`select complete_text_generation($1, $2) as ok`, [rows[0].id, output])
  assert.equal(again.rows[0].ok, false)

  const saved = await db.query(`select status, output_text from generations where id = $1`, [rows[0].id])
  assert.deepEqual(saved.rows[0], { status: 'succeeded', output_text: output })
  const reservation = await db.query(`select status from credit_reservations where generation_id = $1`, [rows[0].id])
  assert.equal(reservation.rows[0].status, 'captured')
})

await test('texto: falha estorna e o cliente não conclui sozinho', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const { rows } = await create(db, ana, 'roteiro', 'roteiro de reels sobre o café')
  await db.query(`select fail_generation($1, 'recusado')`, [rows[0].id])
  assert.equal(await balanceOf(db, ana), 20)

  const other = await create(db, ana, 'ideias', 'pautas da semana')
  await expectError(
    as(db, 'authenticated', ana, () => db.query(`select complete_text_generation($1, '{}')`, [other.rows[0].id])),
    'permission denied',
  )
})

await test('roteiro UGC é do Pro e do Studio', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await expectError(create(db, ana, 'ugc-roteiro', 'review do creme'), 'plan_required')
  await activate(db, await newSubscription(db, ana, 'pro'), 'pay_1')
  const { rows } = await create(db, ana, 'ugc-roteiro', 'review do creme')
  assert.equal(rows[0].status, 'queued')
})

// ------------------------------------------------------- contexto de marca (0011)

const setActiveBrand = (db, userId, brandId) =>
  as(db, 'authenticated', userId, () =>
    db.query(
      `insert into user_preferences (user_id, active_brand_id) values ($1, $2)
       on conflict (user_id) do update set active_brand_id = excluded.active_brand_id`,
      [userId, brandId],
    ),
  )

await test('marca ativa só aponta para marca própria e some quando a marca é apagada', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  const brandOfBia = (await newBrand(db, bia)).rows[0].id
  await expectError(setActiveBrand(db, ana, brandOfBia), 'brand_not_found')

  const brandOfAna = (await newBrand(db, ana)).rows[0].id
  await setActiveBrand(db, ana, brandOfAna)
  await as(db, 'authenticated', ana, () => db.query(`delete from brands where id = $1`, [brandOfAna]))
  const { rows } = await db.query(`select active_brand_id from user_preferences where user_id = $1`, [ana])
  assert.equal(rows[0].active_brand_id, null)
})

await test('perfil da marca aceita só plataformas conhecidas', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const brandId = (await newBrand(db, ana)).rows[0].id
  const edit = (platforms) =>
    as(db, 'authenticated', ana, () =>
      db.query(`update brands set platforms = $2, goals = 'vender o kit' where id = $1`, [brandId, platforms]),
    )
  await edit(['instagram', 'tiktok'])
  await expectError(edit(['orkut']), 'check constraint')
})

await test('personagem só liga a marca própria e só o dono muda', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  const persona = (await savePersona(db, ana, await finishedImage(db, ana))).rows[0].id
  const brandOfBia = (await newBrand(db, bia)).rows[0].id
  const brandOfAna = (await newBrand(db, ana)).rows[0].id
  const link = (userId, brandId) =>
    as(db, 'authenticated', userId, () => db.query(`update personas set brand_id = $2 where id = $1`, [persona, brandId]))

  await expectError(link(ana, brandOfBia), 'brand_not_found')
  const stolen = await link(bia, brandOfBia)
  assert.equal(stolen.affectedRows ?? 0, 0)
  await link(ana, brandOfAna)
  const { rows } = await db.query(`select brand_id from personas where id = $1`, [persona])
  assert.equal(rows[0].brand_id, brandOfAna)
  await expectError(
    as(db, 'authenticated', ana, () => db.query(`update personas set name = 'Outra' where id = $1`, [persona])),
    'permission denied',
  )
})

await test('cliente lê as opções do modelo', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const { rows } = await as(db, 'authenticated', ana, () => db.query(`select options from models where slug = 'foto'`))
  assert.deepEqual(rows[0].options.aspect_ratio, ['4:5', '1:1', '9:16', '16:9'])
})

await test('planejamento editorial é texto de 3 créditos para todos os planos', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const { rows } = await create(db, ana, 'planejamento', 'um mês de posts para a loja de café')
  assert.equal(rows[0].kind, 'text')
  assert.equal(await balanceOf(db, ana), 17)
})

// --------------------------------------------------------------- conteúdos (0012)

const newContent = (db, userId, fields = {}) => {
  const row = { title: 'Reels da rotina', status: 'idea', brand_id: null, asset_ids: [], source_generation_id: null, ...fields }
  return as(db, 'authenticated', userId, () =>
    db.query(
      `insert into content_items (title, status, brand_id, asset_ids, source_generation_id)
       values ($1, $2, $3, $4, $5) returning id, status, published_at`,
      [row.title, row.status, row.brand_id, row.asset_ids, row.source_generation_id],
    ),
  )
}

await test('conteúdo só aponta para marca, imagem e texto do próprio dono', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  const brandOfBia = (await newBrand(db, bia)).rows[0].id
  await expectError(newContent(db, ana, { brand_id: brandOfBia }), 'brand_not_found')

  const imageOfBia = await finishedImage(db, bia)
  await expectError(newContent(db, ana, { asset_ids: [imageOfBia] }), 'asset_not_found')

  const imageOfAna = await finishedImage(db, ana)
  await expectError(newContent(db, ana, { source_generation_id: imageOfAna }), 'source_not_found')
  const { rows } = await newContent(db, ana, { asset_ids: [imageOfAna] })
  assert.equal(rows[0].status, 'idea')
})

await test('imagem ainda gerando não entra no conteúdo', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const open = (await create(db, ana, 'foto')).rows[0].id
  await expectError(newContent(db, ana, { asset_ids: [open] }), 'asset_not_found')
})

await test('publicado marca a data e voltar o status apaga', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const { rows } = await newContent(db, ana, { status: 'published' })
  assert.ok(rows[0].published_at)
  const back = await as(db, 'authenticated', ana, () =>
    db.query(`update content_items set status = 'review' where id = $1 returning published_at`, [rows[0].id]),
  )
  assert.equal(back.rows[0].published_at, null)
})

await test('RLS: conteúdo de uma pessoa não aparece nem muda para outra', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  const { rows } = await newContent(db, ana)
  const seen = await as(db, 'authenticated', bia, () => db.query(`select id from content_items`))
  assert.equal(seen.rows.length, 0)
  const changed = await as(db, 'authenticated', bia, () =>
    db.query(`update content_items set title = 'roubado' where id = $1`, [rows[0].id]),
  )
  assert.equal(changed.affectedRows ?? 0, 0)
  await expectError(
    as(db, 'authenticated', ana, () => db.query(`update content_items set published_at = now() where id = $1`, [rows[0].id])),
    'permission denied',
  )
})

// --------------------------------------------------------------- resultados (0013)

const importRows = (db, userId, rows, brandId = null) =>
  as(db, 'authenticated', userId, () =>
    db.query(`select import_analytics('instagram', $1, 'export.csv', $2::jsonb) as id`, [brandId, JSON.stringify(rows)]),
  )

await test('importação grava tudo com origem e período, e métrica ausente fica nula', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const { rows } = await importRows(db, ana, [
    { metric_date: '2026-10-01', views: 1200, likes: 80 },
    { metric_date: '2026-10-03', views: 900, reach: 700 },
  ])
  const saved = await as(db, 'authenticated', ana, () =>
    db.query(`select source, row_count, period_start::text, period_end::text from analytics_imports where id = $1`, [rows[0].id]),
  )
  assert.deepEqual(saved.rows[0], { source: 'manual_csv', row_count: 2, period_start: '2026-10-01', period_end: '2026-10-03' })
  const snapshots = await as(db, 'authenticated', ana, () => db.query(`select reach from analytics_snapshots order by metric_date`))
  assert.equal(snapshots.rows[0].reach, null)
})

await test('linha inválida derruba a importação inteira', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await expectError(importRows(db, ana, [{ metric_date: '2026-10-01', views: 10 }, { metric_date: '2026-10-02', views: -5 }]), 'check constraint')
  await expectError(importRows(db, ana, [{ metric_date: '31/10/2026', views: 10 }]), 'date')
  const count = await db.query(`select count(*)::int as n from analytics_imports`)
  assert.equal(count.rows[0].n, 0)
})

await test('métricas: só o dono lê, ninguém grava direto e apagar a importação leva as linhas', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  const brandOfBia = (await newBrand(db, bia)).rows[0].id
  await expectError(importRows(db, ana, [{ metric_date: '2026-10-01', views: 1 }], brandOfBia), 'brand_not_found')
  const { rows } = await importRows(db, ana, [{ metric_date: '2026-10-01', views: 1 }])
  const seen = await as(db, 'authenticated', bia, () => db.query(`select id from analytics_snapshots`))
  assert.equal(seen.rows.length, 0)
  await expectError(
    as(db, 'authenticated', ana, () =>
      db.query(`insert into analytics_snapshots (import_id, user_id, platform, metric_date) values ($1, $2, 'instagram', '2026-10-01')`, [rows[0].id, ana]),
    ),
    'permission denied',
  )
  await as(db, 'authenticated', ana, () => db.query(`delete from analytics_imports where id = $1`, [rows[0].id]))
  const left = await db.query(`select count(*)::int as n from analytics_snapshots`)
  assert.equal(left.rows[0].n, 0)
})

// ------------------------------------------------------- admin, etapa 1 (0014)

const PERIOD = `now() - interval '1 day', now() + interval '1 day'`

await test('admin: cada papel chama só o que a matriz libera', async (db) => {
  const ids = {}
  for (const role of ['super_admin', 'admin', 'support', 'finance', 'analyst']) {
    ids[role] = await newUser(db, `${role}@x.com`)
    await makeAdmin(db, ids[role], role)
  }
  const ana = await newUser(db, 'ana@x.com')

  await as(db, 'authenticated', ids.support, async () => {
    assert.equal((await db.query(`select count(*)::int as n from admin_search_users('ana@')`)).rows[0].n, 1)
    const detail = (await db.query(`select admin_user_detail($1) as d`, [ana])).rows[0].d
    assert.equal(detail.payments, null)
    await expectError(db.query(`select admin_adjust_credits($1, 10, 'presente do suporte')`, [ana]), 'forbidden')
    await expectError(db.query(`select admin_set_suspended($1, true, 'teste de suporte')`, [ana]), 'forbidden')
    await expectError(db.query(`select admin_list_admins()`), 'forbidden')
    await expectError(db.query(`select admin_pricing()`), 'forbidden')
    assert.equal((await db.query(`select admin_dashboard(${PERIOD}) ->> 'finance' as f`)).rows[0].f, null)
  })
  await as(db, 'authenticated', ids.finance, async () => {
    const detail = (await db.query(`select admin_user_detail($1) as d`, [ana])).rows[0].d
    assert.deepEqual(detail.payments, [])
    assert.notEqual((await db.query(`select admin_dashboard(${PERIOD}) ->> 'finance' as f`)).rows[0].f, null)
    assert.equal(Number((await db.query(`select (admin_pricing()).payment_fee_rate as r`)).rows[0].r), 0.035)
    await expectError(db.query(`select admin_adjust_credits($1, 10, 'ajuste financeiro')`, [ana]), 'forbidden')
  })
  await as(db, 'authenticated', ids.analyst, async () => {
    await expectError(db.query(`select * from admin_search_users('')`), 'forbidden')
    const dash = (await db.query(`select admin_dashboard(${PERIOD}) as d`)).rows[0].d
    assert.equal(dash.finance, null)
    assert.equal(dash.top_consumers, null)
  })
  await as(db, 'authenticated', ids.admin, async () => {
    await db.query(`select admin_adjust_credits($1, 10, 'Compensação de falha')`, [ana])
    await expectError(db.query(`select admin_update_plan('pro', 100, 99999, 20, true, null)`), 'forbidden')
    await expectError(db.query(`select admin_update_pricing(5, 0.1, 2, 0.15)`), 'forbidden')
    await expectError(db.query(`select admin_list_admins()`), 'forbidden')
  })
  await as(db, 'authenticated', ids.super_admin, async () => {
    const me = (await db.query(`select admin_me() as me`)).rows[0].me
    assert.equal(me.role, 'super_admin')
    assert.ok(me.permissions.includes('admins.manage'))
    assert.equal((await db.query(`select jsonb_array_length(admin_list_admins()) as n`)).rows[0].n, 5)
  })
})

await test('admin: sem segundo fator (aal1) nada abre, mas admin_me avisa', async (db) => {
  const lay = await newUser(db, 'lay@x.com')
  const ana = await newUser(db, 'ana@x.com')
  await makeAdmin(db, lay)
  await as(
    db,
    'authenticated',
    lay,
    async () => {
      assert.equal((await db.query(`select admin_me() ->> 'aal' as aal`)).rows[0].aal, 'aal1')
      await expectError(db.query(`select admin_dashboard(${PERIOD})`), 'mfa_required')
      await expectError(db.query(`select admin_adjust_credits($1, 10, 'sem segundo fator')`, [ana]), 'mfa_required')
      assert.equal((await db.query(`select count(*)::int as n from admin_audit_logs`)).rows[0].n, 0)
    },
    'aal1',
  )
  await as(db, 'authenticated', ana, async () => {
    assert.equal((await db.query(`select admin_me() as me`)).rows[0].me, null)
  })
})

await test('admin: papel só muda por super_admin, nunca no próprio, e fica auditado', async (db) => {
  const lay = await newUser(db, 'lay@x.com')
  const ana = await newUser(db, 'Ana@X.com')
  await makeAdmin(db, lay)
  await as(db, 'authenticated', lay, async () => {
    await expectError(db.query(`select admin_set_role('lay@x.com', 'support', 'me rebaixar')`), 'cannot_change_self')
    await expectError(db.query(`select admin_remove_admin($1, 'sair do painel')`, [lay]), 'cannot_change_self')
    await expectError(db.query(`select admin_set_role('ninguem@x.com', 'support', 'conta inexistente')`), 'user_not_found')
    await expectError(db.query(`select admin_set_role('ana@x.com', 'support', '')`), 'reason_required')
    await db.query(`select admin_set_role('ana@x.com', 'support', 'Atendimento do lançamento')`)
    await db.query(`select admin_set_role('ana@x.com', 'admin', 'Promovida para operação')`)
  })
  await as(db, 'authenticated', ana, async () => {
    await expectError(db.query(`select admin_set_role('ana@x.com', 'super_admin', 'quero tudo')`), 'forbidden')
    await expectError(db.query(`update admin_users set role = 'super_admin' where user_id = $1`, [ana]), 'permission denied')
    await expectError(db.query(`insert into admin_users (user_id, role) values ($1, 'super_admin')`, [ana]), 'permission denied')
  })
  await as(db, 'authenticated', lay, async () => {
    await db.query(`select admin_remove_admin($1, 'Fim do contrato')`, [ana])
  })
  const audit = await db.query(`select action, entity, target_user_id, details from admin_audit_logs order by id`)
  assert.deepEqual(
    audit.rows.map((row) => [row.action, row.entity, row.target_user_id]),
    [['admin.grant', 'admin', ana], ['admin.role_change', 'admin', ana], ['admin.revoke', 'admin', ana]],
  )
  assert.deepEqual(audit.rows[1].details, { before: 'support', after: 'admin' })
  assert.equal((await db.query(`select count(*)::int as n from admin_users`)).rows[0].n, 1)
})

await test('auditoria: não se edita nem se apaga; o autor vira nulo quando a conta sai', async (db) => {
  const lay = await newUser(db, 'lay@x.com')
  const ana = await newUser(db, 'ana@x.com')
  await makeAdmin(db, lay)
  await as(db, 'authenticated', lay, () => db.query(`select admin_adjust_credits($1, 10, 'Compensação de falha')`, [ana]))
  await expectError(db.query(`update admin_audit_logs set reason = 'outro motivo'`), 'audit_is_immutable')
  await expectError(db.query(`delete from admin_audit_logs`), 'audit_is_immutable')
  await db.query(`delete from auth.users where id = $1`, [lay])
  const left = await db.query(`select admin_id, reason, result from admin_audit_logs`)
  assert.deepEqual(left.rows, [{ admin_id: null, reason: 'Compensação de falha', result: 'success' }])
})

await test('dashboard: números do período batem com o banco e o período é validado', async (db) => {
  const lay = await newUser(db, 'lay@x.com')
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  await makeAdmin(db, lay)
  await db.query(`update models set provider_cost_usd = 0.04 where slug = 'foto'`)

  const ok = (await create(db, ana, 'foto')).rows[0]
  await db.query(`select complete_generation($1, 'x/y.png', 'image/png')`, [ok.id])
  const failed = (await create(db, ana, 'foto')).rows[0]
  await db.query(`select fail_generation($1, 'timeout')`, [failed.id])

  await activate(db, await newSubscription(db, bia, 'pro'), 'pay_1')
  const pack = (
    await db.query(`insert into purchases (user_id, pack_slug, credits, price_cents) values ($1, 'inicial', 100, 1990) returning id`, [ana])
  ).rows[0].id
  await db.query(`select grant_purchase($1)`, [pack])

  const dash = await as(db, 'authenticated', lay, async () => {
    await expectError(db.query(`select admin_dashboard(now(), now() - interval '1 day')`), 'invalid_period')
    await expectError(db.query(`select admin_dashboard(now() - interval '2 years', now())`), 'invalid_period')
    return (await db.query(`select admin_dashboard(${PERIOD}) as d`)).rows[0].d
  })

  assert.equal(dash.users.total, 3)
  assert.equal(dash.users.new_in_period, 3)
  assert.equal(dash.users.paying, 1)
  assert.equal(dash.users.active_in_period, 1)
  assert.equal(dash.users.first_generation_in_period, 1)
  assert.equal(dash.users.converted_in_period, 2)
  assert.deepEqual(
    { total: dash.generations.total, succeeded: dash.generations.succeeded, failed: dash.generations.failed, credits: dash.generations.credits_consumed },
    { total: 2, succeeded: 1, failed: 1, credits: 5 },
  )
  assert.equal(dash.finance.mrr_cents, 7990)
  assert.equal(dash.finance.received_cents, 7990 + 1990)
  assert.equal(dash.finance.subscription_received_cents, 7990)
  assert.equal(dash.finance.pack_received_cents, 1990)
  assert.equal(dash.finance.payments_count, 2)
  assert.equal(Number(dash.finance.api_cost_usd), 0.04)
  assert.equal(dash.finance.churn_base, 0)
  assert.equal(dash.finance.by_plan.find((row) => row.slug === 'pro').received_cents, 7990)
  assert.deepEqual(
    Object.fromEntries(dash.plan_distribution.map((row) => [row.slug, row.users])),
    {
      gratis: 2, starter: 0, pro: 1, studio: 0,
      'creator-start': 0, 'creator-pro': 0, 'creator-max': 0, 'business-start': 0, 'business-pro': 0, 'business-scale': 0, enterprise: 0,
    },
  )
  assert.equal(dash.top_consumers[0].user_id, ana)
  assert.ok(dash.series.length >= 2)
  assert.equal(dash.series.reduce((sum, day) => sum + day.failed, 0), 1)
  assert.equal(dash.series.reduce((sum, day) => sum + day.revenue_cents, 0), 7990 + 1990)
})


// ------------------------------------------------------------------ formatos (0015)

/** Põe a foto no Storage e registra pela RPC, como o app faz. */
async function newUpload(db, userId, confirmed = true) {
  const path = `${userId}/uploads/${crypto.randomUUID()}.jpg`
  await db.query(`insert into storage.objects (bucket_id, name, owner) values ('media', $1, $2)`, [path, userId])
  return as(db, 'authenticated', userId, async () =>
    (await db.query(`select * from register_upload($1, 'image/jpeg', $2)`, [path, confirmed])).rows[0],
  )
}

const createFull = (db, userId, model, { upload = null, end = null, format = null, source = null } = {}) =>
  db.query(`select * from create_generation($1, $2, 'prompt do formato', null, $3, null, $4, $5, $6)`, [
    userId, model, source, upload, end, format,
  ])

async function succeed(db, generationId) {
  await db.query(`update generations set status = 'succeeded', output_path = user_id::text || '/' || id::text || '.png' where id = $1`, [generationId])
}

await test('foto enviada: só com confirmação, só na própria pasta e só se o arquivo existe', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  await expectError(newUpload(db, ana, false), 'rights_not_confirmed')
  const upload = await newUpload(db, ana)
  assert.equal(upload.user_id, ana)

  const foreign = `${bia}/uploads/${crypto.randomUUID()}.jpg`
  await db.query(`insert into storage.objects (bucket_id, name) values ('media', $1)`, [foreign])
  await as(db, 'authenticated', ana, () =>
    expectError(db.query(`select register_upload($1, 'image/jpeg', true)`, [foreign]), 'upload_not_found'),
  )
  const missing = `${ana}/uploads/${crypto.randomUUID()}.jpg`
  await as(db, 'authenticated', ana, () =>
    expectError(db.query(`select register_upload($1, 'image/jpeg', true)`, [missing]), 'upload_not_found'),
  )
  const seen = await as(db, 'authenticated', bia, async () => (await db.query(`select id from uploads`)).rows)
  assert.deepEqual(seen, [])
})

await test('formato: foto enviada como partida, só de quem enviou', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  await setWallet(db, ana, 200)
  await setWallet(db, bia, 200)
  const upload = await newUpload(db, ana)

  const { rows } = await createFull(db, ana, 'video-kling', { upload: upload.id, format: 'tour-comodo' })
  assert.equal(rows[0].upload_id, upload.id)
  assert.equal(rows[0].format_slug, 'tour-comodo')
  assert.equal(await balanceOf(db, ana), 160)

  await expectError(createFull(db, bia, 'video-kling', { upload: upload.id }), 'upload_not_found')
  await expectError(createFull(db, ana, 'foto', { upload: upload.id }), 'model_takes_no_image')
  await expectError(createFull(db, ana, 'foto-edicao', { upload: upload.id, format: 'tour-comodo' }), 'format_mismatch')
  await expectError(createFull(db, ana, 'video-kling', { upload: upload.id, format: 'nao-existe' }), 'format_unavailable')
})

await test('antes e depois: o quadro final é uma imagem pronta da própria pessoa', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  await setWallet(db, ana, 200)
  await setWallet(db, bia, 200)
  const upload = await newUpload(db, ana)

  const edit = (await createFull(db, ana, 'foto-edicao', { upload: upload.id, format: 'antes-depois' })).rows[0]
  await expectError(createFull(db, ana, 'video-kling', { upload: upload.id, end: edit.id }), 'source_not_found')
  await succeed(db, edit.id)

  const video = (await createFull(db, ana, 'video-kling', { upload: upload.id, end: edit.id, format: 'antes-depois' })).rows[0]
  assert.equal(video.end_generation_id, edit.id)

  const biaUpload = await newUpload(db, bia)
  await expectError(createFull(db, bia, 'video-kling', { upload: biaUpload.id, end: edit.id }), 'source_not_found')
  await expectError(createFull(db, ana, 'foto-edicao', { upload: upload.id, end: edit.id }), 'model_takes_no_end_image')
})

await test('o que nasce de foto enviada nunca vira persona, nem depois de editado de novo', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await setWallet(db, ana, 200)
  const upload = await newUpload(db, ana)
  const edit = (await createFull(db, ana, 'foto-edicao', { upload: upload.id })).rows[0]
  await succeed(db, edit.id)
  const again = (await createFull(db, ana, 'foto-persona', { source: edit.id })).rows[0]
  await succeed(db, again.id)
  assert.equal(again.from_upload, true)

  for (const id of [edit.id, again.id]) {
    await as(db, 'authenticated', ana, () =>
      expectError(db.query(`select create_persona($1, 'Teste')`, [id]), 'upload_derived'),
    )
  }
  const generated = (await create(db, ana, 'foto')).rows[0]
  await succeed(db, generated.id)
  assert.equal(generated.from_upload, false)
  await as(db, 'authenticated', ana, () => db.query(`select create_persona($1, 'Luna')`, [generated.id]))
})

await test('formatos: catálogo público sem o texto dos prompts', async (db) => {
  const seen = await as(db, 'anon', null, async () => (await db.query(`select slug from formats order by position`)).rows.map((row) => row.slug))
  assert.deepEqual(seen, ['tour-comodo', 'antes-depois', 'vista-drone', 'produto-girando', 'produto-em-cena', 'prato-vivo'])
  await as(db, 'anon', null, () => expectError(db.query(`select prompt_template from formats`), 'permission denied'))
})

// ------------------------------------------------------------ guarda de gasto (0016)

const usageOf = (db, userId) => as(db, 'authenticated', userId, async () => (await db.query(`select my_usage() as u`)).rows[0].u)

await test('guarda: limite diário do plano barra antes de reservar, e estorno libera o espaço', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await setWallet(db, ana, 500)
  await db.query(`update subscription_plans set daily_credit_limit = 10, max_concurrent = 5 where slug = 'gratis'`)
  const first = (await create(db, ana, 'foto')).rows[0]
  await create(db, ana, 'foto')
  await expectError(create(db, ana, 'foto'), 'daily_limit_reached')
  assert.equal(await balanceOf(db, ana), 490)

  await db.query(`select fail_generation($1, 'falhou')`, [first.id])
  await create(db, ana, 'foto')
  const usage = await usageOf(db, ana)
  assert.equal(usage.used_today, 10)
  assert.equal(usage.daily_limit, 10)
})

await test('guarda: limite mensal conta o mês em Brasília, não só o dia', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await setWallet(db, ana, 500)
  await db.query(`update subscription_plans set daily_credit_limit = null, monthly_credit_limit = 12, max_concurrent = 5 where slug = 'gratis'`)
  const old = (await create(db, ana, 'foto')).rows[0]
  await db.query(`update credit_reservations set created_at = spend_month_start() + interval '1 second' where generation_id = $1`, [old.id])
  await create(db, ana, 'foto')
  await expectError(create(db, ana, 'foto'), 'monthly_limit_reached')
  assert.equal((await usageOf(db, ana)).used_month, 10)
})

await test('guarda: limite e uso valem por plano (Grátis 100/dia, Pro 450/dia)', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  assert.deepEqual(
    (await db.query(`select slug, daily_credit_limit as d, monthly_credit_limit as m from subscription_plans where status = 'live' order by position`)).rows,
    [
      { slug: 'gratis', d: 100, m: 500 },
      { slug: 'starter', d: 300, m: 1500 },
      { slug: 'pro', d: 450, m: 2250 },
      { slug: 'studio', d: 1000, m: 5000 },
    ],
  )
  await activate(db, await newSubscription(db, ana, 'pro'), 'pay_1')
  const usage = await usageOf(db, ana)
  assert.equal(usage.plan_slug, 'pro')
  assert.equal(usage.daily_limit, 450)
  assert.equal(usage.paused, false)
  assert.equal(usage.provider_cost_usd, undefined)
})

await test('guarda: teto de custo da plataforma vale para todas as contas', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  // Foto sem custo cadastrado usa o pior caso: 5 créditos × R$ 0,15 ÷ 5,60 = US$ 0,1339.
  await db.query(`update models set provider_cost_usd = null where slug = 'foto'`)
  const first = (await create(db, ana, 'foto')).rows[0]
  assert.equal(Number(first.spend_usd), 0.1339)
  await db.query(`update pricing_settings set daily_cost_cap_usd = 0.2`)
  await expectError(create(db, bia, 'foto'), 'platform_spend_cap')

  await db.query(`update models set provider_cost_usd = 0.04 where slug = 'foto'`)
  const cheap = (await create(db, bia, 'foto')).rows[0]
  assert.equal(Number(cheap.spend_usd), 0.04)
  assert.equal(await balanceOf(db, bia), 15)
})

await test('guarda: falha que o fornecedor cobra continua no custo, mesmo com estorno', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const text = (await create(db, ana, 'copy', 'legenda para o café')).rows[0]
  const photo = (await create(db, ana, 'foto')).rows[0]
  assert.equal(text.billed_on_failure, true)
  assert.equal(photo.billed_on_failure, false)
  await db.query(`select fail_generation($1, 'recusado')`, [text.id])
  await db.query(`select fail_generation($1, 'falhou')`, [photo.id])
  assert.equal(await balanceOf(db, ana), 20)
  const spent = Number((await db.query(`select platform_spend_usd(spend_day_start()) as s`)).rows[0].s)
  assert.equal(spent, Number(text.spend_usd))
})

await test('guarda: pausa de emergência barra toda geração e pede motivo', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const boss = await newUser(db, 'boss@x.com')
  await makeAdmin(db, boss)
  await as(db, 'authenticated', boss, async () => {
    await expectError(db.query(`select admin_update_spend_guard(25, 300, 0.8, true, '')`), 'reason_required')
    await expectError(db.query(`select admin_update_spend_guard(400, 300, 0.8, false, null)`), 'invalid_cap_order')
    const guard = (await db.query(`select admin_update_spend_guard(25, 300, 0.8, true, 'fatura do fal acima do previsto') as g`)).rows[0].g
    assert.equal(guard.generation_paused, true)
  })
  await expectError(create(db, ana, 'foto'), 'generation_paused')
  assert.equal(await balanceOf(db, ana), 20)
  assert.equal((await usageOf(db, ana)).paused, true)

  await as(db, 'authenticated', boss, () => db.query(`select admin_update_spend_guard(25, 300, 0.8, false, null)`))
  await create(db, ana, 'foto')
  const log = await db.query(`select action, reason from admin_audit_logs where action = 'spend_guard.update' order by id`)
  assert.deepEqual(log.rows.map((row) => row.reason), ['fatura do fal acima do previsto', null])
})

await test('guarda: só financeiro vê o custo, só quem gerencia muda teto e limite', async (db) => {
  const ids = {}
  for (const role of ['super_admin', 'admin', 'finance', 'support']) {
    ids[role] = await newUser(db, `${role}@x.com`)
    await makeAdmin(db, ids[role], role)
  }
  const ana = await newUser(db, 'ana@x.com')
  // Sem custo cadastrado: entra no pior caso e conta como estimado.
  await db.query(`update models set provider_cost_usd = null where slug = 'foto'`)
  await create(db, ana, 'foto')

  await as(db, 'authenticated', ana, () => expectError(db.query(`select admin_spend_guard()`), 'forbidden'))
  await as(db, 'authenticated', ids.support, () => expectError(db.query(`select admin_spend_guard()`), 'forbidden'))
  await as(db, 'authenticated', ids.admin, async () => {
    await expectError(db.query(`select admin_spend_guard()`), 'forbidden')
    await expectError(db.query(`select admin_update_plan_limits('pro', 10, 20)`), 'forbidden')
  })
  await as(db, 'authenticated', ids.finance, async () => {
    const guard = (await db.query(`select admin_spend_guard() as g`)).rows[0].g
    assert.equal(Number(guard.spent_today_usd), 0.1339)
    assert.equal(guard.estimated_month_count, 1)
    assert.equal(guard.top_today[0].email, 'ana@x.com')
    await expectError(db.query(`select admin_update_spend_guard(25, 300, 0.8, false, null)`), 'forbidden')
  })
  const versionBefore = (await db.query(`select version from subscription_plans where slug = 'pro'`)).rows[0].version
  await as(db, 'authenticated', ids.super_admin, async () => {
    await expectError(db.query(`select admin_update_plan_limits('pro', 30, 20)`), 'invalid_cap_order')
    const plan = (await db.query(`select * from admin_update_plan_limits('pro', null, 900)`)).rows[0]
    assert.equal(plan.daily_credit_limit, null)
    assert.equal(plan.monthly_credit_limit, 900)
    assert.equal(plan.version, versionBefore)
  })
  await expectError(as(db, 'authenticated', ana, () => db.query(`select user_credits_used($1, now())`, [ana])), 'permission denied')
  await expectError(as(db, 'authenticated', ana, () => db.query(`select platform_spend_usd(now())`)), 'permission denied')
})

// ------------------------------------------------------------ multiplicador (0017)

const TAKES = JSON.stringify([
  { id: 't1', name: 'abrindo-a-caixa.mp4', kind: 'video', duration: 12.5, note: 'mão abrindo a caixa' },
  { id: 't2', name: 'produto.jpg', kind: 'image', duration: 3, note: '' },
])

const newMultiplierProject = (db, userId, fields = {}) =>
  as(db, 'authenticated', userId, async () => {
    const { rows } = await db.query(
      `insert into multiplier_projects (name, product_name, takes, rights_confirmed) values ($1, $2, $3::jsonb, $4) returning *`,
      [fields.name ?? 'Sérum', fields.product ?? 'Sérum vitamina C', fields.takes ?? TAKES, fields.rights ?? true],
    )
    return rows[0]
  })

const SCRIPTS = JSON.stringify([
  { angle: 'Dor', hook: 'Pele sem viço?', beats: [{ take: 1, start: 0, duration: 4, text: 'Abre a caixa' }], cta: 'Link na bio', caption: 'Teste' },
  { angle: 'Demonstração', hook: 'Olha a textura', beats: [{ take: 2, start: 0, duration: 3, text: 'Produto' }], cta: 'Comenta EU', caption: 'Teste 2' },
])

await test('multiplicador: lote cobra 8 créditos, grava as variações e captura a reserva', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const project = await newMultiplierProject(db, ana)
  const batch = (await db.query(`select * from start_multiplier_batch($1, $2, 2)`, [ana, project.id])).rows[0]
  assert.equal(batch.credits, 8)
  assert.equal(batch.kind, 'text')
  assert.equal(await balanceOf(db, ana), 12)

  const analysis = JSON.stringify({ benefits: ['textura leve'], limitations: ['nenhum take mostra o rosto'], opportunities: [] })
  const done = await db.query(`select complete_multiplier_batch($1, $2, $3::jsonb, $4::jsonb) as n`, [batch.id, project.id, analysis, SCRIPTS])
  assert.equal(done.rows[0].n, 2)
  const again = await db.query(`select complete_multiplier_batch($1, $2, $3::jsonb, $4::jsonb) as n`, [batch.id, project.id, analysis, SCRIPTS])
  assert.equal(again.rows[0].n, 0)

  const variations = await as(db, 'authenticated', ana, async () =>
    (await db.query(`select position, script ->> 'angle' as angle, render_status from multiplier_variations order by position`)).rows,
  )
  assert.deepEqual(variations, [
    { position: 1, angle: 'Dor', render_status: 'pending' },
    { position: 2, angle: 'Demonstração', render_status: 'pending' },
  ])
  const saved = (await db.query(`select analysis, (select status from credit_reservations where generation_id = $2) as r from multiplier_projects where id = $1`, [project.id, batch.id])).rows[0]
  assert.deepEqual(saved.analysis.limitations, ['nenhum take mostra o rosto'])
  assert.equal(saved.r, 'captured')
})

await test('multiplicador: tamanho do lote vem do plano (grátis 3, pro 10) e falha estorna', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await setWallet(db, ana, 100)
  const project = await newMultiplierProject(db, ana)
  await expectError(db.query(`select * from start_multiplier_batch($1, $2, 4)`, [ana, project.id]), 'too_many_variations')
  await expectError(db.query(`select * from start_multiplier_batch($1, $2, 0)`, [ana, project.id]), 'invalid_count')
  const batch = (await db.query(`select * from start_multiplier_batch($1, $2, 3)`, [ana, project.id])).rows[0]
  await db.query(`select fail_generation($1, 'recusado')`, [batch.id])
  assert.equal(await balanceOf(db, ana), 100)

  await activate(db, await newSubscription(db, ana, 'pro'), 'pay_1')
  await db.query(`select * from start_multiplier_batch($1, $2, 10)`, [ana, project.id])
})

await test('multiplicador: sem direitos confirmados, sem takes ou projeto alheio, não abre lote', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  const unconfirmed = await newMultiplierProject(db, ana, { rights: false })
  await expectError(db.query(`select * from start_multiplier_batch($1, $2, 1)`, [ana, unconfirmed.id]), 'rights_not_confirmed')
  const empty = await newMultiplierProject(db, ana, { takes: '[]' })
  await expectError(db.query(`select * from start_multiplier_batch($1, $2, 1)`, [ana, empty.id]), 'takes_required')
  const own = await newMultiplierProject(db, ana)
  await expectError(db.query(`select * from start_multiplier_batch($1, $2, 1)`, [bia, own.id]), 'project_not_found')
  assert.equal(await balanceOf(db, ana), 20)
})

await test('multiplicador: takes fora do formato são recusados', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await expectError(newMultiplierProject(db, ana, { takes: JSON.stringify([{ name: 'x.mp4', kind: 'audio', duration: 3 }]) }), 'invalid_takes')
  await expectError(newMultiplierProject(db, ana, { takes: JSON.stringify([{ name: 'x.mp4', kind: 'video', duration: 9000 }]) }), 'invalid_takes')
  const many = JSON.stringify(Array.from({ length: 13 }, (_, i) => ({ name: `t${i}.mp4`, kind: 'video', duration: 3 })))
  await expectError(newMultiplierProject(db, ana, { takes: many }), 'check')
})

await test('multiplicador: cada pessoa só vê e edita o que é dela; variação não nasce pelo cliente', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  const project = await newMultiplierProject(db, ana)
  const batch = (await db.query(`select * from start_multiplier_batch($1, $2, 2)`, [ana, project.id])).rows[0]
  await db.query(`select complete_multiplier_batch($1, $2, '{}'::jsonb, $3::jsonb)`, [batch.id, project.id, SCRIPTS])

  await as(db, 'authenticated', bia, async () => {
    assert.equal((await db.query(`select count(*)::int as n from multiplier_projects`)).rows[0].n, 0)
    assert.equal((await db.query(`select count(*)::int as n from multiplier_variations`)).rows[0].n, 0)
    const changed = await db.query(`update multiplier_variations set render_status = 'rendered' returning id`)
    assert.equal(changed.rows.length, 0)
  })
  await as(db, 'authenticated', ana, async () => {
    await expectError(
      db.query(`insert into multiplier_variations (project_id, user_id, generation_id, position, script) values ($1, $2, $3, 9, '{}')`, [project.id, ana, batch.id]),
      'permission denied',
    )
    await expectError(db.query(`update multiplier_variations set position = 5`), 'permission denied')
    await expectError(db.query(`select * from start_multiplier_batch($1, $2, 1)`, [ana, project.id]), 'permission denied')
    const edited = await db.query(
      `update multiplier_variations set script = jsonb_set(script, '{hook}', '"Novo gancho"'), render_status = 'rendered' where position = 1 returning edited, rendered_at`,
    )
    assert.equal(edited.rows[0].edited, true)
    assert.notEqual(edited.rows[0].rendered_at, null)
  })
})

// ------------------------------------------------------------ preços v2 (0018)

const variationOf = async (db, userId) => {
  const project = await newMultiplierProject(db, userId)
  const batch = (await db.query(`select * from start_multiplier_batch($1, $2, 2)`, [userId, project.id])).rows[0]
  await db.query(`select complete_multiplier_batch($1, $2, '{}'::jsonb, $3::jsonb)`, [batch.id, project.id, SCRIPTS])
  return (await db.query(`select id from multiplier_variations where user_id = $1 order by position limit 1`, [userId])).rows[0].id
}

const startExport = (db, userId, variationId, key) =>
  as(db, 'authenticated', userId, async () => (await db.query(`select start_multiplier_export($1, $2) as r`, [variationId, key])).rows[0].r)

await test('preços v2: planos novos nascem em rascunho e não vão para o checkout', async (db) => {
  const plans = (await db.query(`select slug, status, public, active, line, contact_only from subscription_plans where status = 'draft' order by position`)).rows
  assert.deepEqual(
    plans.map((plan) => plan.slug),
    ['creator-start', 'creator-pro', 'creator-max', 'business-start', 'business-pro', 'business-scale', 'enterprise'],
  )
  assert.ok(plans.every((plan) => !plan.public && !plan.active))
  assert.ok(plans.filter((plan) => plan.line === 'business').every((plan) => plan.contact_only))
  await expectError(db.query(`update subscription_plans set public = true where slug = 'creator-pro'`), 'subscription_plans_sold_live')
  // Os atuais seguem à venda, sem mudança de preço nem de créditos.
  const live = (await db.query(`select slug, price_cents, monthly_credits from subscription_plans where public order by position`)).rows
  assert.deepEqual(live, [
    { slug: 'starter', price_cents: 5990, monthly_credits: 300 },
    { slug: 'pro', price_cents: 7990, monthly_credits: 450 },
    { slug: 'studio', price_cents: 14990, monthly_credits: 1000 },
  ])
  // O orçamento interno de IA e os custos não são legíveis pelo cliente.
  const ana = await newUser(db, 'ana@x.com')
  await expectError(as(db, 'authenticated', ana, () => db.query(`select * from plan_cost_budgets`)), 'permission denied')
  await expectError(as(db, 'anon', null, () => db.query(`select * from finance_settings`)), 'permission denied')
})

await test('preços v2: exportação conta na cota do mês, falha devolve e a chave repetida não conta de novo', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  const variation = await variationOf(db, ana)

  const first = await startExport(db, ana, variation, 'export-0001')
  assert.equal(first.used, 1)
  assert.equal(first.limit, 3)
  assert.equal((await startExport(db, ana, variation, 'export-0001')).id, first.id)
  await as(db, 'authenticated', ana, async () => {
    assert.equal((await db.query(`select finish_multiplier_export($1, 13.5, 1080, 1920, 47000, 5200000) as ok`, [first.id])).rows[0].ok, true)
    assert.equal((await db.query(`select finish_multiplier_export($1, 13.5, 1080, 1920, 47000, 5200000) as ok`, [first.id])).rows[0].ok, false)
  })

  const second = await startExport(db, ana, variation, 'export-0002')
  await as(db, 'authenticated', ana, () => db.query(`select fail_multiplier_export($1)`, [second.id]))
  const third = await startExport(db, ana, variation, 'export-0003')
  await as(db, 'authenticated', ana, () => db.query(`select finish_multiplier_export($1, 10, 1080, 1920, 1000, 100)`, [third.id]))
  const fourth = await startExport(db, ana, variation, 'export-0004')
  assert.equal(fourth.used, 3)
  await as(db, 'authenticated', ana, () => db.query(`select finish_multiplier_export($1, 10, 1080, 1920, 1000, 100)`, [fourth.id]))
  await expectError(startExport(db, ana, variation, 'export-0005'), 'export_limit_reached')

  const usage = await as(db, 'authenticated', ana, async () => (await db.query(`select my_usage() as u`)).rows[0].u)
  assert.equal(usage.exports_used, 3)
  assert.equal(usage.exports_limit, 3)

  // Variação de outra pessoa não exporta; exportação de outra pessoa não fecha nem aparece.
  await expectError(startExport(db, bia, variation, 'export-bia-1'), 'variation_not_found')
  await as(db, 'authenticated', bia, async () => {
    assert.equal((await db.query(`select fail_multiplier_export($1) as ok`, [third.id])).rows[0].ok, false)
    assert.equal((await db.query(`select count(*)::int as n from multiplier_exports`)).rows[0].n, 0)
    await expectError(db.query(`insert into multiplier_exports (user_id, idempotency_key) values ($1, 'forjada-01')`, [bia]), 'permission denied')
  })

  // Assinante Pro tem 150 por mês.
  await activate(db, await newSubscription(db, ana, 'pro'), 'pay_exp')
  assert.equal((await startExport(db, ana, variation, 'export-0006')).limit, 150)
})

await test('preços v2: exportações simultâneas param no limite de concorrência do plano', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const variation = await variationOf(db, ana)
  await activate(db, await newSubscription(db, ana, 'starter'), 'pay_conc')
  for (const key of ['conc-0001', 'conc-0002', 'conc-0003']) await startExport(db, ana, variation, key)
  await expectError(startExport(db, ana, variation, 'conc-0004'), 'too_many_exports')
})

await test('preços v2: cotação usa custo × câmbio × segurança ÷ orçamento, ou a base do crédito atual', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await makeAdmin(db, ana)
  const quotes = await as(db, 'authenticated', ana, async () => {
    await db.query(`select admin_update_model('foto-persona', true, 6, 0.039, null)`)
    return (await db.query(`select admin_model_quotes() as q`)).rows[0].q
  })
  const bySlug = Object.fromEntries(quotes.models.map((model) => [model.slug, model]))
  // Sem custo (texto ainda sem volume medido): 3 créditos × R$ 0,09 × 1,15 ÷ R$ 0,01 = 31,05 → 32.
  assert.equal(bySlug.copy.basis, 'legacy_estimate')
  assert.equal(bySlug.copy.quoted_credits, 32)
  // Tarifa oficial cadastrada pela 0019 (US$ 0,08 × 5,60 × 1,15 ÷ 0,01 = 51,52 → 52), à espera da conferência.
  assert.equal(bySlug.foto.basis, 'provider_cost')
  assert.equal(bySlug.foto.quoted_credits, 52)
  assert.equal(bySlug.foto.stale, true)
  assert.equal(bySlug.foto.trusted, false)
  // Com custo: US$ 0,039 × 5,60 × 1,15 ÷ 0,01 = 25,12 → 26; conferido agora.
  assert.equal(bySlug['foto-persona'].basis, 'provider_cost')
  assert.equal(bySlug['foto-persona'].quoted_credits, 26)
  assert.equal(bySlug['foto-persona'].stale, false)
  assert.equal(Number(quotes.settings.safety_factor), 1.15)

  await as(db, 'authenticated', ana, async () => {
    await expectError(db.query(`select admin_confirm_model_cost('copy', 'https://fal.ai/models/x')`), 'cost_required')
    await expectError(db.query(`select admin_confirm_model_cost('foto-persona', '')`), 'source_required')
    const confirmed = (await db.query(`select cost_source from admin_confirm_model_cost('foto-persona', 'https://fal.ai/models/fal-ai/nano-banana-2/edit')`)).rows[0]
    assert.match(confirmed.cost_source, /^https:\/\/fal\.ai/)
    await db.query(`select admin_update_credit_policy(1.3, 0.01, 0.09, 15)`)
  })
  const policy = (await db.query(`select safety_factor, cost_stale_days from pricing_settings`)).rows[0]
  assert.equal(Number(policy.safety_factor), 1.3)
  assert.equal(policy.cost_stale_days, 15)

  const analyst = await newUser(db, 'analista@x.com')
  await makeAdmin(db, analyst, 'analyst')
  await expectError(as(db, 'authenticated', analyst, () => db.query(`select admin_update_credit_policy(1.2, 0.01, 0.09, 30)`)), 'forbidden')
})

await test('preços v2: boas-vindas vêm da configuração', async (db) => {
  await db.query(`update pricing_settings set welcome_credits = 0`)
  assert.equal(await balanceOf(db, await newUser(db, 'ana@x.com')), 0)
  await db.query(`update pricing_settings set welcome_credits = 100`)
  assert.equal(await balanceOf(db, await newUser(db, 'bia@x.com')), 100)
})

/** Tarifa de texto com volume medido e conferência de todo modelo: o mínimo para a virada. */
async function trustAllModels(db, adminId) {
  await as(db, 'authenticated', adminId, async () => {
    const text = (await db.query(`select slug from models where kind = 'text'`)).rows
    for (const { slug } of text) {
      await db.query(`select admin_set_model_tariff($1, $2::jsonb, 'https://platform.claude.com/docs/en/about-claude/pricing')`, [
        slug,
        JSON.stringify({ unit: 'token', input_usd_per_mtok: 4, output_usd_per_mtok: 20, est_input_tokens: 4000, est_output_tokens: 3000 }),
      ])
    }
    const media = (await db.query(`select slug from models where kind <> 'text'`)).rows
    for (const { slug } of media) await db.query(`select admin_confirm_model_cost($1, 'https://fal.ai/models (conferido)')`, [slug])
  })
}

await test('preços v3: virada exige pausa, motivo, custo confiável e margem na meta; converte tudo e volta', async (db) => {
  const dona = await newUser(db, 'dona@x.com')
  await makeAdmin(db, dona)
  const ana = await newUser(db, 'ana@x.com')
  const sub = await newSubscription(db, ana, 'pro')
  await activate(db, sub, 'pay_v2')
  const before = await walletOf(db, ana)
  const run = (reason = 'Aprovado pela Lay na revisão de preços', accept = false) =>
    as(db, 'authenticated', dona, async () => (await db.query(`select admin_activate_pricing_v2($1, $2) as r`, [reason, accept])).rows[0].r)
  const preflight = () => as(db, 'authenticated', dona, async () => (await db.query(`select admin_pricing_v2_preflight() as p`)).rows[0].p)

  await expectError(run('curto'), 'reason_required')
  await expectError(run(), 'pause_required')
  const open = (await create(db, ana, 'foto')).rows[0]
  await db.query(`update pricing_settings set generation_paused = true, paused_reason = 'virada de preço'`)
  await expectError(run(), 'open_generations')
  assert.deepEqual((await preflight()).blockers, ['open_generations', 'unverified_models'])
  await db.query(`select fail_generation($1, 'cancelada para a virada')`, [open.id])
  await expectError(run(), 'unverified_models')

  await trustAllModels(db, dona)
  const check = await preflight()
  assert.deepEqual(check.blockers, [])
  // Preços finais (0021): Starter 2.300, Pro 5.000, Max 10.000, todos acima da meta de 60%.
  assert.deepEqual(check.warnings, [])
  assert.equal(Number(check.factor), 10.35)
  assert.equal(check.next_welcome_credits, 100)
  assert.equal(check.wallets.subscription_after, Math.floor(before.subscription_balance * 10.35))
  assert.deepEqual(check.plans.map((plan) => Number(plan.full_use_margin)), [0.6171, 0.6107, 0.6192])

  // Rascunho abaixo da meta continua travando a virada sem aceite explícito.
  await db.query(`update subscription_plans set monthly_credits = 13000 where slug = 'creator-max'`)
  assert.deepEqual((await preflight()).warnings, ['margin_below_target'])
  await expectError(run(), 'margin_below_target')
  await db.query(`update subscription_plans set monthly_credits = 10000 where slug = 'creator-max'`)

  const result = await run()
  assert.equal(Number(result.factor), 10.35)
  const after = await walletOf(db, ana)
  assert.equal(after.subscription_balance, Math.floor(before.subscription_balance * 10.35))
  assert.equal(after.purchased_balance, Math.floor(before.purchased_balance * 10.35))

  const models = Object.fromEntries((await db.query(`select slug, credits from models`)).rows.map((row) => [row.slug, row.credits]))
  assert.equal(models.foto, 52)
  assert.equal(models['video-kling'], 406)
  assert.equal(models['video-veo'], 2061)
  // 4.000 tokens de entrada e 3.000 de saída: US$ 0,076 × 5,60 × 1,15 ÷ 0,01 = 48,94 → 49.
  assert.equal(models.copy, 49)

  assert.equal((await db.query(`select monthly_credits from subscriptions where id = $1`, [sub])).rows[0].monthly_credits, Math.floor(450 * 10.35))
  const plans = Object.fromEntries((await db.query(`select slug, status, public, price_cents, monthly_credits from subscription_plans`)).rows.map((row) => [row.slug, row]))
  assert.equal(plans.pro.status, 'legacy')
  assert.equal(plans.pro.public, false)
  assert.equal(plans['creator-pro'].status, 'live')
  assert.equal(plans['creator-pro'].public, true)
  assert.equal(plans['creator-pro'].price_cents, 16990)
  assert.equal(plans['creator-pro'].monthly_credits, 5000)
  assert.equal(plans['business-pro'].status, 'draft')
  assert.equal((await db.query(`select (effective_plan($1)).slug as s`, [ana])).rows[0].s, 'pro')

  assert.equal(await balanceOf(db, await newUser(db, 'nova@x.com')), 100)
  const settings = (await db.query(`select credit_scale, credit_value_brl, require_trusted_cost from pricing_settings`)).rows[0]
  assert.equal(settings.credit_scale, 2)
  assert.equal(Number(settings.credit_value_brl), 0.034)
  assert.equal(settings.require_trusted_cost, true)
  await expectError(run(), 'already_activated')
  const log = (await db.query(`select details, reason from admin_audit_logs where action = 'pricing.activate_v2'`)).rows
  assert.equal(log.length, 1)
  assert.deepEqual(log[0].details.below_target_accepted, [])

  // A volta devolve saldos (arredondando a favor da pessoa), modelos, planos e parâmetros.
  const rollback = (reason = 'Voltando: preço novo gerou reclamação') =>
    as(db, 'authenticated', dona, async () => (await db.query(`select admin_rollback_pricing_v2($1) as r`, [reason])).rows[0].r)
  const bia = await newUser(db, 'bia@x.com')
  const v2sub = await newSubscription(db, bia, 'creator-pro')
  await activate(db, v2sub, 'pay_v2_bia')
  await expectError(rollback(), 'v2_subscribers_exist')
  await db.query(`update subscriptions set status = 'expired' where id = $1`, [v2sub])
  await rollback()
  const back = await walletOf(db, ana)
  assert.equal(back.subscription_balance, before.subscription_balance)
  assert.equal((await db.query(`select credits from models where slug = 'foto'`)).rows[0].credits, 5)
  const restored = Object.fromEntries((await db.query(`select slug, status, public from subscription_plans`)).rows.map((row) => [row.slug, row]))
  assert.deepEqual(restored.pro, { slug: 'pro', status: 'live', public: true })
  assert.deepEqual(restored['creator-pro'], { slug: 'creator-pro', status: 'draft', public: false })
  assert.equal((await db.query(`select monthly_credits from subscriptions where id = $1`, [sub])).rows[0].monthly_credits, 450)
  const settingsBack = (await db.query(`select credit_scale, welcome_credits, require_trusted_cost from pricing_settings`)).rows[0]
  assert.deepEqual(settingsBack, { credit_scale: 1, welcome_credits: 20, require_trusted_cost: false })
  await expectError(rollback(), 'not_activated')
})

await test('preços v2: financeiro soma receita, custo de API, falha cobrada e exportações; só para finance.view', async (db) => {
  const dona = await newUser(db, 'dona@x.com')
  await makeAdmin(db, dona)
  const ana = await newUser(db, 'ana@x.com')
  await activate(db, await newSubscription(db, ana, 'pro'), 'pay_fin')
  await db.query(`update models set provider_cost_usd = 0.04 where slug = 'foto'`)
  const ok = (await create(db, ana, 'foto')).rows[0]
  await succeed(db, ok.id)
  const failed = (await create(db, ana, 'copy', 'legenda para o sérum')).rows[0]
  await db.query(`select fail_generation($1, 'erro')`, [failed.id])
  const variation = await variationOf(db, ana)
  const exp = await startExport(db, ana, variation, 'fin-export-1')
  await as(db, 'authenticated', ana, () => db.query(`select finish_multiplier_export($1, 12, 1080, 1920, 30000, 4000000)`, [exp.id]))

  const fin = await as(db, 'authenticated', dona, async () => (await db.query(`select admin_finance(${PERIOD}) as f`)).rows[0].f)
  assert.equal(fin.revenue_cents, 7990)
  assert.equal(fin.mrr_cents, 7990)
  assert.equal(fin.active_subscriptions, 1)
  assert.equal(fin.exports_done, 1)
  assert.ok(Number(fin.failed_billed_usd) > 0)
  assert.ok(Number(fin.api_cost_usd) >= 0.04 + Number(fin.failed_billed_usd))
  assert.equal(fin.by_user[0].user_id, ana)
  assert.equal(fin.by_user[0].plan_slug, 'pro')
  assert.equal(fin.by_user[0].exports, 1)
  const foto = fin.by_model.find((model) => model.slug === 'foto')
  assert.equal(foto.billed, 1)
  assert.equal(Number(foto.cost_usd), 0.04)
  assert.equal(foto.estimated, 0)
  assert.equal(Number(fin.settings.tax_rate), 0.06)

  const support = await newUser(db, 'suporte@x.com')
  await makeAdmin(db, support, 'support')
  await expectError(as(db, 'authenticated', support, () => db.query(`select admin_finance(${PERIOD})`)), 'forbidden')
  await expectError(as(db, 'authenticated', support, () => db.query(`select admin_finance_settings()`)), 'forbidden')
  await as(db, 'authenticated', dona, () => db.query(`select admin_update_finance_settings(0.08, 50000, 13000, 0, 0, 300000, 0.15, 0.45)`))
  assert.equal(Number((await db.query(`select tax_rate from finance_settings`)).rows[0].tax_rate), 0.08)
})

// ------------------------------------------------------------ preços v3 (0019)

/** Foto pronta da própria pessoa, para servir de origem a vídeo. */
async function sourceImage(db, userId) {
  const { rows } = await create(db, userId, 'foto')
  await db.query(`select complete_generation($1, $2, 'image/png')`, [rows[0].id, `${userId}/${rows[0].id}.png`])
  return rows[0].id
}

const cost = async (db, pricing, params) =>
  (await db.query(`select operation_cost_usd($1::jsonb, $2::jsonb) as c`, [JSON.stringify(pricing), JSON.stringify(params)])).rows[0].c

await test('preços v3: motor calcula o custo pela tarifa e pela configuração, sem inventar', async (db) => {
  const image = { unit: 'image', usd: 0.08, resolution_multipliers: { '1K': 1, '2K': 1.5 } }
  assert.equal(Number(await cost(db, image, { num_images: 1 })), 0.08)
  assert.equal(Number(await cost(db, image, { num_images: 2, resolution: '2K' })), 0.24)
  assert.equal(await cost(db, image, { resolution: '8K' }), null)
  const video = { unit: 'second', usd: 0.084, usd_audio: 0.126 }
  assert.equal(Number(await cost(db, video, { duration: '5', generate_audio: true })), 0.63)
  assert.equal(Number(await cost(db, video, { duration: '8s', generate_audio: false })), 0.672)
  assert.equal(await cost(db, video, { generate_audio: true }), null)
  const text = { unit: 'token', input_usd_per_mtok: 4, output_usd_per_mtok: 20, est_input_tokens: null, est_output_tokens: null }
  assert.equal(await cost(db, text, {}), null)
  assert.equal(Number(await cost(db, { ...text, est_input_tokens: 2000, est_output_tokens: 1000 }, {})), 0.028)

  // Tarifas oficiais da 0019: custo por operação nos `defaults` de cada modelo.
  const models = Object.fromEntries((await db.query(`select slug, provider_cost_usd, cost_checked_at from models`)).rows.map((row) => [row.slug, row]))
  assert.equal(Number(models.foto.provider_cost_usd), 0.08)
  assert.equal(Number(models['video-kling'].provider_cost_usd), 0.63)
  assert.equal(Number(models['video-veo'].provider_cost_usd), 3.2)
  assert.equal(models.copy.provider_cost_usd, null)
  assert.ok(Object.values(models).every((model) => model.cost_checked_at === null))
})

await test('preços v3: tarifa pelo painel valida, recalcula créditos só para pedidos novos e fica auditada', async (db) => {
  const dona = await newUser(db, 'dona@x.com')
  await makeAdmin(db, dona)
  const ana = await newUser(db, 'ana@x.com')
  await activate(db, await newSubscription(db, ana, 'studio'), 'pay_tarifa')
  const tariff = (slug, pricing, source = 'https://fal.ai/models/fal-ai/kling-video') =>
    as(db, 'authenticated', dona, async () => (await db.query(`select * from admin_set_model_tariff($1, $2::jsonb, $3)`, [slug, JSON.stringify(pricing), source])).rows[0])

  await expectError(tariff('video-kling', { unit: 'second', usd: -1 }), 'invalid_pricing')
  await expectError(tariff('video-kling', { unit: 'second', usd: 0.1, extra: 1 }), 'invalid_pricing')
  await expectError(tariff('copy', { unit: 'second', usd: 0.1 }), 'invalid_pricing')
  await expectError(tariff('video-kling', { unit: 'second', usd: 0.084, usd_audio: 0.126 }, ''), 'source_required')

  const old = (await create(db, ana, 'video-kling', 'ela sorri', null, await sourceImage(db, ana))).rows[0]
  await db.query(`update pricing_settings set credit_scale = 2`)
  const updated = await tariff('video-kling', { unit: 'second', usd: 0.1, usd_audio: 0.2 })
  // US$ 0,20 × 5 s = US$ 1,00 × 5,60 × 1,15 ÷ 0,01 = 644.
  assert.equal(Number(updated.provider_cost_usd), 1)
  assert.equal(updated.credits, 644)
  assert.ok(updated.cost_checked_at)
  const kept = (await db.query(`select credits, provider_cost_usd from generations where id = $1`, [old.id])).rows[0]
  assert.equal(kept.credits, 40)
  assert.equal(Number(kept.provider_cost_usd), 0.63)
  const log = (await db.query(`select details from admin_audit_logs where action = 'model.tariff'`)).rows[0].details
  assert.equal(log.before.credits, 40)
  assert.equal(log.after.credits, 644)

  const analyst = await newUser(db, 'analista@x.com')
  await makeAdmin(db, analyst, 'analyst')
  await expectError(as(db, 'authenticated', analyst, () => db.query(`select admin_set_model_tariff('foto', '{"unit":"image","usd":0.08}', 'https://fal.ai/x')`)), 'forbidden')
})

await test('preços v3: trava bloqueia modelo sem custo confiável, acima do teto ou com preço mudado no fornecedor', async (db) => {
  const dona = await newUser(db, 'dona@x.com')
  await makeAdmin(db, dona)
  const ana = await newUser(db, 'ana@x.com')
  await activate(db, await newSubscription(db, ana, 'studio'), 'pay_trava')
  const source = await sourceImage(db, ana)
  const balance = await balanceOf(db, ana)

  // Antes da virada a trava fica desligada: o produto de hoje continua igual.
  await create(db, ana, 'copy', 'legenda curta')
  await db.query(`update pricing_settings set require_trusted_cost = true`)
  const afterFirst = await balanceOf(db, ana)
  await expectError(create(db, ana, 'copy', 'legenda curta'), 'model_cost_unverified')
  await expectError(create(db, ana, 'foto'), 'model_cost_unverified')
  assert.equal(await balanceOf(db, ana), afterFirst)
  assert.equal(afterFirst, balance - 3)

  await as(db, 'authenticated', dona, () => db.query(`select admin_confirm_model_cost('foto', 'https://fal.ai/models/fal-ai/nano-banana-2')`))
  await create(db, ana, 'foto')

  // Preço diferente no fornecedor: o modelo sai do ar até o admin rever a tarifa.
  const priceCheck = (checks) =>
    as(db, 'authenticated', dona, async () => (await db.query(`select admin_record_price_check($1::jsonb) as r`, [JSON.stringify(checks)])).rows[0].r)
  const results = await priceCheck([{ endpoint_id: 'fal-ai/nano-banana-2', unit_price: 0.1, unit: 'image', currency: 'USD' }])
  assert.deepEqual(results.map((row) => [row.slug, row.matches]), [['foto', false]])
  await expectError(create(db, ana, 'foto'), 'model_cost_unverified')
  const same = await priceCheck([{ endpoint_id: 'fal-ai/kling-video/v3/standard/image-to-video', unit_price: 0.084, unit: 'second', currency: 'USD' }])
  assert.equal(same[0].matches, true)
  await as(db, 'authenticated', dona, () =>
    db.query(`select admin_set_model_tariff('foto', '{"unit":"image","usd":0.1}', 'https://fal.ai/models/fal-ai/nano-banana-2 (novo preço)')`))
  await create(db, ana, 'foto')

  // Teto por operação vale sempre, com ou sem trava.
  await db.query(`update pricing_settings set require_trusted_cost = false, max_operation_cost_usd = 3`)
  await expectError(create(db, ana, 'video-veo', 'ela acena', null, source), 'operation_cost_above_cap')
})

await test('preços v3: custo real do texto entra no gasto sem mudar os créditos cobrados', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const text = (await create(db, ana, 'copy', 'legenda para o café')).rows[0]
  await db.query(`select complete_text_generation($1, '{"title":"x","items":[]}')`, [text.id])
  const record = (input, output) => db.query(`select record_text_usage($1, $2, $3) as c`, [text.id, input, output])
  await expectError(record(-1, 10), 'invalid_usage')
  // 1.800 tokens × US$ 4 + 900 × US$ 20 por milhão. Repetir não reconcilia de novo.
  assert.equal(Number((await record(1800, 900)).rows[0].c), 0.0252)
  assert.equal(Number((await record(99999, 99999)).rows[0].c), 0.0252)
  const row = (await db.query(`select credits, spend_usd, actual_cost_usd, input_tokens, output_tokens from generations where id = $1`, [text.id])).rows[0]
  assert.deepEqual([row.credits, Number(row.spend_usd), Number(row.actual_cost_usd), row.input_tokens, row.output_tokens], [3, 0.0252, 0.0252, 1800, 900])
  await expectError(as(db, 'authenticated', ana, () => db.query(`select record_text_usage($1, 1, 1)`, [text.id])), 'permission denied')
})

await test('preços v3: boas-vindas só com e-mail confirmado, uma vez por e-mail e até o teto do dia', async (db) => {
  const unconfirmed = (await db.query(`insert into auth.users (email, email_confirmed_at) values ('nova@x.com', null) returning id`)).rows[0].id
  assert.equal(await balanceOf(db, unconfirmed), 0)
  await db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [unconfirmed])
  assert.equal(await balanceOf(db, unconfirmed), 20)
  await db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [unconfirmed])
  assert.equal(await balanceOf(db, unconfirmed), 20)

  // Apagar a conta e voltar com o mesmo Gmail escrito de outro jeito não dá crédito de novo.
  const first = await newUser(db, 'Ana.Lima@gmail.com')
  assert.equal(await balanceOf(db, first), 20)
  await db.query(`delete from auth.users where id = $1`, [first])
  assert.equal(await balanceOf(db, await newUser(db, 'analima+teste@googlemail.com')), 0)
  assert.equal(await balanceOf(db, await newUser(db, 'ana.lima@outro.com')), 20)

  await db.query(`update pricing_settings set welcome_daily_cap = (select count(*) from welcome_grants where granted_at >= spend_day_start())`)
  assert.equal(await balanceOf(db, await newUser(db, 'depois-do-teto@x.com')), 0)
})

await test('preços v3: vitrine lê do banco, sem rascunho de venda direta nem custo, e bate com o checkout', async (db) => {
  const read = async () => as(db, 'anon', null, async () => (await db.query(`select storefront_plans() as s`)).rows[0].s)
  const before = await read()
  assert.deepEqual(before.plans.map((plan) => plan.slug), ['gratis', 'business-start', 'business-pro', 'business-scale', 'enterprise'])
  assert.equal(before.welcome_credits, 20)
  assert.ok(before.plans.filter((plan) => plan.line === 'business').every((plan) => plan.cta === 'contact'))
  const enterprise = before.plans.find((plan) => plan.slug === 'enterprise')
  assert.deepEqual([enterprise.price_cents, enterprise.monthly_credits, enterprise.seats], [null, null, null])
  assert.ok(before.plans.every((plan) => !('ai_budget_cents' in plan) && !('provider_cost_usd' in plan)))

  // Depois da virada, os Creator entram com os números da tabela de planos, a mesma do checkout.
  await db.query(`update pricing_settings set credit_scale = 2`)
  await db.query(`update subscription_plans set status = 'legacy', public = false where slug in ('starter', 'pro', 'studio')`)
  await db.query(`update subscription_plans set status = 'live', active = true, public = true where slug like 'creator-%'`)
  const after = await read()
  const creator = after.plans.filter((plan) => plan.slug.startsWith('creator-'))
  assert.deepEqual(creator.map((plan) => [plan.slug, plan.price_cents, plan.monthly_credits, plan.exports_month, plan.highlight, plan.cta]), [
    ['creator-start', 7990, 2300, 40, false, 'subscribe'],
    ['creator-pro', 16990, 5000, 150, true, 'subscribe'],
    ['creator-max', 34990, 10000, 400, false, 'subscribe'],
  ])
  const sold = (await db.query(`select slug, price_cents, monthly_credits from subscription_plans where public and status = 'live' order by position`)).rows
  assert.deepEqual(sold, creator.map((plan) => ({ slug: plan.slug, price_cents: plan.price_cents, monthly_credits: plan.monthly_credits })))
  assert.ok(creator.every((plan) => !plan.features.some((feature) => /\d\.\d{3}/.test(feature))))
})

await test('preços v3: rascunho muda pelo painel com motivo; plano no ar não; margem usa a escala certa', async (db) => {
  const dona = await newUser(db, 'dona@x.com')
  await makeAdmin(db, dona)
  const update = (slug, price, credits, exports, budget, reason = 'Calculadora: meta de 60%') =>
    as(db, 'authenticated', dona, async () => (await db.query(`select * from admin_update_draft_plan($1, $2, $3, $4, $5, $6)`, [slug, price, credits, exports, budget, reason])).rows[0])

  await expectError(update('pro', 7990, 450, 150, 0), 'plan_not_draft')
  await expectError(update('creator-pro', 16990, -5, 150, 5100), 'invalid_plan_values')
  await expectError(update('creator-pro', 16990, 5100, 150, 5100, ''), 'reason_required')
  const plan = await update('creator-pro', 16990, 5100, 150, 5100)
  assert.deepEqual([plan.monthly_credits, plan.daily_credit_limit, plan.monthly_credit_limit, plan.status, plan.public], [5100, 5100, 25500, 'draft', false])
  assert.equal((await db.query(`select ai_budget_cents from plan_cost_budgets where plan_slug = 'creator-pro'`)).rows[0].ai_budget_cents, 5100)
  const log = (await db.query(`select details from admin_audit_logs where action = 'plan.draft_update'`)).rows[0]
  assert.equal(Number(log.details.after.full_use_margin), 0.6048)

  const economics = await as(db, 'authenticated', dona, async () => (await db.query(`select admin_plan_economics() as e`)).rows[0].e)
  const bySlug = Object.fromEntries(economics.plans.map((row) => [row.slug, row]))
  // Plano no ar ainda na escala atual: 300 créditos × R$ 0,09 × 1,15 = R$ 31,05 de IA no uso integral.
  assert.equal(Number(bySlug.starter.full_use_margin), 0.3866)
  assert.equal(Number(bySlug['creator-pro'].full_use_margin), 0.6048)
  assert.equal(economics.models.find((model) => model.slug === 'foto').quoted_credits, 52)

  const finance = await newUser(db, 'fin@x.com')
  await makeAdmin(db, finance, 'finance')
  await expectError(as(db, 'authenticated', finance, () => db.query(`select admin_update_draft_plan('creator-pro', 1, 1, 1, 1, 'tentativa')`)), 'forbidden')
  assert.ok(await as(db, 'authenticated', finance, async () => (await db.query(`select admin_plan_economics() as e`)).rows[0].e))
})

// ------------------------------------------------------- analytics do admin (0020)

await test('analytics: retenção, ferramentas, créditos e tokens; custo e e-mail só com permissão', async (db) => {
  const dona = await newUser(db, 'dona@x.com')
  await makeAdmin(db, dona)
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  await db.query(`update profiles set created_at = now() - interval '10 days' where id = $1`, [ana])
  const text = (await create(db, ana, 'copy', 'legenda para o café')).rows[0]
  await db.query(`select complete_text_generation($1, '{"title":"x","items":[]}')`, [text.id])
  await db.query(`select record_text_usage($1, 1800, 900)`, [text.id])
  // Ana voltou no oitavo dia depois do cadastro: conta no D7. Bia nunca gerou.
  await db.query(`update generations set created_at = now() - interval '2 days' where id = $1`, [text.id])

  const data = await as(db, 'authenticated', dona, async () =>
    (await db.query(`select admin_analytics(now() - interval '30 days', now() + interval '1 day') as a`)).rows[0].a)
  assert.equal(data.retention.total_users, 3)
  assert.equal(data.retention.ever_active, 1)
  assert.equal(data.retention.wau, 1)
  const d7 = data.retention.returning.find((row) => row.day === 7)
  assert.deepEqual([d7.eligible, d7.returned], [1, 1])
  assert.equal(data.retention.activation.signed_up, 3)
  assert.equal(data.retention.activation.activated, 1)
  assert.equal(data.retention.cohorts.reduce((sum, row) => sum + row.size, 0), 3)

  const copy = data.tools.by_tool.find((row) => row.model_slug === 'copy')
  assert.deepEqual([copy.total, copy.users, copy.succeeded], [1, 1, 1])
  assert.equal(Number(copy.cost_usd), 0.0252)
  assert.equal(data.tools.series.reduce((sum, day) => sum + day.text, 0), 1)

  assert.equal(data.credits.spent, 3)
  assert.equal(data.credits.outstanding, (await db.query(`select sum(balance)::int as n from credit_balances`)).rows[0].n)
  assert.equal(data.credits.top_spenders[0].email, 'ana@x.com')
  assert.deepEqual([data.tokens.input, data.tokens.output, data.tokens.measured], [1800, 900, 1])
  assert.equal(data.tokens.top_users[0].email, 'ana@x.com')

  const analyst = await newUser(db, 'analista@x.com')
  await makeAdmin(db, analyst, 'analyst')
  const limited = await as(db, 'authenticated', analyst, async () =>
    (await db.query(`select admin_analytics(now() - interval '30 days', now() + interval '1 day') as a`)).rows[0].a)
  assert.equal(limited.retention.dormant, null)
  assert.equal(limited.credits.top_spenders, null)
  assert.equal(limited.tokens.cost_usd, null)
  assert.equal(limited.tools.by_tool[0].cost_usd, null)

  await expectError(as(db, 'authenticated', bia, () => db.query(`select admin_analytics(${PERIOD})`)), 'forbidden')
  await expectError(as(db, 'authenticated', dona, () => db.query(`select admin_analytics(now(), now() - interval '1 day')`)), 'invalid_period')
})

// ------------------------------------------------------- listas do admin (0022)

await test('admin: lista gerações e assinaturas com filtro; valores só para o financeiro', async (db) => {
  const dona = await newUser(db, 'dona@x.com')
  await makeAdmin(db, dona)
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  const failed = (await create(db, ana, 'foto')).rows[0]
  await db.query(`select fail_generation($1, 'fornecedor fora do ar')`, [failed.id])
  await create(db, bia, 'foto')
  const sub = await newSubscription(db, ana, 'pro')
  await activate(db, sub, 'pay_lists')

  const list = (args) => as(db, 'authenticated', dona, async () => (await db.query(`select admin_generations(${args}) as r`)).rows[0].r)
  const all = await list('')
  assert.equal(all.total, 2)
  const onlyFailed = await list(`'failed'`)
  assert.deepEqual([onlyFailed.total, onlyFailed.rows[0].email, onlyFailed.rows[0].error], [1, 'ana@x.com', 'fornecedor fora do ar'])
  assert.equal((await list(`null, null, 'BIA@'`)).total, 1)
  assert.equal((await list(`null, null, null, 1, 0`)).rows.length, 1)

  const subs = await as(db, 'authenticated', dona, async () => (await db.query(`select admin_subscriptions() as r`)).rows[0].r)
  assert.equal(subs.total, 1)
  assert.equal(subs.rows[0].email, 'ana@x.com')
  assert.equal(subs.rows[0].status, 'active')
  assert.equal(subs.rows[0].payments, 1)
  assert.ok(subs.rows[0].paid_cents > 0)
  assert.equal(subs.counts.active, 1)

  const support = await newUser(db, 'suporte@x.com')
  await makeAdmin(db, support, 'support')
  const seen = await as(db, 'authenticated', support, async () => (await db.query(`select admin_subscriptions() as r`)).rows[0].r)
  assert.deepEqual([seen.rows[0].price_cents, seen.rows[0].paid_cents], [null, null])
  const gens = await as(db, 'authenticated', support, async () => (await db.query(`select admin_generations() as r`)).rows[0].r)
  assert.equal(gens.rows[0].cost_usd, null)

  const analyst = await newUser(db, 'analista@x.com')
  await makeAdmin(db, analyst, 'analyst')
  await expectError(as(db, 'authenticated', analyst, () => db.query(`select admin_generations()`)), 'forbidden')
  await expectError(as(db, 'authenticated', bia, () => db.query(`select admin_subscriptions()`)), 'forbidden')
})

// ------------------------------------------------------- filtros do dashboard (0024)

await test('dashboard: filtro por plano e por ferramenta recorta a base', async (db) => {
  const dona = await newUser(db, 'dona@x.com')
  await makeAdmin(db, dona)
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  await activate(db, await newSubscription(db, ana, 'pro'), 'pay_filter')
  await create(db, ana, 'foto')
  await create(db, bia, 'foto')
  await create(db, bia, 'copy', 'legenda para o café')

  const dash = (plan = null, model = null) =>
    as(db, 'authenticated', dona, async () => (await db.query(`select admin_dashboard(${PERIOD}, $1, $2) as d`, [plan, model])).rows[0].d)
  const all = await dash()
  assert.equal(all.generations.total, 3)
  const pro = await dash('pro')
  assert.deepEqual([pro.users.total, pro.generations.total, pro.users.paying], [1, 1, 1])
  const free = await dash('gratis')
  assert.equal(free.generations.total, 2)
  assert.equal(free.users.paying, 0)
  const foto = await dash(null, 'foto')
  assert.deepEqual([foto.generations.total, foto.by_model.length], [2, 1])
  assert.equal((await dash('gratis', 'foto')).generations.total, 1)
  assert.deepEqual(all.filters, { plan: null, model: null })
})

// ---------------------------------------------- central de inteligência (0025)

const aiUsageOf = async (db, generationId) =>
  (await db.query(`select * from ai_usage_events where generation_id = $1`, [generationId])).rows

await test('inteligência: consumo de IA é registrado uma vez por geração, com base do custo e câmbio da hora', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await setWallet(db, ana, 500)
  const ok = (await create(db, ana, 'foto')).rows[0]
  await db.query(`select complete_generation($1, 'a.png', 'image/png')`, [ok.id])
  await db.query(`select complete_generation($1, 'a.png', 'image/png')`, [ok.id])
  const events = await aiUsageOf(db, ok.id)
  assert.equal(events.length, 1)
  const [event] = events
  assert.equal(event.cost_basis, 'estimated')
  assert.equal(event.status, 'succeeded')
  assert.equal(event.unit, 'image')
  assert.equal(Number(event.units), 1)
  assert.equal(event.credits, ok.credits)
  assert.equal(Number(event.cost_brl), Number((Number(event.cost_original) * Number(event.fx_rate)).toFixed(4)))

  const failed = (await create(db, ana, 'foto')).rows[0]
  await db.query(`select fail_generation($1, 'erro')`, [failed.id])
  assert.equal((await aiUsageOf(db, failed.id)).length, 0, 'falha não cobrada pelo fornecedor não entra no custo')

  const text = (await create(db, ana, 'copy', 'legenda para o café')).rows[0]
  await db.query(`select fail_generation($1, 'timeout')`, [text.id])
  const [billed] = await aiUsageOf(db, text.id)
  assert.deepEqual([billed.status, billed.credits], ['failed_billed', 0])

  const done = (await create(db, ana, 'copy', 'legenda para o bolo')).rows[0]
  await db.query(`select complete_text_generation($1, '{"title":"x","items":[]}')`, [done.id])
  const before = (await aiUsageOf(db, done.id))[0]
  await db.query(`update pricing_settings set usd_brl = 9`)
  await db.query(`select record_text_usage($1, 1000, 500)`, [done.id])
  const [metered] = await aiUsageOf(db, done.id)
  assert.equal(metered.cost_basis, 'metered')
  assert.equal(Number(metered.units), 1500)
  assert.equal(Number(metered.fx_rate), Number(before.fx_rate), 'o câmbio fica o da primeira gravação')
  assert.equal(Number(metered.cost_original), 0.014)
})

await test('inteligência: preço do modelo tem vigência e meta de margem fica auditada', async (db) => {
  const dona = await newUser(db, 'dona@x.com')
  await makeAdmin(db, dona)
  const history = async () => (await db.query(`select * from model_price_history where model_slug = 'foto' order by id`)).rows
  assert.equal((await history()).length, 1)
  await db.query(`update models set description = 'outra' where slug = 'foto'`)
  assert.equal((await history()).length, 1, 'mudança fora do preço não abre vigência')

  await expectError(as(db, 'authenticated', dona, () => db.query(`select admin_set_model_target_margin('foto', 0.5, 'x')`)), 'reason_required')
  await as(db, 'authenticated', dona, () => db.query(`select admin_set_model_target_margin('foto', 0.5, 'meta do trimestre')`))
  const rows = await history()
  assert.equal(rows.length, 2)
  assert.notEqual(rows[0].effective_to, null)
  assert.equal(rows[1].effective_to, null)
  assert.equal(rows[1].changed_by, dona)
  const list = await as(db, 'authenticated', dona, async () => (await db.query(`select admin_model_price_history('foto') as h`)).rows[0].h)
  assert.equal(list[0].changed_by_email, 'dona@x.com')
  const audit = await db.query(`select count(*)::int as n from admin_audit_logs where action = 'model.target_margin'`)
  assert.equal(audit.rows[0].n, 1)
})

await test('inteligência: custos de IA somam o período, filtram e escondem receita de quem não é financeiro', async (db) => {
  const dona = await newUser(db, 'dona@x.com')
  await makeAdmin(db, dona)
  const ana = await newUser(db, 'ana@x.com')
  await setWallet(db, ana, 500)
  for (let i = 0; i < 2; i += 1) await succeed(db, (await create(db, ana, 'foto')).rows[0].id)
  const costs = (args = '') =>
    as(db, 'authenticated', dona, async () => (await db.query(`select admin_ai_costs(${PERIOD}${args}) as c`)).rows[0].c)
  const all = await costs()
  assert.equal(all.kpis.generations, 2)
  assert.equal(all.kpis.active_users, 1)
  assert.ok(Number(all.kpis.cost_period_brl) > 0)
  assert.equal(Number(all.kpis.cost_today_brl), Number(all.kpis.cost_period_brl))
  assert.ok(all.kpis.revenue_estimated_brl > 0)
  const foto = all.models.find((m) => m.slug === 'foto')
  assert.deepEqual([foto.uses_period, foto.uses_total], [2, 2])
  assert.ok(all.series.length >= 2)
  assert.equal(all.trend_30d.length, 30)

  const videos = await costs(`, null, 'video'`)
  assert.equal(videos.kpis.generations, 0)
  assert.ok(videos.models.every((m) => m.kind === 'video'))

  const analyst = await newUser(db, 'analista@x.com')
  await makeAdmin(db, analyst, 'analyst')
  const seen = await as(db, 'authenticated', analyst, async () => (await db.query(`select admin_ai_costs(${PERIOD}) as c`)).rows[0].c)
  assert.equal(seen.kpis.revenue_estimated_brl, null)
  const support = await newUser(db, 'suporte@x.com')
  await makeAdmin(db, support, 'support')
  await expectError(as(db, 'authenticated', support, () => db.query(`select admin_ai_costs(${PERIOD})`)), 'forbidden')
  await expectError(as(db, 'authenticated', dona, () => db.query(`select admin_ai_costs(now(), now() - interval '1 day')`)), 'invalid_period')
})

await test('inteligência: cortesia de plano libera o plano sem cobrança, sem MRR, e assinatura paga vem antes', async (db) => {
  const dona = await newUser(db, 'dona@x.com')
  await makeAdmin(db, dona)
  const ana = await newUser(db, 'ana@x.com')
  const planOf = async () => (await db.query(`select (effective_plan($1)).slug as s`, [ana])).rows[0].s
  const startBalance = await balanceOf(db, ana)
  assert.equal(await planOf(), 'gratis')
  await expectError(as(db, 'authenticated', dona, () => db.query(`select admin_grant_plan($1, 'pro', 30, 'x')`, [ana])), 'reason_required')
  await expectError(as(db, 'authenticated', dona, () => db.query(`select admin_grant_plan($1, 'gratis', 30, 'parceria')`, [ana])), 'plan_not_found')
  await as(db, 'authenticated', dona, () => db.query(`select admin_grant_plan($1, 'pro', 30, 'parceria com criadora')`, [ana]))
  assert.equal(await planOf(), 'pro')
  const dash = await as(db, 'authenticated', dona, async () => (await db.query(`select admin_dashboard(${PERIOD}) as d`)).rows[0].d)
  assert.equal(Number(dash.finance.mrr_cents), 0)
  assert.equal(await balanceOf(db, ana), startBalance, 'cortesia não dá crédito de plano')

  await as(db, 'authenticated', dona, () => db.query(`select admin_grant_plan($1, 'starter', 7, 'troca de cortesia')`, [ana]))
  assert.equal(await planOf(), 'starter')
  assert.equal((await db.query(`select count(*)::int as n from plan_grants where user_id = $1 and revoked_at is null`, [ana])).rows[0].n, 1)

  await activate(db, await newSubscription(db, ana, 'pro'), 'pay_grant')
  assert.equal(await planOf(), 'pro', 'assinatura paga vale antes da cortesia')
  await as(db, 'authenticated', dona, () => db.query(`select admin_revoke_plan_grant($1, 'fim da parceria')`, [ana]))
  await expectError(as(db, 'authenticated', dona, () => db.query(`select admin_revoke_plan_grant($1, 'de novo sem nada')`, [ana])), 'grant_not_found')

  const support = await newUser(db, 'suporte@x.com')
  await makeAdmin(db, support, 'support')
  await expectError(
    as(db, 'authenticated', support, () => db.query(`select admin_grant_plan($1, 'pro', 30, 'tentativa do suporte')`, [ana])),
    'forbidden',
  )
})

await test('inteligência: conta criada no admin passa pela conferência, recebe só uma configuração e fica auditada', async (db) => {
  const dona = await newUser(db, 'dona@x.com')
  await makeAdmin(db, dona)
  await newUser(db, 'ana@x.com')
  const check = (email, plan = 'pro', days = 30, credits = 50, reason = 'conta de parceira') =>
    as(db, 'authenticated', dona, () => db.query(`select admin_check_new_user($1, $2, $3, $4, $5)`, [email, plan, days, credits, reason]))
  await expectError(check('ana@x.com'), 'email_taken')
  await expectError(check('ANA@x.com'), 'email_taken')
  await expectError(check('nao-e-email'), 'invalid_email')
  await expectError(check('nova@x.com', 'pro', null), 'invalid_days')
  await expectError(check('nova@x.com', 'pro', 30, 50, 'x'), 'reason_required')
  await check('nova@x.com')

  const nova = await newUser(db, 'nova@x.com')
  const startBalance = await balanceOf(db, nova)
  const setup = () =>
    as(db, 'authenticated', dona, () => db.query(`select admin_setup_new_user($1, 'pro', 30, 50, false, 'conta de parceira')`, [nova]))
  await setup()
  await expectError(setup(), 'account_not_found')
  assert.equal(await balanceOf(db, nova), startBalance + 50)
  assert.equal((await db.query(`select (effective_plan($1)).slug as s`, [nova])).rows[0].s, 'pro')

  const velha = await newUser(db, 'velha@x.com')
  await db.query(`update profiles set created_at = now() - interval '1 hour' where id = $1`, [velha])
  await expectError(
    as(db, 'authenticated', dona, () => db.query(`select admin_setup_new_user($1, null, null, 0, false, 'tentar conta antiga')`, [velha])),
    'account_not_found',
  )

  const admin = await newUser(db, 'admin2@x.com')
  await makeAdmin(db, admin, 'admin')
  const outra = await newUser(db, 'outra@x.com')
  await as(db, 'authenticated', admin, () => db.query(`select admin_setup_new_user($1, null, null, 0, true, 'conta bloqueada de teste')`, [outra]))
  assert.notEqual((await db.query(`select suspended_at from profiles where id = $1`, [outra])).rows[0].suspended_at, null)

  const list = await as(db, 'authenticated', dona, async () => (await db.query(`select admin_users_list(p_manual => true) as r`)).rows[0].r)
  assert.deepEqual(list.rows.map((row) => row.email).sort(), ['nova@x.com', 'outra@x.com'])
  const audit = await db.query(`select count(*)::int as n from admin_audit_logs where action = 'user.create'`)
  assert.equal(audit.rows[0].n, 2)
})

await test('inteligência: lista de usuários combina filtros, ordena por consumo e mostra custo só ao financeiro', async (db) => {
  const dona = await newUser(db, 'dona@x.com')
  await makeAdmin(db, dona)
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  await setWallet(db, ana, 500)
  await activate(db, await newSubscription(db, bia, 'pro'), 'pay_list')
  for (let i = 0; i < 2; i += 1) await succeed(db, (await create(db, ana, 'foto')).rows[0].id)
  await db.query(`update auth.users set last_sign_in_at = now() where id = $1`, [ana])
  await db.query(`update profiles set suspended_at = now() where id = $1`, [bia])

  const list = (args) => as(db, 'authenticated', dona, async () => (await db.query(`select admin_users_list(${args}) as r`)).rows[0].r)
  const byCost = await list(`p_sort => 'cost'`)
  assert.equal(byCost.total, 3)
  assert.equal(byCost.rows[0].email, 'ana@x.com')
  assert.ok(Number(byCost.rows[0].ai_cost_brl) > 0)
  assert.equal(byCost.rows[0].generations, 2)
  assert.equal((await list(`p_plan => 'pro'`)).rows[0].email, 'bia@x.com')
  assert.equal((await list(`p_account => 'suspended'`)).total, 1)
  assert.equal((await list(`p_seen => '7d', p_credits => 'with'`)).rows[0].email, 'ana@x.com')
  assert.equal((await list(`p_query => 'bia', p_subscription_status => 'active'`)).total, 1)
  assert.equal((await list(`p_limit => 1, p_offset => 1`)).rows.length, 1)
  await expectError(list(`p_sort => 'drop'`), 'invalid_sort')

  const support = await newUser(db, 'suporte@x.com')
  await makeAdmin(db, support, 'support')
  const seen = await as(db, 'authenticated', support, async () => (await db.query(`select admin_users_list(p_sort => 'cost') as r`)).rows[0].r)
  assert.equal(seen.rows[0].ai_cost_brl, null)
  const profile = await as(db, 'authenticated', support, async () => (await db.query(`select admin_user_profile($1) as p`, [ana])).rows[0].p)
  assert.equal(profile.account.email, 'ana@x.com')
  assert.equal(profile.generations.length, 2)
  assert.deepEqual([profile.ai_cost, profile.payments, profile.admin_actions], [null, null, null])
  assert.equal(profile.top_models[0].model_slug, 'foto')
  const full = await as(db, 'authenticated', dona, async () => (await db.query(`select admin_user_profile($1) as p`, [ana])).rows[0].p)
  assert.ok(Number(full.ai_cost.total_brl) > 0)
  assert.equal(full.activity.active_days_30d, 1)
})

await test('inteligência: negócio traz MRR, créditos, despesas registradas e rentabilidade por plano', async (db) => {
  const dona = await newUser(db, 'dona@x.com')
  await makeAdmin(db, dona)
  const ana = await newUser(db, 'ana@x.com')
  await activate(db, await newSubscription(db, ana, 'pro'), 'pay_business')
  await succeed(db, (await create(db, ana, 'foto')).rows[0].id)

  const business = () => as(db, 'authenticated', dona, async () => (await db.query(`select admin_business(${PERIOD}) as b`)).rows[0].b)
  await expectError(as(db, 'authenticated', dona, () => db.query(`select admin_add_expense(current_date, 'infra', 'Supabase', 0)`)), 'invalid_amount')
  const expense = await as(db, 'authenticated', dona, async () =>
    (await db.query(`select admin_add_expense(current_date, 'infra', 'Supabase Pro', 13000) as id`)).rows[0].id)
  let data = await business()
  assert.equal(Number(data.money.expenses_cents), 13000)
  assert.ok(Number(data.money.received_cents) > 0)
  assert.ok(Number(data.money.mrr_series.at(-1).mrr_cents) > 0)
  assert.equal(data.money.mrr_series.length, 12)
  assert.equal(data.conversion.signups, 2)
  assert.equal(data.conversion.converted, 1)
  assert.ok(data.credits.consumed > 0)
  assert.ok(data.credits.distributed > 0)
  const pro = data.money.plans.find((plan) => plan.slug === 'pro')
  assert.deepEqual([pro.users, pro.credits > 0, Number(pro.ai_cost_brl) > 0], [1, true, true])

  await expectError(as(db, 'authenticated', dona, () => db.query(`select admin_void_expense($1, 'x')`, [expense])), 'reason_required')
  await as(db, 'authenticated', dona, () => db.query(`select admin_void_expense($1, 'lançada em dobro')`, [expense]))
  data = await business()
  assert.equal(Number(data.money.expenses_cents), 0)
  assert.notEqual(data.money.expenses[0].voided_at, null)

  const analyst = await newUser(db, 'analista@x.com')
  await makeAdmin(db, analyst, 'analyst')
  const seen = await as(db, 'authenticated', analyst, async () => (await db.query(`select admin_business(${PERIOD}) as b`)).rows[0].b)
  assert.deepEqual([seen.money, seen.unusual_users], [null, null])
  await expectError(
    as(db, 'authenticated', analyst, () => db.query(`select admin_add_expense(current_date, 'infra', 'Supabase', 100)`)),
    'forbidden',
  )
})

// ---------------------------------------------------- central de comando (0026)

await test('central: receita bruta, consumo por funcionalidade, usuários, coortes e operação numa chamada', async (db) => {
  const dona = await newUser(db, 'dona@x.com')
  await makeAdmin(db, dona)
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  await newUser(db, 'caio@x.com')
  await activate(db, await newSubscription(db, ana, 'pro'), 'pay_center')
  await setWallet(db, bia, 500)
  for (let i = 0; i < 2; i += 1) await succeed(db, (await create(db, ana, 'foto')).rows[0].id)
  await succeed(db, (await create(db, bia, 'foto')).rows[0].id)
  const broken = (await create(db, bia, 'foto')).rows[0]
  await db.query(`select fail_generation($1, 'fornecedor fora do ar')`, [broken.id])
  await setWallet(db, bia, 0)

  const center = (who = dona) => as(db, 'authenticated', who, async () => (await db.query(`select admin_command_center(${PERIOD}) as c`)).rows[0].c)
  const data = await center()
  assert.ok(Number(data.revenue.gross_cents) > 0)
  assert.equal(Number(data.revenue.gross_cents), data.revenue.series.reduce((sum, day) => sum + Number(day.gross_cents), 0))
  assert.ok(Number(data.revenue.projected_next_month_cents) > 0)
  assert.equal(data.revenue.new_paying, 1)
  assert.ok(Number(data.revenue.paying_ai_cost_brl) > 0)
  assert.equal(data.ai.events, 3)
  assert.equal(data.ai.by_feature[0].feature, 'image')
  assert.equal(data.ai.top_users[0].email, 'ana@x.com')
  assert.equal(data.ai.top_users[0].plan_slug, 'pro')
  assert.equal(data.users.dau, 2)
  assert.equal(data.users.used_ai, 2)
  assert.equal(data.users.never_used, 2, 'caio e a dona nunca geraram')
  assert.equal(data.users.exhausted, 1)
  assert.equal(data.users.cohorts.at(-1).size, 4)
  assert.equal(data.users.cohorts.at(-1).active[0], 2)
  assert.equal(data.users.cohorts.at(-1).active[1], null, 'semana que ainda não chegou fica vazia')
  assert.deepEqual([data.operations.total, data.operations.succeeded, data.operations.failed], [4, 3, 1])
  assert.equal(data.operations.errors[0].error, 'fornecedor fora do ar')
  assert.equal(data.operations.errors[0].email, 'bia@x.com')
  const provider = data.operations.providers.find((row) => row.total_24h > 0)
  assert.deepEqual([provider.total_24h, provider.failed_24h], [4, 1])
  assert.ok(data.plans.some((plan) => plan.slug === 'pro'))

  const analyst = await newUser(db, 'analista@x.com')
  await makeAdmin(db, analyst, 'analyst')
  const seen = await center(analyst)
  assert.equal(seen.revenue, null)
  assert.equal(seen.settings.payment_fee_rate, null)
  assert.equal(seen.ai.top_users[0].email, null)
  await expectError(center(bia), 'forbidden')
})

console.log(`\n${passed} testes do banco passaram`)
