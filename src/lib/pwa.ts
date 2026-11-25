// Service worker e convite de instalação do app (docs/app-e-notificacoes.md).
import { detectPlatform, type DeviceInfo } from '@/domain/appDevice'

/** Evento do Chrome/Edge/Android que permite abrir o "Instalar app" pelo nosso botão. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

/** Registra o service worker e começa a escutar o convite de instalação. Chamado uma vez no main.tsx. */
export function startPwa(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
  if (!('serviceWorker' in navigator)) return
  const register = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
      console.error('service worker não registrou', error)
    })
  }
  // Depois do carregamento, para não disputar banda com a primeira tela.
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null
}

/** Abre o diálogo de instalação do navegador. `true` se a pessoa instalou. */
export async function promptInstall(): Promise<boolean> {
  const prompt = deferredPrompt
  if (!prompt) return false
  await prompt.prompt()
  const { outcome } = await prompt.userChoice
  deferredPrompt = null
  notify()
  return outcome === 'accepted'
}

export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

export function readDevice(): DeviceInfo {
  const pushApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  return {
    platform: detectPlatform(navigator.userAgent, navigator.maxTouchPoints),
    standalone: isStandalone(),
    pushApi,
    permission: 'Notification' in window ? Notification.permission : 'unavailable',
  }
}
