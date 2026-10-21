// Dados de exemplo do modo demo. Tudo vive em memória e some ao recarregar.

export const DEMO_USER_ID = '00000000-0000-4000-8000-00000000d3e0'

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

export const DEMO_IMAGES = Array.from({ length: 8 }, (_, index) => `demo/img-${index + 1}.svg`)
export const DEMO_VIDEO = 'demo/video-1.webm'

export type Row = Record<string, unknown>

export interface DemoState {
  purchasedBalance: number
  subscriptionBalance: number
  profile: Row
  preferences: Row
  models: Row[]
  packs: Row[]
  plans: Row[]
  subscriptions: Row[]
  subscriptionPayments: Row[]
  personas: Row[]
  generations: Row[]
  ledger: Row[]
  purchases: Row[]
}

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60_000).toISOString()

let ledgerSequence = 100
export const nextLedgerId = () => (ledgerSequence += 1)

export function uuid(): string {
  return crypto.randomUUID()
}

function generation(index: number, overrides: Row): Row {
  return {
    id: uuid(),
    user_id: DEMO_USER_ID,
    model_slug: 'foto',
    kind: 'image',
    prompt: '',
    persona_id: null,
    source_generation_id: null,
    credits: 5,
    status: 'succeeded',
    output_path: DEMO_IMAGES[index % DEMO_IMAGES.length],
    output_type: 'image/svg+xml',
    error: null,
    created_at: minutesAgo(10 + index * 9),
    completed_at: minutesAgo(10 + index * 9),
    ...overrides,
  }
}

