import type { MarketingPlan } from './catalog'
import { WELCOME_CREDITS } from '../content'

// O Grátis não é assinatura: é a conta nova com os créditos de boas-vindas.
// Na vitrine ele vem primeiro; no app é o plano `gratis` (0006_pricing_v2), sem checkout.
export const FREE_PLAN: MarketingPlan = {
  slug: 'gratis',
  name: 'Vynkio Grátis',
  tagline: 'Teste com seus personagens antes de assinar.',
  price_cents: 0,
  monthly_credits: WELCOME_CREDITS,
  max_personas: 1,
  cta_label: 'Criar conta grátis',
  badge: null,
  highlight: false,
  position: 0,
  features: [
    { label: `${WELCOME_CREDITS} créditos de boas-vindas`, soon: false },
    { label: 'Até 4 fotos para testar', soon: false },
    { label: '1 personagem salvo', soon: false },
    { label: 'Fotos com IA e com seu personagem', soon: false },
    { label: 'Vídeo com Kling 3.0 comprando um pacote', soon: false },
    { label: 'Pacotes avulsos com Pix', soon: false },
    { label: 'Copys e roteiros', soon: true },
  ],
  comparison: {
    credits: `${WELCOME_CREDITS} de boas-vindas`,
    personas: '1',
    concurrent: '2',
    images: 'yes',
    kling: 'Com pacote',
    veo: 'no',
    history: 'yes',
    copy: 'soon',
    prompts: 'soon',
    motion_control: 'no',
    ugc: 'no',
    projects: 'no',
    support: 'no',
    community: 'no',
  },
}

export function isFreePlan(plan: Pick<MarketingPlan, 'price_cents'>): boolean {
  return plan.price_cents === 0
}
