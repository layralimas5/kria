// Catálogo de planos embutido: os mesmos valores do seed (0003) com os preços e benefícios da 0005.
// Usado quando o app roda sem Supabase (prévia local, modo demo) para a seção
// de planos aparecer. Com Supabase configurado, os planos vêm sempre do banco.
// `planCatalog.test.ts` falha se este arquivo e o seed se separarem.

import type { SubscriptionPlan } from './plans'

const feature = (label: string, soon = false) => ({ label, soon })

export const PLAN_CATALOG: SubscriptionPlan[] = [
  {
    slug: 'starter',
    name: 'krIA Starter',
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
      feature('Até 60 fotos ou 7 vídeos com Kling por mês'),
      feature('Até 2 personagens salvos'),
      feature('Fotos com IA e com seus personagens'),
      feature('Vídeo com Kling 3.0'),
      feature('3 gerações ao mesmo tempo'),
      feature('Histórico e download das criações'),
      feature('Copys e roteiros', true),
      feature('Biblioteca de prompts', true),
    ],
    comparison: { credits: '300 por mês', personas: 'Até 2', concurrent: '3', images: 'yes', kling: 'yes', veo: 'no', history: 'yes', copy: 'soon', prompts: 'soon', motion_control: 'no', ugc: 'no', projects: 'no' },
  },
  {
    slug: 'pro',
    name: 'krIA Pro',
    tagline: 'Crie mais, experimente mais e produza conteúdos incríveis.',
    price_cents: 7990,
    monthly_credits: 450,
    max_personas: 5,
    cta_label: 'Quero ser Pro',
    badge: 'Mais popular',
    highlight: true,
    position: 20,
    features: [
      feature('450 créditos por mês'),
      feature('Até 90 fotos, 11 vídeos com Kling ou 2 com Veo por mês'),
      feature('Até 5 personagens salvos'),
      feature('Tudo do Starter'),
      feature('Vídeo com fala e som (Veo 3.1)'),
      feature('4 gerações ao mesmo tempo'),
      feature('Motion Control', true),
      feature('Estúdio UGC', true),
    ],
    comparison: { credits: '450 por mês', personas: 'Até 5', concurrent: '4', images: 'yes', kling: 'yes', veo: 'yes', history: 'yes', copy: 'soon', prompts: 'soon', motion_control: 'soon', ugc: 'soon', projects: 'no' },
  },
  {
    slug: 'studio',
    name: 'krIA Studio',
    tagline: 'Para creators, marcas e profissionais que querem produzir em escala.',
    price_cents: 14990,
    monthly_credits: 1000,
    max_personas: 15,
    cta_label: 'Escolher Studio',
    badge: null,
    highlight: false,
    position: 30,
    features: [
      feature('1.000 créditos por mês'),
      feature('Até 200 fotos, 25 vídeos com Kling ou 5 com Veo por mês'),
      feature('Até 15 personagens salvos'),
      feature('Tudo do Pro'),
      feature('6 gerações ao mesmo tempo'),
      feature('Meus projetos', true),
    ],
    comparison: { credits: '1.000 por mês', personas: 'Até 15', concurrent: '6', images: 'yes', kling: 'yes', veo: 'yes', history: 'yes', copy: 'soon', prompts: 'soon', motion_control: 'soon', ugc: 'soon', projects: 'soon' },
  },
]