export function createDemoState(): DemoState {
  const luna = { id: uuid(), user_id: DEMO_USER_ID, name: 'Luna', description: 'Mulher de 27 anos, cabelo castanho ondulado, estilo casual', image_path: DEMO_IMAGES[0], created_at: minutesAgo(200) }
  const rafa = { id: uuid(), user_id: DEMO_USER_ID, name: 'Rafa', description: 'Homem de 32 anos, barba curta, estilo esportivo', image_path: DEMO_IMAGES[5], created_at: minutesAgo(260) }

  const proSubscription = {
    id: uuid(),
    user_id: DEMO_USER_ID,
    plan_slug: 'pro',
    status: 'active',
    price_cents: 7990,
    monthly_credits: 450,
    current_period_start: minutesAgo(60 * 24 * 12),
    current_period_end: daysFromNow(18),
    canceled_at: null,
    created_at: minutesAgo(60 * 24 * 12),
  }

  return {
    purchasedBalance: 265,
    subscriptionBalance: 230,
    preferences: { user_id: DEMO_USER_ID, goal: null, onboarded_at: null },
    plans: [
      { slug: 'gratis', name: 'Grátis', description: 'Teste com seus personagens antes de assinar.', price_cents: 0, monthly_credits: 0, max_concurrent: 2, max_personas: 1, tools: ['copy', 'prompt_library'], features: ['20 créditos de boas-vindas', '1 personagem salvo', 'Fotos com IA e com seu personagem', 'Vídeo com Kling 3.0 comprando um pacote', 'Pacotes avulsos com Pix'], public: false, highlight: false, active: true, position: 0, version: 1 },
      { slug: 'starter', name: 'Starter', description: 'Para começar a publicar toda semana.', price_cents: 5990, monthly_credits: 300, max_concurrent: 3, max_personas: 2, tools: ['copy', 'prompt_library'], features: ['300 créditos por mês', 'Até 2 personagens salvos', 'Fotos com IA e com seus personagens', 'Vídeo com Kling 3.0', 'Vídeo com fala e som (Veo 3.1)', '3 gerações ao mesmo tempo', 'Histórico e download das criações', 'Suporte por e-mail'], public: true, highlight: false, active: true, position: 10, version: 1 },
      { slug: 'pro', name: 'Pro', description: 'Para quem publica todo dia.', price_cents: 7990, monthly_credits: 450, max_concurrent: 4, max_personas: 5, tools: ['copy', 'prompt_library', 'motion_control', 'ugc_studio'], features: ['450 créditos por mês', 'Até 5 personagens salvos', 'Tudo do Starter', '4 gerações ao mesmo tempo', 'Suporte pelo WhatsApp', 'Acesso à comunidade'], public: true, highlight: true, active: true, position: 20, version: 1 },
      { slug: 'studio', name: 'Studio', description: 'Para operação de conteúdo e anúncios.', price_cents: 14990, monthly_credits: 1000, max_concurrent: 6, max_personas: 15, tools: ['copy', 'prompt_library', 'motion_control', 'ugc_studio', 'projects'], features: ['1.000 créditos por mês', 'Até 15 personagens salvos', 'Tudo do Pro', '6 gerações ao mesmo tempo', 'Suporte pelo WhatsApp', 'Acesso à comunidade'], public: true, highlight: false, active: true, position: 30, version: 1 },
    ],
    subscriptions: [proSubscription],
    subscriptionPayments: [
      { id: uuid(), subscription_id: proSubscription.id, user_id: DEMO_USER_ID, amount_cents: 7990, status: 'confirmed', invoice_url: null, paid_at: minutesAgo(60 * 24 * 12) },
    ],
    profile: {
      id: DEMO_USER_ID,
      display_name: 'Lay',
      username: 'lay.cria',
      bio: '',
      location: '',
      instagram: '',
      tiktok: '',
      youtube: '',
      avatar_path: null,
      created_at: minutesAgo(60 * 24 * 3),
    },
    models: [
      { slug: 'foto', name: 'Nano Banana 2', description: 'Foto realista a partir do texto.', kind: 'image', requires_image: false, credits: 5, position: 10, badge: null, defaults: { aspect_ratio: '4:5' }, allowed_plans: null, provider: 'fal', endpoint: 'fal-ai/nano-banana-2', provider_cost_usd: null, active: true },
      { slug: 'foto-persona', name: 'Nano Banana 2 Persona', description: 'A mesma pessoa em qualquer cenário.', kind: 'image', requires_image: true, credits: 6, position: 20, badge: 'TOP', defaults: { aspect_ratio: '4:5' }, allowed_plans: null, provider: 'fal', endpoint: 'fal-ai/nano-banana-2/edit', provider_cost_usd: null, active: true },
      { slug: 'video-kling', name: 'Kling 3.0', description: 'Anima uma imagem com movimento natural e áudio.', kind: 'video', requires_image: true, credits: 40, position: 30, badge: 'NOVO', defaults: { duration: '5', generate_audio: true }, allowed_plans: null, provider: 'fal', endpoint: 'fal-ai/kling-video/v3/standard/image-to-video', provider_cost_usd: null, active: true },
      { slug: 'video-veo', name: 'Veo 3.1', description: 'Vídeo com fala sincronizada e som ambiente.', kind: 'video', requires_image: true, credits: 200, position: 40, badge: 'TOP', defaults: { duration: '8s', aspect_ratio: '9:16', generate_audio: true }, allowed_plans: ['starter', 'pro', 'studio'], provider: 'fal', endpoint: 'fal-ai/veo3.1/image-to-video', provider_cost_usd: null, active: true },
    ],
    packs: [
      { slug: 'inicial', name: 'Inicial', credits: 100, price_cents: 1990, highlight: false, position: 10 },
      { slug: 'criador', name: 'Criador', credits: 300, price_cents: 4990, highlight: true, position: 20 },
      { slug: 'estudio', name: 'Estúdio', credits: 800, price_cents: 13990, highlight: false, position: 30 },
    ],
    personas: [luna, rafa],
    generations: [
      generation(0, { model_slug: 'video-kling', kind: 'video', credits: 40, persona_id: luna.id, output_path: DEMO_VIDEO, output_type: 'video/webm', prompt: 'Luna olha para a câmera, sorri e acena', created_at: minutesAgo(6), completed_at: minutesAgo(3) }),
      generation(1, { model_slug: 'foto-persona', credits: 6, persona_id: luna.id, prompt: 'Luna num café em São Paulo segurando um latte, luz da manhã' }),
      generation(2, { output_path: DEMO_IMAGES[5], prompt: 'Rafa correndo no parque ao amanhecer, roupa de treino' }),
      generation(3, { status: 'failed', output_path: null, output_type: null, error: 'Conteúdo bloqueado pelo filtro de segurança do modelo.', prompt: 'Retrato em estúdio com luz dura' }),
      generation(4, { model_slug: 'foto-persona', credits: 6, persona_id: luna.id, prompt: 'Luna mostrando um sérum de skincare para a câmera, banheiro claro' }),
      generation(5, { prompt: 'Mulher de 30 anos trabalhando no notebook num coworking' }),
      generation(6, { prompt: 'Homem de 40 anos cozinhando, cozinha rústica, foto de celular' }),
    ],
    ledger: [
      { id: 7, user_id: DEMO_USER_ID, delta: 450, reason: 'subscription_grant', note: 'Créditos do plano', balance_after: null, created_at: minutesAgo(60 * 24 * 12) },
      { id: 6, user_id: DEMO_USER_ID, delta: -40, reason: 'generation', note: 'Kling 3.0', balance_after: null, created_at: minutesAgo(6) },
      { id: 5, user_id: DEMO_USER_ID, delta: 5, reason: 'generation_refund', note: 'Estorno de geração que falhou', balance_after: null, created_at: minutesAgo(36) },
      { id: 4, user_id: DEMO_USER_ID, delta: -5, reason: 'generation', note: 'Nano Banana 2', balance_after: null, created_at: minutesAgo(37) },
      { id: 3, user_id: DEMO_USER_ID, delta: 300, reason: 'purchase', note: 'Compra de créditos', balance_after: null, created_at: minutesAgo(120) },
      { id: 2, user_id: DEMO_USER_ID, delta: -30, reason: 'generation', note: 'Fotos', balance_after: null, created_at: minutesAgo(150) },
      { id: 1, user_id: DEMO_USER_ID, delta: 20, reason: 'signup_bonus', note: 'Créditos de boas-vindas', balance_after: null, created_at: minutesAgo(1440) },
    ],
    purchases: [],
  }
}
