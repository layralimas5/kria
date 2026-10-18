// Planos do modo demo: mesma forma e valores do seed da migration 0003, só
// para a landing e a página de assinatura aparecerem sem Supabase. Em
// produção os planos vêm sempre do banco.

import type { Row } from './demoData'

const feature = (label: string, soon = false) => ({ label, soon })

export const DEMO_PLANS: Row[] = [
  {
    slug: 'starter',
    name: 'Kria Starter',
    tagline: 'Seu primeiro passo na criação com IA.',
    price_cents: 5990,
    monthly_credits: 300,
    max_personas: 2,
    cta_label: 'Começar com Starter',
    badge: null,
    highlight: false,
    position: 10,
    features: [
      feature('300 créditos por mês'),
      feature('Até 2 personagens de IA salvos'),
      feature('Geração de imagens com IA'),
      feature('Vídeos com IA nos modelos habilitados'),
      feature('Histórico de criações'),
      feature('Download do que ficou pronto'),
      feature('Legendas, roteiros e copys', true),
      feature('Biblioteca de prompts', true),
    ],
    comparison: { credits: '300 por mês', personas: 'Até 2', images: 'yes', videos: 'yes', motion_control: 'no', ugc: 'no', copy: 'soon', prompts: 'soon', premium_models: 'no', history: 'yes', priority: 'no', support: 'E-mail' },
  },
  {
    slug: 'pro',
    name: 'Kria Pro',
    tagline: 'Crie mais, experimente mais e produza conteúdos incríveis.',
    price_cents: 7990,
    monthly_credits: 700,
    max_personas: 5,
    cta_label: 'Quero ser Pro',
    badge: 'Mais popular',
    highlight: true,
    position: 20,
    features: [
      feature('700 créditos por mês'),
      feature('Até 5 personagens salvos'),
      feature('Tudo do Starter'),
      feature('Vídeo com fala e som (Veo 3.1)'),
      feature('Personagens como referência visual'),
      feature('Motion Control', true),
      feature('Recursos avançados de UGC', true),
      feature('Templates de vídeos virais', true),
      feature('Anúncios e roteiros comerciais', true),
      feature('Biblioteca de prompts premium', true),
    ],
    comparison: { credits: '700 por mês', personas: 'Até 5', images: 'yes', videos: 'yes', motion_control: 'soon', ugc: 'soon', copy: 'soon', prompts: 'soon', premium_models: 'no', history: 'yes', priority: 'no', support: 'E-mail' },
  },
  {
    slug: 'studio',
    name: 'Kria Studio',
    tagline: 'Para creators, marcas e profissionais que querem produzir em escala.',
    price_cents: 14990,
    monthly_credits: 1500,
    max_personas: 15,
    cta_label: 'Escolher Studio',
    badge: null,
    highlight: false,
    position: 30,
    features: [
      feature('1.500 créditos por mês'),
      feature('Até 15 personagens salvos'),
      feature('Tudo do Pro'),
      feature('Histórico completo e exportação'),
      feature('Modelos premium', true),
      feature('Projetos e campanhas organizados', true),
      feature('Processamento prioritário', true),
      feature('Biblioteca de anúncios UGC', true),
      feature('Templates profissionais', true),
      feature('Suporte prioritário', true),
    ],
    comparison: { credits: '1.500 por mês', personas: 'Até 15', images: 'yes', videos: 'yes', motion_control: 'soon', ugc: 'soon', copy: 'soon', prompts: 'soon', premium_models: 'soon', history: 'yes', priority: 'soon', support: 'soon' },
  },
]
