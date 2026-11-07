import type { Generation } from './types'

/** Avisos do sino: saem das gerações reais da pessoa, sem tabela própria. */
export type NotificationTone = 'done' | 'failed' | 'running'

export interface AppNotification {
  readonly id: string
  readonly tone: NotificationTone
  readonly title: string
  readonly text: string
  /** Quando aconteceu (fim da geração, ou início se ainda está rodando). */
  readonly at: string
  readonly to: string
}

export const NOTIFICATION_WINDOW_DAYS = 7
export const MAX_NOTIFICATIONS = 12
const PROMPT_PREVIEW = 70

function preview(prompt: string): string {
  const clean = prompt.trim().replace(/\s+/g, ' ')
  return clean.length > PROMPT_PREVIEW ? `${clean.slice(0, PROMPT_PREVIEW - 1).trimEnd()}…` : clean
}

function toNotification(generation: Generation): AppNotification {
  const isVideo = generation.kind === 'video'
  const mode = isVideo ? 'video' : 'imagem'
  if (generation.status === 'succeeded') {
    return {
      id: generation.id,
      tone: 'done',
      title: isVideo ? 'Vídeo pronto' : 'Imagem pronta',
      text: preview(generation.prompt),
      at: generation.completed_at ?? generation.created_at,
      to: '/galeria',
    }
  }
  if (generation.status === 'failed') {
    return {
      id: generation.id,
      tone: 'failed',
      title: isVideo ? 'O vídeo não saiu' : 'A imagem não saiu',
      text: `${generation.credits} créditos devolvidos. Tente de novo no Studio.`,
      at: generation.completed_at ?? generation.created_at,
      to: `/estudio?modo=${mode}`,
    }
  }
  return {
    id: generation.id,
    tone: 'running',
    title: isVideo ? 'Gerando vídeo' : 'Gerando imagem',
    text: preview(generation.prompt),
    at: generation.created_at,
    to: `/estudio?modo=${mode}`,
  }
}

export function buildNotifications(generations: readonly Generation[], now: Date): AppNotification[] {
  const since = now.getTime() - NOTIFICATION_WINDOW_DAYS * 86_400_000
  return generations
    .map(toNotification)
    .filter((item) => new Date(item.at).getTime() >= since)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, MAX_NOTIFICATIONS)
}

/** O que terminou depois da última vez que a pessoa abriu o sino. Geração rodando não conta. */
export function unreadCount(notifications: readonly AppNotification[], seenAt: string | null): number {
  return notifications.filter((item) => item.tone !== 'running' && (seenAt === null || item.at > seenAt)).length
}

export function badgeLabel(count: number): string {
  return count > 9 ? '9+' : String(count)
}

export function relativeTime(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'ontem' : `há ${days} dias`
}
