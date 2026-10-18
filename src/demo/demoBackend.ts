// Backend falso do modo demo: responde no lugar do Supabase (REST, RPC,
// Storage e Edge Functions) pelo `fetch` do cliente. Só é carregado com
// VITE_DEMO=true; nada disso entra na conversa com o servidor de verdade.
// Imita as regras do banco (baldes da carteira, plano, idempotência) só o
// suficiente para as telas se comportarem como no ar.

import { createDemoState, DEMO_IMAGES, DEMO_USER_ID, DEMO_VIDEO, nextLedgerId, uuid, type DemoState, type Row } from './demoData'

// O estado sobrevive ao recarregar a aba (sessionStorage); fechar a aba recomeça o demo.
const SESSION_KEY = 'kria-demo-state-v2'

function loadState(): DemoState {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY)
    // Mescla com o estado novo: campos criados depois não faltam em sessões antigas.
    if (saved) return { ...createDemoState(), ...(JSON.parse(saved) as Partial<DemoState>) }
  } catch (error) {
    console.warn('demo: estado salvo ilegível, recomeçando', error)
  }
  return createDemoState()
}

const state = loadState()

function persist() {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('demo: não deu para salvar o estado', error)
  }
}

const IMAGE_SECONDS = 4
const VIDEO_SECONDS = 9

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, status)
/** Erro de RPC no formato do PostgREST: o código vai em `message`, como o `raise exception`. */
const rpcFail = (code: string) => json({ message: code, code: 'P0001' }, 400)

const balanceOf = () => state.purchasedBalance + state.subscriptionBalance
const wallet = () => ({
  user_id: DEMO_USER_ID,
  balance: balanceOf(),
  subscription_balance: state.subscriptionBalance,
  purchased_balance: state.purchasedBalance,
})

const TABLES: Record<string, () => Row[]> = {
  models: () => state.models.filter((model) => model.active !== false),
  credit_packs: () => state.packs,
  subscription_plans: () => state.plans.filter((plan) => plan.active !== false),
  subscriptions: () => state.subscriptions,
  subscription_payments: () => state.subscriptionPayments,
  user_preferences: () => [state.preferences],
  personas: () => state.personas,
  generations: () => state.generations,
  credit_ledger: () => state.ledger,
  purchases: () => state.purchases,
  credit_balances: () => [wallet()],
  profiles: () => [state.profile],
  admin_audit_logs: () => state.audit,
}

function addLedger(subscriptionDelta: number, purchasedDelta: number, reason: string, note: string) {
  state.subscriptionBalance += subscriptionDelta
  state.purchasedBalance += purchasedDelta
  state.ledger.unshift({
    id: nextLedgerId(),
    user_id: DEMO_USER_ID,
    delta: subscriptionDelta + purchasedDelta,
    reason,
    note,
    balance_after: balanceOf(),
    created_at: new Date().toISOString(),
  })
}

function audit(action: string, target: string | null, reason: string | null, targetUserId: string | null = null) {
  state.audit.unshift({ id: state.audit.length + 1, action, target, reason, target_user_id: targetUserId, details: {}, created_at: new Date().toISOString() })
}

