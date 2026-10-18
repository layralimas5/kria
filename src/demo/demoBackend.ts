// Backend falso do modo demo: responde no lugar do Supabase (REST, RPC,
// Storage e Edge Functions) pelo `fetch` do cliente. Só é carregado com
// VITE_DEMO=true; nada disso entra na conversa com o servidor de verdade.

import { DEMO_PLANS } from './demoPlans'
import { createDemoState, DEMO_IMAGES, DEMO_USER_ID, DEMO_VIDEO, nextLedgerId, uuid, type DemoState, type Row } from './demoData'

// O estado sobrevive ao recarregar a aba (sessionStorage); fechar a aba recomeça o demo.
const SESSION_KEY = 'kria-demo-state'

function loadState(): DemoState {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY)
    // Mescla com o estado novo: campos criados depois (ex.: perfil) não faltam em sessões antigas.
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

const TABLES: Record<string, () => Row[]> = {
  models: () => state.models,
  credit_packs: () => state.packs,
  personas: () => state.personas,
  generations: () => state.generations,
  credit_ledger: () => state.ledger,
  purchases: () => state.purchases,
  credit_balances: () => [{ user_id: DEMO_USER_ID, balance: state.balance }],
  profiles: () => [state.profile],
  subscription_plans: () => DEMO_PLANS,
  subscriptions: () => [],
}

function addLedger(delta: number, reason: string, note: string) {
  state.ledger.unshift({ id: nextLedgerId(), user_id: DEMO_USER_ID, delta, reason, note, created_at: new Date().toISOString() })
}

/** Aplica os filtros `col=eq.valor`, `order` e `limit` do PostgREST que o app usa. */
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

function generate(body: Row): Response {
  const model = state.models.find((item) => item.slug === body.model)
  if (!model) return fail(400, 'model_unavailable', 'Esse modelo não está disponível.')
  const credits = Number(model.credits)
  if (state.balance < credits) return fail(402, 'insufficient_credits', 'Créditos insuficientes.')
  if (state.generations.filter((item) => item.status === 'running').length >= 3) {
    return fail(429, 'too_many_running', 'Você já tem 3 gerações em andamento. Espere uma terminar.')
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
    created_at: new Date().toISOString(),
    completed_at: null,
  }
  state.generations.unshift(generation)
  state.balance -= credits
  addLedger(-credits, 'generation', String(model.name))
  persist()
  return json({ generation }, 201)
}

function buyCredits(body: Row): Response {
  const pack = state.packs.find((item) => item.slug === body.pack)
  if (!pack) return fail(404, 'pack_not_found', 'Pacote não encontrado.')
  // No demo o "pagamento" confirma na hora e volta para a tela de créditos.
  const purchase = { id: uuid(), user_id: DEMO_USER_ID, status: 'paid', credits: pack.credits }
  state.purchases.push(purchase)
  state.balance += Number(pack.credits)
  addLedger(Number(pack.credits), 'purchase', 'Compra de créditos (demo)')
  persist()
  return json({ url: `${window.location.origin}/creditos?compra=${purchase.id}` }, 201)
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
    if (name === 'subscribe' || name === 'cancel-subscription') {
      return fail(503, 'demo_no_payment', 'No modo demo não existe pagamento de verdade. Assinaturas só funcionam com o Supabase e o Asaas configurados.')
    }
    return fail(404, 'not_found', 'Função desconhecida.')
  }

  if (route === 'rest/rpc/create_persona') return createPersona(await readBody(init))

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
