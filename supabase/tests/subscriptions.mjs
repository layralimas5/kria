// Testes de banco das assinaturas (migration 0003). Roda com: npm run db:test
import assert from 'node:assert/strict'
import { as, balanceOf, expectError, newUser, runner } from './harness.mjs'

const suite = runner()
const { test } = suite

const NEXT_MONTH = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()

async function openSubscription(db, userId, plan = 'pro') {
  const { rows } = await db.query(
    `insert into subscriptions (user_id, plan_slug, price_cents, provider_checkout_id)
     select $1, slug, price_cents, 'chk_' || md5(random()::text) from subscription_plans where slug = $2 returning id`,
    [userId, plan],
  )
  return rows[0].id
}

const grant = (db, subscriptionId, paymentId, periodEnd = NEXT_MONTH) =>
  db.query(`select grant_subscription_payment($1, $2, 'sub_1', 'cus_1', $3) as ok`, [subscriptionId, paymentId, periodEnd])

async function succeededImage(db, userId) {
  const { rows } = await db.query(
    `insert into generations (user_id, model_slug, kind, prompt, credits, status, output_path, output_type)
     values ($1, 'foto', 'image', 'retrato', 5, 'succeeded', $2, 'image/png') returning id`,
    [userId, `${userId}/g.png`],
  )
  return rows[0].id
}

const createPersona = (db, userId, generationId, name) =>
  as(db, 'authenticated', userId, () => db.query(`select * from create_persona($1, $2)`, [generationId, name]))

await test('planos ativos são públicos e vêm do banco com preço e créditos', async (db) => {
  const { rows } = await as(db, 'anon', null, () =>
    db.query(`select slug, price_cents, monthly_credits, max_personas, highlight from subscription_plans order by position`),
  )
  assert.deepEqual(rows, [
    { slug: 'starter', price_cents: 5990, monthly_credits: 300, max_personas: 2, highlight: false },
    { slug: 'pro', price_cents: 7990, monthly_credits: 450, max_personas: 5, highlight: true },
    { slug: 'studio', price_cents: 14990, monthly_credits: 1000, max_personas: 15, highlight: false },
  ])
  await db.query(`update subscription_plans set active = false where slug = 'studio'`)
  const visible = await as(db, 'anon', null, () => db.query(`select slug from subscription_plans`))
  assert.equal(visible.rows.length, 2)
})

await test('pagamento confirmado ativa o plano e credita uma vez, mesmo com webhook repetido', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const sub = await openSubscription(db, ana, 'pro')
  assert.equal((await grant(db, sub, 'pay_1')).rows[0].ok, true)
  assert.equal((await grant(db, sub, 'pay_1')).rows[0].ok, false)
  assert.equal(await balanceOf(db, ana), 20 + 450)

  const { rows } = await db.query(`select status, provider_subscription_id from subscriptions where id = $1`, [sub])
  assert.deepEqual(rows[0], { status: 'active', provider_subscription_id: 'sub_1' })
  const ledger = await db.query(`select delta from credit_ledger where user_id = $1 and reason = 'subscription'`, [ana])
  assert.deepEqual(ledger.rows, [{ delta: 450 }])
})

await test('renovação credita de novo e créditos que sobraram continuam na conta', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const sub = await openSubscription(db, ana, 'starter')
  await grant(db, sub, 'pay_1')
  await grant(db, sub, 'pay_2', new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString())
  assert.equal(await balanceOf(db, ana), 20 + 300 + 300)
})

await test('sem plano: 1 personagem; com Starter: até 2', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const image = await succeededImage(db, ana)
  await createPersona(db, ana, image, 'Luna')
  await expectError(createPersona(db, ana, image, 'Sol'), 'too_many_personas')

  const sub = await openSubscription(db, ana, 'starter')
  await grant(db, sub, 'pay_1')
  await createPersona(db, ana, image, 'Sol')
  await expectError(createPersona(db, ana, image, 'Mar'), 'too_many_personas')
})

await test('assinatura pendente (navegador voltou, webhook não) não libera nada', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await openSubscription(db, ana, 'studio')
  const image = await succeededImage(db, ana)
  await createPersona(db, ana, image, 'Luna')
  await expectError(createPersona(db, ana, image, 'Sol'), 'too_many_personas')
  assert.equal(await balanceOf(db, ana), 20)
})

await test('cancelada mantém o plano até o fim do período pago, depois volta ao grátis', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const sub = await openSubscription(db, ana, 'pro')
  await grant(db, sub, 'pay_1')
  await db.query(`update subscriptions set status = 'canceled', canceled_at = now() where id = $1`, [sub])
  const during = await db.query(`select (current_plan($1)).slug`, [ana])
  assert.equal(during.rows[0].slug, 'pro')

  await db.query(`update subscriptions set current_period_end = now() - interval '1 minute' where id = $1`, [sub])
  const after = await db.query(`select (current_plan($1)).slug`, [ana])
  assert.equal(after.rows[0].slug, null)
})

await test('uma assinatura em andamento por pessoa', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  await openSubscription(db, ana, 'pro')
  await expectError(openSubscription(db, ana, 'studio'), 'subscriptions_one_open')
})

await test('cliente só lê a própria assinatura e não chama as funções de cobrança', async (db) => {
  const ana = await newUser(db, 'ana@x.com')
  const bia = await newUser(db, 'bia@x.com')
  const sub = await openSubscription(db, ana, 'pro')
  await as(db, 'authenticated', bia, async () => {
    const { rows } = await db.query(`select id from subscriptions`)
    assert.equal(rows.length, 0)
    await expectError(db.query(`select grant_subscription_payment($1, 'pay_x', 's', 'c', now())`, [sub]), 'permission denied')
    await expectError(db.query(`update subscriptions set status = 'active'`), 'permission denied')
  })
  const own = await as(db, 'authenticated', ana, () => db.query(`select id from subscriptions`))
  assert.equal(own.rows.length, 1)
})

console.log(`\n${suite.passed} testes de assinatura passaram`)
