// Service worker do Vynkio (docs/app-e-notificacoes.md). Faz duas coisas: deixa o site instalável como
// app e mostra as notificações que o servidor manda (Web Push). Não guarda páginas em cache: o app
// sempre carrega a versão mais nova publicada.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Sem cache, mas com o handler: alguns navegadores ainda pedem um para oferecer a instalação.
self.addEventListener('fetch', () => {})

function parse(event) {
  try {
    const data = event.data ? event.data.json() : null
    if (data && typeof data.title === 'string') return data
  } catch {
    // corpo inválido cai no aviso genérico
  }
  return { title: 'Vynkio', body: 'Você tem uma novidade no Vynkio.', url: '/inicio', tag: 'vynkio', topic: 'test' }
}

async function appIsOnScreen() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  return windows.some((client) => client.visibilityState === 'visible')
}

self.addEventListener('push', (event) => {
  const message = parse(event)
  event.waitUntil(
    (async () => {
      // Geração pronta com o app aberto na tela: o sino e a galeria já mostram.
      if (message.topic === 'generations' && (await appIsOnScreen())) return
      await self.registration.showNotification(message.title, {
        body: message.body,
        tag: message.tag,
        renotify: message.topic === 'sales',
        icon: '/app/icon-192.png',
        badge: '/app/badge-96.png',
        lang: 'pt-BR',
        data: { url: message.url },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url ?? '/inicio', self.location.origin)
  if (target.origin !== self.location.origin) return
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((client) => new URL(client.url).origin === target.origin)
      if (open) {
        await open.focus()
        if ('navigate' in open) await open.navigate(target.href)
        return
      }
      await self.clients.openWindow(target.href)
    })(),
  )
})
