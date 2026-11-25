/** App instalável e notificações no aparelho (docs/app-e-notificacoes.md). Só regra, sem navegador. */

export type PushTopic = 'generations' | 'sales'

export type Platform = 'ios' | 'android' | 'desktop'

export interface DeviceInfo {
  readonly platform: Platform
  /** Aberto pelo ícone da tela de início (app instalado), não por uma aba do navegador. */
  readonly standalone: boolean
  /** O navegador tem service worker, PushManager e Notification. */
  readonly pushApi: boolean
  readonly permission: NotificationPermission | 'unavailable'
}

/**
 * - unsupported: o navegador não faz push (ex.: iPhone antes do iOS 16.4, navegador embutido do Instagram)
 * - needs-install: iPhone e iPad só recebem notificação com o app na tela de início
 * - not-configured: falta a chave pública VAPID no build
 * - denied: a pessoa bloqueou nas permissões do navegador
 * - ready: dá para ligar
 */
export type PushAvailability = 'unsupported' | 'needs-install' | 'not-configured' | 'denied' | 'ready'

export function detectPlatform(userAgent: string, maxTouchPoints: number): Platform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  // iPadOS se apresenta como Mac; a tela de toque denuncia.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  return 'desktop'
}

export function pushAvailability(device: DeviceInfo, hasVapidKey: boolean): PushAvailability {
  if (device.platform === 'ios' && !device.standalone) return 'needs-install'
  if (!device.pushApi) return 'unsupported'
  if (!hasVapidKey) return 'not-configured'
  if (device.permission === 'denied') return 'denied'
  return 'ready'
}

/** Nome do aparelho na lista, sem versão nem nada que identifique a pessoa. */
export function deviceLabel(userAgent: string, platform: Platform): string {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /SamsungBrowser/.test(userAgent)
      ? 'Samsung Internet'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Navegador'
  if (platform === 'ios') return /iPad|Macintosh/.test(userAgent) ? 'iPad' : 'iPhone'
  if (platform === 'android') return `Android · ${browser}`
  const system = /Windows/.test(userAgent) ? 'Windows' : /Mac OS X|Macintosh/.test(userAgent) ? 'Mac' : /Linux/.test(userAgent) ? 'Linux' : 'Computador'
  return `${system} · ${browser}`
}

/** Liga ou desliga um tópico mantendo os outros do aparelho, em ordem estável. */
export function toggleTopic(current: readonly PushTopic[], topic: PushTopic, on: boolean): PushTopic[] {
  const next = new Set(current)
  if (on) next.add(topic)
  else next.delete(topic)
  return [...next].sort()
}
