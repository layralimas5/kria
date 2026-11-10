import { brtDay, daysAgo } from './timeline'
import type { Generation, Subscription } from './types'

// Contas da tela Início: atividade recente, ritmo dos últimos dias, ciclo do plano e primeiros passos.

const DAY_MS = 86_400_000
/** "agora", "há 5 min", "há 2 h", "ontem", "há 3 dias" ou a data, para quem lê de relance. */
export function relativeTime(iso: string, now: Date): string {
  const diff = now.getTime() - new Date(iso).getTime()
  if (diff < 60_000) return 'agora'
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)} min`
  const days = daysAgo(iso, now)
  if (days === 0) return `há ${Math.floor(diff / 3_600_000)} h`
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

/** Criações concluídas por dia nos últimos `days` dias, do mais antigo para hoje. */
type GenerationFacts = Pick<Generation, 'id' | 'kind' | 'status' | 'credits' | 'model_slug' | 'created_at' | 'completed_at'>

export function dailyCounts(generations: readonly Pick<Generation, 'status' | 'created_at' | 'completed_at'>[], now: Date, days = 14): number[] {
  const today = Date.parse(`${brtDay(now)}T00:00:00Z`)
  const counts = Array.from({ length: days }, () => 0)
  for (const generation of generations) {
    if (generation.status !== 'succeeded') continue
    const day = Date.parse(`${brtDay(new Date(generation.completed_at ?? generation.created_at))}T00:00:00Z`)
    const index = days - 1 - Math.round((today - day) / DAY_MS)
    if (index >= 0 && index < days) counts[index] = (counts[index] ?? 0) + 1
  }
  return counts
}

export interface Cycle {
  /** Dias inteiros até a renovação (ou o fim, se cancelado). */
  readonly daysLeft: number
  /** Parte do período já usada, de 0 a 1. */
  readonly elapsed: number
}

/** Onde a pessoa está no período pago; nulo sem assinatura com datas. */
export function cycleOf(subscription: Pick<Subscription, 'current_period_start' | 'current_period_end'> | null, now: Date): Cycle | null {
  if (!subscription?.current_period_start || !subscription.current_period_end) return null
  const start = Date.parse(subscription.current_period_start)
  const end = Date.parse(subscription.current_period_end)
  if (!(end > start)) return null
  const elapsed = Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)))
  return { daysLeft: Math.max(0, Math.ceil((end - now.getTime()) / DAY_MS)), elapsed }
}

/** Quantas vezes o saldo paga a criação mais barata; nulo sem preço de referência. */
export function creditsYield(balance: number, cheapestCredits: number | null): number | null {
  if (!cheapestCredits || cheapestCredits <= 0) return null
  return Math.floor(balance / cheapestCredits)
}

export interface Step {
  readonly id: 'image' | 'persona' | 'video' | 'plan'
  readonly title: string
  readonly description: string
  readonly to: string
  readonly done: boolean
}

interface StepFacts {
  readonly generations: readonly Generation[]
  readonly personas: number
  readonly videoAllowed: boolean
  readonly paying: boolean
}

/** Primeiros passos do Vynkio, marcados pelo que a conta já fez. */
export function nextSteps({ generations, personas, videoAllowed, paying }: StepFacts): Step[] {
  const made = (kind: Generation['kind']) => generations.some((generation) => generation.kind === kind && generation.status === 'succeeded')
  const steps: Step[] = [
    { id: 'image', title: 'Gere sua primeira imagem', description: 'Descreva a cena e receba uma foto realista.', to: '/estudio?modo=imagem', done: made('image') },
    { id: 'persona', title: 'Salve um personagem', description: 'O mesmo rosto em todas as fotos e vídeos.', to: '/personas', done: personas > 0 },
  ]
  if (videoAllowed) {
    steps.push({ id: 'video', title: 'Transforme uma foto em vídeo', description: 'Movimento e som a partir de uma imagem sua.', to: '/estudio?modo=video', done: made('video') })
  }
  steps.push({ id: 'plan', title: 'Escolha um plano', description: 'Créditos todo mês e suporte direto.', to: '/assinatura', done: paying })
  return steps
}

export interface ActivityItem {
  readonly id: string
  readonly tone: 'done' | 'running' | 'failed'
  readonly title: string
  readonly detail: string
  readonly at: string
}

const KIND_LABELS: Readonly<Record<string, { readonly name: string; readonly ready: string }>> = {
  image: { name: 'Imagem', ready: 'pronta' },
  video: { name: 'Vídeo', ready: 'pronto' },
  text: { name: 'Texto', ready: 'pronto' },
}

/** Linha do tempo das últimas gerações, com o que está rodando, o que ficou pronto e o que falhou. */
export function activityFeed(generations: readonly GenerationFacts[], modelName: (slug: string) => string, limit = 6): ActivityItem[] {
  return generations.slice(0, limit).map((generation) => {
    const { name: kind, ready } = KIND_LABELS[generation.kind] ?? { name: 'Criação', ready: 'pronta' }
    const model = modelName(generation.model_slug)
    if (generation.status === 'failed') {
      return { id: generation.id, tone: 'failed', title: `${kind} não saiu`, detail: `${model} · ${generation.credits} créditos devolvidos`, at: generation.created_at }
    }
    if (generation.status === 'succeeded') {
      return { id: generation.id, tone: 'done', title: `${kind} ${ready}`, detail: `${model} · ${generation.credits} créditos`, at: generation.completed_at ?? generation.created_at }
    }
    return { id: generation.id, tone: 'running', title: `${kind} em produção`, detail: model, at: generation.created_at }
  })
}
