// Eventos de conversão no formato do GA4. Sem VITE_GA_MEASUREMENT_ID nada sai do
// navegador: `track` só registra no console em desenvolvimento.

type AnalyticsEvent =
  | { name: 'landing_view' }
  | { name: 'cta_click'; params: { cta_id: string; destination: string } }
  | { name: 'sign_up'; params: { method: 'email' } }
  | { name: 'login'; params: { method: 'email' } }
  | { name: 'begin_checkout'; params: { plan: string } }
  | { name: 'purchase'; params: { plan: string; value: number; currency: 'BRL'; transaction_id: string } }

type Gtag = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
  }
}

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID

let loaded = false

/** Carrega o gtag.js uma vez. Chamado no primeiro evento, fora do caminho crítico da página. */
function ensureGtag(id: string): Gtag {
  if (loaded && window.gtag) return window.gtag
  window.dataLayer = window.dataLayer ?? []
  // O gtag.js só processa objetos `arguments`; um array com rest params é ignorado.
  window.gtag = function gtag() {
    window.dataLayer?.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', id)
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  document.head.appendChild(script)
  loaded = true
  return window.gtag
}

export function track(event: AnalyticsEvent): void {
  const params = 'params' in event ? event.params : {}
  if (!MEASUREMENT_ID) {
    if (import.meta.env.DEV) console.debug('[analytics]', event.name, params)
    return
  }
  ensureGtag(MEASUREMENT_ID)('event', event.name, params)
}
