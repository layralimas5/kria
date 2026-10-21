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

async function makeAdmin(db, userId) {
  await db.query(`insert into admin_users (user_id) values ($1)`, [userId])
}

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
  assert.equal(seen.models, 4)
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
    await expectError(db.query(`select admin_overview()`), 'forbidden')
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

    const overview = (await db.query(`select admin_overview() as o`)).rows[0].o
    assert.equal(overview.total_users, 2)
    assert.equal(overview.revenue_by_plan.length, 3)
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
  const { rows } = await db.query(`select slug, max_personas from subscription_plans order by position`)
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
  const { rows } = await db.query(`select slug, tools from subscription_plans order by position`)
  assert.deepEqual(rows, [
    { slug: 'gratis', tools: ['copy', 'prompt_library'] },
    { slug: 'starter', tools: ['copy', 'prompt_library'] },
    { slug: 'pro', tools: ['copy', 'prompt_library', 'motion_control', 'ugc_studio'] },
    { slug: 'studio', tools: ['copy', 'prompt_library', 'motion_control', 'ugc_studio', 'projects'] },
  ])
  await expectError(db.query(`update subscription_plans set tools = array['hackear'] where slug = 'pro'`), 'check')
})

console.log(`\n${passed} testes do banco passaram`)