/** Aplica os filtros `col=eq.valor`, `in`, `gt`, `order` e `limit` do PostgREST que o app usa. */
function query(rows: Row[], params: URLSearchParams): Row[] {
  let result = [...rows]
  params.forEach((value, key) => {
    if (value.startsWith('eq.')) result = result.filter((row) => String(row[key]) === value.slice(3))
    if (value.startsWith('gt.')) result = result.filter((row) => Number(row[key]) > Number(value.slice(3)))
    if (value.startsWith('in.(')) {
      const allowed = value.slice(4, -1).split(',').map((item) => item.replace(/"/g, ''))
      result = result.filter((row) => allowed.includes(String(row[key])))
    }
  })
  const order = params.get('order')
  if (order) {
    const [column = '', direction] = order.split('.')
    result.sort((a, b) => {
      const comparison = String(a[column]).localeCompare(String(b[column]), undefined, { numeric: true })
      return direction === 'desc' ? -comparison : comparison
    })
  }
  const limit = Number(params.get('limit'))
  return limit > 0 ? result.slice(0, limit) : result
}

function settleOpenGenerations() {
  const now = Date.now()
  state.generations.forEach((generation, index) => {
    if (generation.status !== 'running') return
    const seconds = (now - new Date(String(generation.created_at)).getTime()) / 1000
    const isVideo = generation.kind === 'video'
    if (seconds < (isVideo ? VIDEO_SECONDS : IMAGE_SECONDS)) return
    generation.status = 'succeeded'
    generation.output_path = isVideo ? DEMO_VIDEO : DEMO_IMAGES[(index + 3) % DEMO_IMAGES.length]
    generation.output_type = isVideo ? 'video/webm' : 'image/svg+xml'
    generation.completed_at = new Date().toISOString()
  })
  persist()
}

function currentPlan(): Row {
  const live = state.subscriptions.find(
    (item) => (item.status === 'active' || item.status === 'past_due' || item.status === 'canceled') && String(item.current_period_end) > new Date().toISOString(),
  )
  return state.plans.find((plan) => plan.slug === (live?.plan_slug ?? 'gratis')) ?? state.plans[0]!
}

function generate(body: Row): Response {
  const key = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : null
  const repeated = key ? state.generations.find((item) => item.idempotency_key === key) : undefined
  if (repeated) return json({ generation: repeated })

  const model = state.models.find((item) => item.slug === body.model && item.active !== false)
  if (!model) return fail(400, 'model_unavailable', 'Esse modelo não está disponível.')
  const plan = currentPlan()
  const allowed = model.allowed_plans as string[] | null
  if (allowed && !allowed.includes(String(plan.slug))) {
    return fail(403, 'plan_required', 'Esse modelo faz parte de um plano pago. Veja os planos em Assinatura.')
  }
  const credits = Number(model.credits)
  if (balanceOf() < credits) return fail(402, 'insufficient_credits', 'Créditos insuficientes.')
  if (state.generations.filter((item) => item.status === 'running').length >= Number(plan.max_concurrent)) {
    return fail(429, 'too_many_running', 'Você chegou ao limite de gerações ao mesmo tempo do seu plano. Espere uma terminar.')
  }

  const generation: Row = {
    id: uuid(),
    user_id: DEMO_USER_ID,
    model_slug: model.slug,
    kind: model.kind,
    prompt: String(body.prompt ?? ''),
    persona_id: body.personaId ?? null,
    source_generation_id: body.sourceGenerationId ?? null,
    credits,
    status: 'running',
    output_path: null,
    output_type: null,
    error: null,
    idempotency_key: key,
    created_at: new Date().toISOString(),
    completed_at: null,
  }
  state.generations.unshift(generation)
  const fromSubscription = Math.min(state.subscriptionBalance, credits)
  addLedger(-fromSubscription, -(credits - fromSubscription), 'generation', String(model.name))
  persist()
  return json({ generation }, 201)
}

function buyCredits(body: Row): Response {
  const pack = state.packs.find((item) => item.slug === body.pack)
  if (!pack) return fail(404, 'pack_not_found', 'Pacote não encontrado.')
  // No demo o "pagamento" confirma na hora e volta para a tela de créditos.
  const purchase = { id: uuid(), user_id: DEMO_USER_ID, status: 'paid', credits: pack.credits, price_cents: pack.price_cents, paid_at: new Date().toISOString() }
  state.purchases.push(purchase)
  addLedger(0, Number(pack.credits), 'purchase', 'Compra de créditos (demo)')
  persist()
  return json({ url: `${window.location.origin}/creditos?compra=${purchase.id}` }, 201)
}

/** No demo a assinatura confirma na hora: mesmo efeito do webhook do Asaas no ar. */
function subscribe(body: Row): Response {
  const plan = state.plans.find((item) => item.slug === body.plan && item.public)
  if (!plan) return fail(404, 'plan_not_found', 'Plano não encontrado.')
  const live = state.subscriptions.find((item) => item.status === 'active' || item.status === 'past_due')
  if (live?.plan_slug === plan.slug) return fail(409, 'already_subscribed', 'Você já está nesse plano.')

  state.subscriptions.forEach((item) => {
    if (item.status !== 'expired') item.status = 'expired'
  })
  const now = new Date()
  const end = new Date(now)
  end.setMonth(end.getMonth() + 1)
  const subscription = {
    id: uuid(),
    user_id: DEMO_USER_ID,
    plan_slug: plan.slug,
    status: 'active',
    price_cents: plan.price_cents,
    monthly_credits: plan.monthly_credits,
    current_period_start: now.toISOString(),
    current_period_end: end.toISOString(),
    canceled_at: null,
    created_at: now.toISOString(),
  }
  state.subscriptions.unshift(subscription)
  state.subscriptionPayments.unshift({
    id: uuid(),
    subscription_id: subscription.id,
    user_id: DEMO_USER_ID,
    amount_cents: plan.price_cents,
    status: 'confirmed',
    invoice_url: null,
    paid_at: now.toISOString(),
  })
  if (state.subscriptionBalance > 0) addLedger(-state.subscriptionBalance, 0, 'subscription_expire', 'Créditos do ciclo anterior')
  addLedger(Number(plan.monthly_credits), 0, 'subscription_grant', 'Créditos do plano')
  persist()
  return json({ url: `${window.location.origin}/assinatura?assinatura=${subscription.id}` }, 201)
}

function cancelSubscription(): Response {
  const live = state.subscriptions.find((item) => item.status === 'active' || item.status === 'past_due')
  if (!live) return fail(404, 'no_subscription', 'Você não tem assinatura ativa.')
  live.status = 'canceled'
  live.canceled_at = new Date().toISOString()
  persist()
  return json({ currentPeriodEnd: live.current_period_end })
}

function account(body: Row): Response {
  if (body.action === 'delete') return fail(403, 'demo', 'No modo demo a conta não é excluída.')
  return json({
    exported_at: new Date().toISOString(),
    account: { id: DEMO_USER_ID, email: 'demo@kria.ia' },
    profiles: [state.profile],
    user_preferences: [state.preferences],
    credit_balances: [wallet()],
    credit_ledger: state.ledger,
    personas: state.personas,
    generations: state.generations,
    purchases: state.purchases,
    subscriptions: state.subscriptions,
    subscription_payments: state.subscriptionPayments,
  })
}

function createPersona(body: Row): Response {
  const source = state.generations.find((item) => item.id === body.p_generation_id && item.status === 'succeeded')
  if (!source || source.kind !== 'image') return json({ message: 'source_not_found' }, 400)
  const persona = {
    id: uuid(),
    user_id: DEMO_USER_ID,
    name: String(body.p_name ?? ''),
    description: String(body.p_description ?? ''),
    image_path: source.output_path,
    created_at: new Date().toISOString(),
  }
  state.personas.unshift(persona)
  persist()
  return json(persona)
}

function demoUserRow(): Row {
  const live = state.subscriptions.find((item) => item.status !== 'expired' && item.status !== 'pending')
  return {
    id: DEMO_USER_ID,
    email: 'demo@kria.ia',
    display_name: state.profile.display_name,
    username: state.profile.username,
    ...wallet(),
    plan_slug: live?.plan_slug ?? null,
    subscription_status: live?.status ?? null,
    suspended_at: null,
    created_at: state.profile.created_at,
    generations: state.generations.length,
  }
}

function adminOverview(): Row {
  const users = [demoUserRow(), ...state.otherUsers]
  const live = users.filter((user) => user.subscription_status === 'active' || user.subscription_status === 'past_due')
  const priceOf = (slug: unknown) => Number(state.plans.find((plan) => plan.slug === slug)?.price_cents ?? 0)
  const failed = state.generations.filter((item) => item.status === 'failed').length
  const byModel = state.models.map((model) => {
    const rows = state.generations.filter((item) => item.model_slug === model.slug)
    return {
      model_slug: model.slug,
      provider: model.provider,
      total: rows.length,
      failed: rows.filter((item) => item.status === 'failed').length,
      credits: rows.filter((item) => item.status === 'succeeded').reduce((sum, item) => sum + Number(item.credits), 0),
      cost_usd: 0,
    }
  })
  return {
    total_users: users.length,
    new_users_30d: users.length,
    active_subscribers: live.length,
    past_due: live.filter((user) => user.subscription_status === 'past_due').length,
    mrr_cents: live.reduce((sum, user) => sum + priceOf(user.plan_slug), 0),
    new_subscriptions_30d: live.length,
    cancellations_30d: state.subscriptions.filter((item) => item.canceled_at).length,
    subscription_revenue_30d_cents: state.subscriptionPayments.reduce((sum, item) => sum + Number(item.amount_cents), 0) + 14990 + 5990,
    pack_revenue_30d_cents: state.purchases.reduce((sum, item) => sum + Number(item.price_cents ?? 0), 0),
    generations_30d: state.generations.length,
    generations_failed_30d: failed,
    credits_consumed_30d: state.generations.filter((item) => item.status === 'succeeded').reduce((sum, item) => sum + Number(item.credits), 0),
    api_cost_usd_30d: 0,
    api_cost_unknown_30d: state.generations.filter((item) => item.status === 'succeeded').length,
    pricing: state.pricing,
    revenue_by_plan: state.plans
      .filter((plan) => plan.public)
      .map((plan) => {
        const subscribers = live.filter((user) => user.plan_slug === plan.slug).length
        return { slug: plan.slug, name: plan.name, position: plan.position, subscribers, mrr_cents: subscribers * Number(plan.price_cents) }
      }),
    by_model: byModel.filter((row) => row.total > 0),
  }
}

function rpc(name: string, body: Row): Response {
  switch (name) {
    case 'create_persona':
      return createPersona(body)
    case 'is_admin':
      return json(true)
    case 'admin_overview':
      return json(adminOverview())
    case 'admin_search_users': {
      const term = String(body.p_query ?? '').toLowerCase()
      const users = [demoUserRow(), ...state.otherUsers]
      return json(users.filter((user) => [user.email, user.username, user.display_name].some((field) => String(field ?? '').toLowerCase().includes(term))))
    }
    case 'admin_user_detail':
      return json({
        ledger: body.p_user_id === DEMO_USER_ID ? state.ledger.slice(0, 40) : [],
        generations: body.p_user_id === DEMO_USER_ID ? state.generations.slice(0, 30).map((item) => ({ ...item, provider_cost_usd: null })) : [],
        subscriptions: body.p_user_id === DEMO_USER_ID ? state.subscriptions : [],
        payments:
          body.p_user_id === DEMO_USER_ID
            ? state.subscriptionPayments.map((item) => ({ type: 'subscription', amount_cents: item.amount_cents, status: item.status, at: item.paid_at }))
            : [],
      })
    case 'admin_adjust_credits': {
      const amount = Number(body.p_amount)
      const reason = String(body.p_reason ?? '').trim()
      if (reason.length < 5) return rpcFail('reason_required')
      if (body.p_user_id === DEMO_USER_ID) {
        if (state.purchasedBalance + amount < 0) return rpcFail('insufficient_credits')
        addLedger(0, amount, 'adjustment', reason)
      } else {
        const user = state.otherUsers.find((item) => item.id === body.p_user_id)
        if (!user) return rpcFail('account_not_found')
        if (Number(user.purchased_balance) + amount < 0) return rpcFail('insufficient_credits')
        user.purchased_balance = Number(user.purchased_balance) + amount
        user.balance = Number(user.balance) + amount
      }
      audit('credits.adjust', null, reason, String(body.p_user_id))
      persist()
      return json(body.p_user_id === DEMO_USER_ID ? balanceOf() : state.otherUsers.find((item) => item.id === body.p_user_id)?.balance)
    }
    case 'admin_set_suspended': {
      const reason = String(body.p_reason ?? '').trim()
      if (reason.length < 5) return rpcFail('reason_required')
      if (body.p_user_id === DEMO_USER_ID) return rpcFail('cannot_suspend_self')
      const user = state.otherUsers.find((item) => item.id === body.p_user_id)
      if (!user) return rpcFail('account_not_found')
      user.suspended_at = body.p_suspended ? new Date().toISOString() : null
      audit(body.p_suspended ? 'user.suspend' : 'user.unsuspend', null, reason, String(user.id))
      persist()
      return json(true)
    }
    case 'admin_plans':
      return json(state.plans)
    case 'admin_update_plan': {
      const plan = state.plans.find((item) => item.slug === body.p_slug)
      if (!plan) return rpcFail('plan_not_found')
      const changedPrice = plan.price_cents !== body.p_price_cents || plan.monthly_credits !== body.p_monthly_credits
      Object.assign(plan, {
        price_cents: body.p_price_cents,
        monthly_credits: body.p_monthly_credits,
        max_concurrent: body.p_max_concurrent,
        active: body.p_active,
        version: Number(plan.version) + (changedPrice ? 1 : 0),
      })
      audit('plan.update', String(plan.slug), null)
      persist()
      return json(plan)
    }
    case 'admin_models':
      return json(state.models)
    case 'admin_update_model': {
      const model = state.models.find((item) => item.slug === body.p_slug)
      if (!model) return rpcFail('model_not_found')
      const plans = body.p_allowed_plans as string[] | null
      Object.assign(model, {
        active: body.p_active,
        credits: body.p_credits,
        provider_cost_usd: body.p_provider_cost_usd,
        allowed_plans: plans && plans.length > 0 ? plans : null,
      })
      audit('model.update', String(model.slug), null)
      persist()
      return json(model)
    }
    case 'admin_update_pricing':
      state.pricing = {
        usd_brl: body.p_usd_brl,
        fx_buffer: body.p_fx_buffer,
        markup: body.p_markup,
        credit_value_brl: body.p_credit_value_brl,
      }
      audit('pricing.update', null, null)
      persist()
      return json(state.pricing)
    default:
      return rpcFail('not_found')
  }
}

async function readBody(init?: RequestInit): Promise<Row> {
  if (typeof init?.body !== 'string') return {}
  try {
    return JSON.parse(init.body) as Row
  } catch {
    return {}
  }
}

export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input))
  const method = (init?.method ?? 'GET').toUpperCase()
  const route = url.pathname.replace(/^.*?\/(rest|functions|storage|auth)\/v1\//, '$1/')
  await new Promise((resolve) => setTimeout(resolve, 120))

  if (route.startsWith('functions/')) {
    const body = await readBody(init)
    const name = route.slice('functions/'.length)
    if (name === 'generate') return generate(body)
    if (name === 'generation-status') {
      settleOpenGenerations()
      return json({ outcomes: [] })
    }
    if (name === 'buy-credits') return buyCredits(body)
    if (name === 'subscribe') return subscribe(body)
    if (name === 'cancel-subscription') return cancelSubscription()
    if (name === 'account') return account(body)
    return fail(404, 'not_found', 'Função desconhecida.')
  }

  if (route.startsWith('rest/rpc/')) return rpc(route.slice('rest/rpc/'.length), await readBody(init))

  if (route.startsWith('rest/')) {
    const table = route.slice('rest/'.length)
    if (method === 'DELETE' && table === 'personas') {
      const id = url.searchParams.get('id')?.replace('eq.', '')
      state.personas = state.personas.filter((persona) => persona.id !== id)
      persist()
      return new Response(null, { status: 204 })
    }
    if (method === 'PATCH' && table === 'profiles') {
      state.profile = { ...state.profile, ...(await readBody(init)) }
      persist()
    }
    if ((method === 'POST' || method === 'PATCH') && table === 'user_preferences') {
      const { user_id: _ignored, ...changes } = await readBody(init)
      state.preferences = { ...state.preferences, ...changes }
      persist()
    }
    const result = query(TABLES[table]?.() ?? [], url.searchParams)
    const headers = new Headers(init?.headers)
    // select(..., { count: 'exact', head: true }) chega como HEAD e lê o total no content-range.
    if (method === 'HEAD') {
      return new Response(null, { status: 200, headers: { 'content-range': `*/${result.length}` } })
    }
    const accept = headers.get('accept') ?? ''
    return json(accept.includes('vnd.pgrst.object') ? (result[0] ?? null) : result)
  }

  if (route.startsWith('storage/object/sign/media/')) {
    // A URL assinada é montada como `<supabase>/storage/v1` + signedURL; os `..`
    // sobem até a raiz do site, onde as mídias do demo ficam (public/demo).
    const path = route.slice('storage/object/sign/media/'.length)
    return json({ signedURL: `/../../../${path}` })
  }

  if (route.startsWith('auth/')) return json({ id: DEMO_USER_ID, email: 'demo@kria.ia' })
  return fail(404, 'not_found', 'Rota desconhecida no demo.')
}
