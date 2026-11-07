// Backend falso do modo demo: responde no lugar do Supabase (REST, RPC,
// Storage e Edge Functions) pelo `fetch` do cliente. Só é carregado com
// VITE_DEMO=true; nada disso entra na conversa com o servidor de verdade.
// Imita as regras do banco (baldes da carteira, plano, idempotência) só o
// suficiente para as telas se comportarem como no ar.

import { assistantToolSchema } from '@/domain/types'
import { ADMIN_ROLE_LABELS, adminRoleSchema } from '@/domain/adminDashboard'
import { buildDemoDashboard } from './demoAdmin'
import { demoAssistantOutput } from './demoAssistant'
import { createDemoState, DEMO_USER_ID, nextLedgerId, uuid, type DemoState, type Row } from './demoData'
import { DEMO_VIDEO, demoImageAt, demoMediaType } from './demoMedia'
import { demoMultiplierOutput } from './demoMultiplier'
import { demoFinance, exportUsage, financeSettings, isRefusal, modelQuotes, settleExport, startExport } from './demoFinance'
import { demoRefusal, demoSpendGuard, demoUsage } from './demoSpend'

// O estado sobrevive ao recarregar a aba (sessionStorage); fechar a aba recomeça o demo.
const SESSION_KEY = 'kria-demo-state-v11'

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
  brands: () => state.brands,
  projects: () => state.projects,
  content_items: () => state.contents,
  analytics_imports: () => state.analyticsImports,
  analytics_snapshots: () => state.analyticsSnapshots,
  admin_audit_logs: () => state.audit,
  generations: () => state.generations,
  formats: () => state.formats,
  uploads: () => state.uploads,
  multiplier_projects: () => state.multiplierProjects,
  multiplier_variations: () => state.multiplierVariations,
  credit_ledger: () => state.ledger,
  purchases: () => state.purchases,
  credit_balances: () => [wallet()],
  profiles: () => [state.profile],
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
    const outputPath = isVideo ? DEMO_VIDEO : demoImageAt(index)
    generation.output_path = outputPath
    generation.output_type = demoMediaType(outputPath)
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

/** Com formato, o modelo vem da etapa e o "prompt" do demo é o nome do formato com as escolhas. */
function resolveFormat(body: Row): { model: string; prompt: string } | Response {
  const request = body.format as { slug?: string; step?: string; fields?: Record<string, string>; note?: string }
  const format = state.formats.find((item) => item.slug === request.slug)
  if (!format) return fail(400, 'format_unavailable', 'Esse formato não está disponível.')
  if (!state.uploads.some((item) => item.id === body.uploadId)) return fail(400, 'upload_not_found', 'A foto não chegou ao servidor. Envie de novo.')
  const wantsEnd = format.flow === 'before_after' && request.step === 'final'
  if (wantsEnd !== Boolean(body.endGenerationId)) return fail(400, 'invalid_body', 'Gere a foto do depois primeiro.')
  const fields = format.fields as { key: string; choices: { value: string; label: string }[] }[]
  const labels = fields.map((field) => field.choices.find((choice) => choice.value === request.fields?.[field.key])?.label ?? field.choices[0]?.label)
  const step = request.step === 'edit' ? 'foto do depois' : String(format.name)
  return {
    model: String(request.step === 'edit' ? format.edit_model_slug : format.model_slug),
    prompt: [step, ...labels, request.note].filter(Boolean).join(' · '),
  }
}

function generate(body: Row): Response {
  const key = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : null
  const repeated = key ? state.generations.find((item) => item.idempotency_key === key) : undefined
  if (repeated) return json({ generation: repeated })

  const resolved = body.format ? resolveFormat(body) : { model: String(body.model), prompt: String(body.prompt ?? '') }
  if (resolved instanceof Response) return resolved
  const model = state.models.find((item) => item.slug === resolved.model && item.active !== false)
  if (!model) return fail(400, 'model_unavailable', 'Esse modelo não está disponível.')
  const plan = currentPlan()
  const allowed = model.allowed_plans as string[] | null
  if (allowed && !allowed.includes(String(plan.slug))) {
    return fail(403, 'plan_required', 'Esse modelo faz parte de um plano pago. Veja os planos em Assinatura.')
  }
  // Mesma regra da function: opção fora de `models.options` não passa.
  const requested = (body.options ?? {}) as Record<string, string>
  const accepted = (model.options ?? {}) as Record<string, string[]>
  if (Object.entries(requested).some(([key, value]) => !accepted[key]?.includes(value))) {
    return fail(400, 'invalid_option', 'Valor de opção não aceito por esse modelo.')
  }
  const credits = Number(model.credits)
  if (balanceOf() < credits) return fail(402, 'insufficient_credits', 'Créditos insuficientes.')
  if (state.generations.filter((item) => item.status === 'running').length >= Number(plan.max_concurrent)) {
    return fail(429, 'too_many_running', 'Você chegou ao limite de gerações ao mesmo tempo do seu plano. Espere uma terminar.')
  }
  const refusal = demoRefusal(state, plan, credits)
  if (refusal) return fail(refusal.status, refusal.code, refusal.message)

  const generation: Row = {
    id: uuid(),
    user_id: DEMO_USER_ID,
    model_slug: model.slug,
    kind: model.kind,
    prompt: resolved.prompt,
    persona_id: body.personaId ?? null,
    source_generation_id: body.sourceGenerationId ?? null,
    upload_id: body.uploadId ?? null,
    end_generation_id: body.endGenerationId ?? null,
    format_slug: (body.format as Row | undefined)?.slug ?? null,
    from_upload: Boolean(body.uploadId),
    brand_id: body.brandId ?? null,
    project_id: body.projectId ?? null,
    options: requested,
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
  if (!source || source.kind !== 'image') return rpcFail('source_not_found')
  if (source.from_upload) return rpcFail('upload_derived')
  if (state.personas.length >= Number(currentPlan().max_personas)) return rpcFail('too_many_personas')
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



/** No demo o texto sai na hora, de um modelo pronto; cobra e entra no extrato como no ar. */
async function assistant(body: Row): Promise<Response> {
  const key = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : null
  const repeated = key ? state.generations.find((item) => item.idempotency_key === key) : undefined
  if (repeated) return json({ generation: repeated })

  const tool = assistantToolSchema.safeParse(body.tool)
  const model = tool.success ? state.models.find((item) => item.slug === tool.data) : undefined
  if (!tool.success || !model) return fail(400, 'invalid_body', 'Pedido inválido.')
  const allowed = model.allowed_plans as string[] | null
  if (allowed && !allowed.includes(String(currentPlan().slug))) {
    return fail(403, 'plan_required', 'Essa ferramenta faz parte de um plano pago. Veja os planos em Assinatura.')
  }
  const credits = Number(model.credits)
  if (balanceOf() < credits) return fail(402, 'insufficient_credits', 'Créditos insuficientes.')
  const refusal = demoRefusal(state, currentPlan(), credits)
  if (refusal) return fail(refusal.status, refusal.code, refusal.message)

  // Um respiro para a tela mostrar o "escrevendo".
  await new Promise((resolve) => setTimeout(resolve, 1500))
  const brand = state.brands.find((item) => item.id === body.brandId)
  const brief = String(body.brief ?? '')
  const generation: Row = {
    id: uuid(),
    user_id: DEMO_USER_ID,
    model_slug: tool.data,
    kind: 'text',
    prompt: brief,
    persona_id: null,
    source_generation_id: null,
    brand_id: brand?.id ?? null,
    project_id: body.projectId ?? null,
    credits,
    status: 'succeeded',
    output_path: null,
    output_type: 'application/json',
    output_text: JSON.stringify(demoAssistantOutput(tool.data, brief, brand ? String(brand.name) : null)),
    error: null,
    idempotency_key: key,
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  }
  state.generations.unshift(generation)
  const fromSubscription = Math.min(state.subscriptionBalance, credits)
  addLedger(-fromSubscription, -(credits - fromSubscription), 'generation', String(model.name))
  persist()
  return json({ generation }, 201)
}

type OwnedTable = 'brands' | 'projects' | 'content_items'

const WORKSPACE_FIELDS: Record<OwnedTable, readonly string[]> = {
  brands: ['name', 'description', 'niche', 'audience', 'tone', 'offer', 'goals', 'platforms', 'communication', 'avoid', 'visual_style', 'references_notes'],
  projects: ['name', 'goal', 'brand_id', 'status'],
  content_items: ['title', 'channel', 'format', 'status', 'planned_for', 'brand_id', 'project_id', 'script', 'copy', 'notes', 'source_generation_id', 'asset_ids'],
}

const OWNED_ROWS: Record<OwnedTable, () => Row[]> = {
  brands: () => state.brands,
  projects: () => state.projects,
  content_items: () => state.contents,
}

function replaceOwnedRows(table: OwnedTable, rows: Row[]) {
  if (table === 'brands') state.brands = rows
  else if (table === 'projects') state.projects = rows
  else state.contents = rows
}

/** Publicado ganha a data na hora; voltar o status apaga. Espelha `enforce_content_rules` (0012). */
function stampPublished(row: Row) {
  if (row.status === 'published' && !row.published_at) row.published_at = new Date().toISOString()
  if (row.status !== 'published') row.published_at = null
}

function pick(body: Row, fields: readonly string[]): Row {
  return Object.fromEntries(fields.filter((field) => field in body).map((field) => [field, body[field]]))
}

/** Insere, edita e apaga marcas, projetos e conteúdos com as mesmas travas do banco (0009, 0012). */
function workspaceWrite(table: OwnedTable, method: string, url: URL, body: Row): Response {
  const rows = OWNED_ROWS[table]()
  const id = url.searchParams.get('id')?.replace('eq.', '')
  const plan = currentPlan()

  if (method === 'DELETE') {
    replaceOwnedRows(table, rows.filter((row) => row.id !== id))
    if (table === 'brands' && state.preferences.active_brand_id === id) state.preferences = { ...state.preferences, active_brand_id: null }
    persist()
    return new Response(null, { status: 204 })
  }
  if (method === 'POST') {
    if (table === 'brands' && rows.length >= Number(plan.max_brands)) return rpcFail('too_many_brands')
    if (table === 'projects' && !(plan.tools as string[]).includes('projects')) return rpcFail('plan_required')
    const now = new Date().toISOString()
    const row: Row = { id: uuid(), user_id: DEMO_USER_ID, ...pick(body, WORKSPACE_FIELDS[table]), created_at: now, updated_at: now }
    if (table === 'content_items') stampPublished(row)
    rows.unshift(row)
    persist()
    return json(row, 201)
  }
  const row = rows.find((item) => item.id === id)
  if (!row) return json({ message: 'not_found', code: 'PGRST116' }, 406)
  Object.assign(row, pick(body, WORKSPACE_FIELDS[table]), { updated_at: new Date().toISOString() })
  if (table === 'content_items') stampPublished(row)
  persist()
  return json(row)
}

// ------------------------------------------------------------- multiplicador

const MULTIPLIER_PROJECT_FIELDS = ['brand_id', 'name', 'product_name', 'product_description', 'audience', 'platform', 'objective', 'aspect', 'transcript', 'takes', 'rights_confirmed']

/** Projetos e variações com as travas da 0017: variação nasce só pela function; editar marca como editada. */
function multiplierWrite(table: 'multiplier_projects' | 'multiplier_variations', method: string, url: URL, body: Row): Response {
  const id = url.searchParams.get('id')?.replace('eq.', '')
  const now = new Date().toISOString()
  if (table === 'multiplier_projects') {
    if (method === 'DELETE') {
      state.multiplierProjects = state.multiplierProjects.filter((row) => row.id !== id)
      state.multiplierVariations = state.multiplierVariations.filter((row) => row.project_id !== id)
      persist()
      return new Response(null, { status: 204 })
    }
    if (Array.isArray(body.takes) && body.takes.length > 12) return rpcFail('invalid_takes')
    if (method === 'POST') {
      const row: Row = { id: uuid(), user_id: DEMO_USER_ID, analysis: null, ...pick(body, MULTIPLIER_PROJECT_FIELDS), created_at: now, updated_at: now }
      state.multiplierProjects.unshift(row)
      persist()
      return json(row, 201)
    }
    const row = state.multiplierProjects.find((item) => item.id === id)
    if (!row) return json({ message: 'not_found', code: 'PGRST116' }, 406)
    Object.assign(row, pick(body, MULTIPLIER_PROJECT_FIELDS), { updated_at: now })
    persist()
    return json(row)
  }
  if (method === 'POST') return json({ message: 'permission denied for table multiplier_variations', code: '42501' }, 403)
  if (method === 'DELETE') {
    state.multiplierVariations = state.multiplierVariations.filter((row) => row.id !== id)
    persist()
    return new Response(null, { status: 204 })
  }
  const row = state.multiplierVariations.find((item) => item.id === id)
  if (!row) return json({ message: 'not_found', code: 'PGRST116' }, 406)
  if ('script' in body) Object.assign(row, { script: body.script, edited: true })
  if ('render_status' in body) Object.assign(row, { render_status: body.render_status, rendered_at: body.render_status === 'rendered' ? now : null })
  row.updated_at = now
  persist()
  return json(row)
}

/** Mesmo contrato da function `multiplier`: plano, saldo, guarda de gasto e lote gravado de uma vez. */
async function multiplier(body: Row): Promise<Response> {
  const project = state.multiplierProjects.find((item) => item.id === body.projectId)
  if (!project) return fail(404, 'project_not_found', 'Projeto não encontrado.')
  const count = Number(body.count)
  const plan = currentPlan()
  if (!project.rights_confirmed) return fail(400, 'rights_not_confirmed', 'Confirme que você tem direito de uso sobre os arquivos antes de gerar.')
  if (!Array.isArray(project.takes) || project.takes.length === 0) return fail(400, 'takes_required', 'Adicione pelo menos um vídeo ou foto ao projeto.')
  if (!Number.isInteger(count) || count < 1) return fail(400, 'invalid_count', 'Escolha quantas variações quer gerar.')
  if (count > Number(plan.max_variations)) return fail(403, 'too_many_variations', 'Seu plano gera menos variações por lote. Veja os planos em Assinatura.')
  const model = state.models.find((item) => item.slug === 'multiplicador')
  if (!model) return fail(400, 'model_unavailable', 'Esse modelo não está disponível.')
  const credits = Number(model.credits)
  if (balanceOf() < credits) return fail(402, 'insufficient_credits', 'Créditos insuficientes.')
  const refusal = demoRefusal(state, plan, credits)
  if (refusal) return fail(refusal.status, refusal.code, refusal.message)

  await new Promise((resolve) => setTimeout(resolve, 1800))
  const output = demoMultiplierOutput(project, count)
  const now = new Date().toISOString()
  const generationId = uuid()
  state.generations.unshift({
    id: generationId,
    user_id: DEMO_USER_ID,
    model_slug: 'multiplicador',
    kind: 'text',
    prompt: `Multiplicador: ${count} variações`,
    credits,
    status: 'succeeded',
    output_type: 'application/json',
    output_text: JSON.stringify({ project_id: project.id, variations: output.variations.length }),
    output_path: null,
    error: null,
    created_at: now,
    completed_at: now,
  })
  output.variations.forEach((script, index) => {
    state.multiplierVariations.unshift({
      id: uuid(),
      project_id: project.id,
      user_id: DEMO_USER_ID,
      generation_id: generationId,
      position: index + 1,
      script,
      edited: false,
      render_status: 'pending',
      rendered_at: null,
      created_at: now,
      updated_at: now,
    })
  })
  project.analysis = output.analysis
  project.updated_at = now
  const fromSubscription = Math.min(state.subscriptionBalance, credits)
  addLedger(-fromSubscription, -(credits - fromSubscription), 'generation', 'Multiplicador')
  persist()
  return json({ generation: { id: generationId, status: 'succeeded' }, variations: output.variations.length }, 201)
}

// ---------------------------------------------------- painel de operação (admin)

function audit(action: string, target: string | null, reason: string | null, targetUserId: string | null = null) {
  state.audit.unshift({
    id: state.audit.length + 1,
    action,
    entity: action.split('.')[0],
    result: 'success',
    admin_id: DEMO_USER_ID,
    target,
    reason,
    target_user_id: targetUserId,
    details: {},
    created_at: new Date().toISOString(),
  })
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

const SUPER_ADMIN_PERMISSIONS = [
  'dashboard.view', 'finance.view', 'users.view', 'users.manage', 'credits.adjust', 'plans.view', 'plans.manage',
  'models.view', 'models.manage', 'pricing.manage', 'audit.view', 'admins.manage',
]

function setRole(body: Row): Response {
  const role = adminRoleSchema.safeParse(body.p_role)
  const reason = String(body.p_reason ?? '').trim()
  if (!role.success) return rpcFail('invalid_role')
  if (reason.length < 5) return rpcFail('reason_required')
  const email = String(body.p_email ?? '').trim().toLowerCase()
  const user = [demoUserRow(), ...state.otherUsers].find((item) => String(item.email).toLowerCase() === email)
  if (!user) return rpcFail('user_not_found')
  if (user.id === DEMO_USER_ID) return rpcFail('cannot_change_self')
  const existing = state.admins.find((item) => item.user_id === user.id)
  const now = new Date().toISOString()
  if (existing) Object.assign(existing, { role: role.data, updated_at: now })
  else state.admins.push({ user_id: user.id, email: user.email, display_name: user.display_name, role: role.data, created_at: now, updated_at: now, granted_by_email: 'demo@kria.ia' })
  audit(existing ? 'admin.role_change' : 'admin.grant', ADMIN_ROLE_LABELS[role.data], reason, String(user.id))
  persist()
  return json({ user_id: user.id, role: role.data })
}

/** As funções `admin_*` do banco (0004 e 0014), com as mesmas recusas. No demo a conta é super admin com segundo fator. */
function adminRpc(name: string, body: Row): Response | null {
  switch (name) {
    case 'is_admin':
      return json(true)
    case 'admin_me':
      return json({ role: 'super_admin', permissions: SUPER_ADMIN_PERMISSIONS, aal: 'aal2' })
    case 'admin_dashboard': {
      const from = new Date(String(body.p_from))
      const to = new Date(String(body.p_to))
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) return rpcFail('invalid_period')
      return json(buildDemoDashboard(state, [demoUserRow(), ...state.otherUsers], from, to))
    }
    case 'admin_pricing':
      return json({ ...state.pricing, payment_fee_rate: 0.035 })
    case 'admin_list_admins':
      return json(state.admins)
    case 'admin_set_role':
      return setRole(body)
    case 'admin_remove_admin': {
      if (String(body.p_reason ?? '').trim().length < 5) return rpcFail('reason_required')
      if (body.p_user_id === DEMO_USER_ID) return rpcFail('cannot_change_self')
      const index = state.admins.findIndex((item) => item.user_id === body.p_user_id)
      if (index < 0) return rpcFail('user_not_found')
      state.admins.splice(index, 1)
      audit('admin.revoke', null, String(body.p_reason).trim(), String(body.p_user_id))
      persist()
      return json(true)
    }
    case 'admin_search_users': {
      const term = String(body.p_query ?? '').toLowerCase()
      const users = [demoUserRow(), ...state.otherUsers]
      return json(users.filter((user) => [user.email, user.username, user.display_name].some((field) => String(field ?? '').toLowerCase().includes(term))))
    }
    case 'admin_user_detail': {
      const self = body.p_user_id === DEMO_USER_ID
      return json({
        ledger: self ? state.ledger.slice(0, 40) : [],
        generations: self ? state.generations.slice(0, 30).map((item) => ({ ...item, provider_cost_usd: null })) : [],
        subscriptions: self ? state.subscriptions : [],
        payments: self ? state.subscriptionPayments.map((item) => ({ type: 'subscription', amount_cents: item.amount_cents, status: item.status, at: item.paid_at })) : [],
      })
    }
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
    case 'admin_update_plan_limits': {
      const plan = state.plans.find((item) => item.slug === body.p_slug)
      if (!plan) return rpcFail('plan_not_found')
      const daily = body.p_daily as number | null
      const monthly = body.p_monthly as number | null
      if ((daily !== null && daily <= 0) || (monthly !== null && monthly <= 0)) return rpcFail('invalid_amount')
      if (daily !== null && monthly !== null && daily > monthly) return rpcFail('invalid_cap_order')
      Object.assign(plan, { daily_credit_limit: daily, monthly_credit_limit: monthly })
      audit('plan.limits', String(plan.slug), null)
      persist()
      return json(plan)
    }
    case 'admin_spend_guard':
      return json(demoSpendGuard(state))
    case 'admin_update_spend_guard': {
      const reason = String(body.p_reason ?? '').trim()
      const daily = body.p_daily_cap_usd as number | null
      const monthly = body.p_monthly_cap_usd as number | null
      if (body.p_paused && reason.length < 5) return rpcFail('reason_required')
      if (daily !== null && monthly !== null && daily > monthly) return rpcFail('invalid_cap_order')
      Object.assign(state.pricing, {
        daily_cost_cap_usd: daily,
        monthly_cost_cap_usd: monthly,
        cost_alert_ratio: body.p_alert_ratio,
        generation_paused: body.p_paused,
        paused_reason: body.p_paused ? reason : null,
      })
      audit('spend_guard.update', null, reason || null)
      persist()
      return json(demoSpendGuard(state))
    }
    case 'admin_models':
      return json(state.models)
    case 'admin_update_model': {
      const model = state.models.find((item) => item.slug === body.p_slug)
      if (!model) return rpcFail('model_not_found')
      const plans = body.p_allowed_plans as string[] | null
      const costChanged = body.p_provider_cost_usd !== null && body.p_provider_cost_usd !== model.provider_cost_usd
      Object.assign(model, {
        active: body.p_active,
        credits: body.p_credits,
        provider_cost_usd: body.p_provider_cost_usd,
        cost_checked_at: costChanged ? new Date().toISOString() : (model.cost_checked_at ?? null),
        allowed_plans: plans && plans.length > 0 ? plans : null,
      })
      audit('model.update', String(model.slug), null)
      persist()
      return json(model)
    }
    case 'admin_finance': {
      const from = new Date(String(body.p_from))
      const to = new Date(String(body.p_to))
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) return rpcFail('invalid_period')
      return json(demoFinance(state, [demoUserRow(), ...state.otherUsers], from, to))
    }
    case 'admin_finance_settings':
      return json(financeSettings(state))
    case 'admin_update_finance_settings':
      state.finance = {
        tax_rate: body.p_tax_rate,
        fixed_costs_cents: body.p_fixed_costs_cents,
        infra_costs_cents: body.p_infra_costs_cents,
        storage_costs_cents: body.p_storage_costs_cents,
        render_cost_cents_per_export: body.p_render_cost_cents_per_export,
        pro_labore_cents: body.p_pro_labore_cents,
        reserve_rate: body.p_reserve_rate,
        min_margin_rate: body.p_min_margin_rate,
      }
      audit('finance.settings', null, null)
      persist()
      return json(financeSettings(state))
    case 'admin_model_quotes':
      return json(modelQuotes(state))
    case 'admin_update_credit_policy':
      state.pricing = {
        ...state.pricing,
        safety_factor: body.p_safety_factor,
        credit_budget_brl: body.p_credit_budget_brl,
        legacy_cost_per_credit_brl: body.p_legacy_cost_per_credit_brl,
        cost_stale_days: body.p_cost_stale_days,
      }
      audit('pricing.credit_policy', null, null)
      persist()
      return json(state.pricing)
    case 'admin_confirm_model_cost': {
      const model = state.models.find((item) => item.slug === body.p_slug)
      if (!model) return rpcFail('model_not_found')
      if (String(body.p_source ?? '').trim().length < 5) return rpcFail('source_required')
      if (model.provider_cost_usd === null || model.provider_cost_usd === undefined) return rpcFail('cost_required')
      Object.assign(model, { cost_checked_at: new Date().toISOString(), cost_source: String(body.p_source).trim() })
      audit('model.cost_confirm', String(model.slug), null)
      persist()
      return json(model)
    }
    case 'admin_activate_pricing_v2':
      // A virada mexe em saldos e assinaturas reais: no demo ela só mostra a recusa de segurança.
      return rpcFail(state.pricing.generation_paused ? 'open_generations' : 'pause_required')
    case 'admin_update_pricing':
      state.pricing = { ...state.pricing, usd_brl: body.p_usd_brl, fx_buffer: body.p_fx_buffer, markup: body.p_markup, credit_value_brl: body.p_credit_value_brl }
      audit('pricing.update', null, null)
      persist()
      return json(state.pricing)
    default:
      return null
  }
}

/** Mesmo contrato da função do banco (0013): tudo ou nada, com origem e período. */
function importAnalytics(body: Row): Response {
  const rows = Array.isArray(body.p_rows) ? (body.p_rows as Row[]) : []
  if (rows.length === 0 || rows.length > 5000) return rpcFail('invalid_rows')
  const dates = rows.map((row) => String(row.metric_date)).sort()
  const record = {
    id: uuid(),
    user_id: DEMO_USER_ID,
    brand_id: body.p_brand_id ?? null,
    platform: body.p_platform,
    source: 'manual_csv',
    file_name: String(body.p_file_name ?? 'arquivo.csv').slice(0, 200),
    row_count: rows.length,
    period_start: dates[0],
    period_end: dates.at(-1),
    created_at: new Date().toISOString(),
  }
  state.analyticsImports.unshift(record)
  state.analyticsSnapshots.push(...rows.map((row) => ({ ...row, import_id: record.id, platform: record.platform, brand_id: record.brand_id })))
  persist()
  return json(record.id)
}

/** A foto "subiu" no demo (o Storage falso não guarda nada); a tela mostra a prévia local. */
function registerUpload(body: Row): Response {
  if (!body.p_rights_confirmed) return rpcFail('rights_not_confirmed')
  const upload = { id: uuid(), user_id: DEMO_USER_ID, path: String(body.p_path), content_type: String(body.p_content_type), created_at: new Date().toISOString() }
  state.uploads.unshift(upload)
  persist()
  return json(upload)
}

function rpc(name: string, body: Row): Response {
  if (name === 'create_persona') return createPersona(body)
  if (name === 'register_upload') return registerUpload(body)
  if (name === 'import_analytics') return importAnalytics(body)
  if (name === 'my_usage') return json({ ...demoUsage(state, currentPlan()), ...exportUsage(state, currentPlan()) })
  if (name === 'start_multiplier_export') {
    const result = startExport(state, currentPlan(), body)
    if (isRefusal(result)) return rpcFail(result.code)
    persist()
    return json(result)
  }
  if (name === 'finish_multiplier_export' || name === 'fail_multiplier_export') {
    const ok = settleExport(state, body, name === 'finish_multiplier_export' ? 'done' : 'failed')
    persist()
    return json(ok)
  }
  const admin = adminRpc(name, body)
  if (admin) return admin
  return rpcFail('not_found')
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
    if (name === 'assistant') return assistant(body)
    if (name === 'multiplier') return multiplier(body)
    return fail(404, 'not_found', 'Função desconhecida.')
  }

  if (route.startsWith('rest/rpc/')) return rpc(route.slice('rest/rpc/'.length), await readBody(init))

  if (route.startsWith('rest/')) {
    const table = route.slice('rest/'.length)
    if ((table === 'multiplier_projects' || table === 'multiplier_variations') && method !== 'GET' && method !== 'HEAD') {
      return multiplierWrite(table, method, url, await readBody(init))
    }
    if ((table === 'brands' || table === 'projects' || table === 'content_items') && method !== 'GET' && method !== 'HEAD') {
      return workspaceWrite(table, method, url, await readBody(init))
    }
    if (method === 'DELETE' && table === 'analytics_imports') {
      const id = url.searchParams.get('id')?.replace('eq.', '')
      state.analyticsImports = state.analyticsImports.filter((item) => item.id !== id)
      state.analyticsSnapshots = state.analyticsSnapshots.filter((item) => item.import_id !== id)
      persist()
      return new Response(null, { status: 204 })
    }
    if (method === 'DELETE' && table === 'personas') {
      const id = url.searchParams.get('id')?.replace('eq.', '')
      state.personas = state.personas.filter((persona) => persona.id !== id)
      persist()
      return new Response(null, { status: 204 })
    }
    if (method === 'PATCH' && table === 'personas') {
      const id = url.searchParams.get('id')?.replace('eq.', '')
      const { brand_id: brandId } = await readBody(init)
      if (brandId && !state.brands.some((brand) => brand.id === brandId)) return rpcFail('brand_not_found')
      state.personas = state.personas.map((persona) => (persona.id === id ? { ...persona, brand_id: brandId ?? null } : persona))
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

  if (method === 'POST' && route.startsWith('storage/object/media/')) {
    const path = route.slice('storage/object/'.length)
    return json({ Key: path, Id: uuid() })
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
