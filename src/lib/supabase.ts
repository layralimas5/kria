import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Modo demo (`npm run dev:demo`): backend falso no navegador, sessão já aberta. */
export const isDemo = import.meta.env.VITE_DEMO === 'true'
export const isConfigured = isDemo || Boolean(url && anonKey)

const DEMO_STORAGE_KEY = 'kria-demo-auth'

function demoSession(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24
  const segment = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '')
  return {
    access_token: `${segment({ alg: 'none', typ: 'JWT' })}.${segment({ sub: userId, role: 'authenticated', exp: expiresAt })}.demo`,
    refresh_token: 'demo',
    token_type: 'bearer',
    expires_in: 60 * 60 * 24,
    expires_at: expiresAt,
    user: { id: userId, email: 'demo@kria.ia', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  }
}

async function createDemoClient() {
  const [{ demoFetch }, { DEMO_USER_ID }] = await Promise.all([import('@/demo/demoBackend'), import('@/demo/demoData')])
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoSession(DEMO_USER_ID)))
  return createClient(`${window.location.origin}/demo-api`, 'demo-anon-key', {
    auth: { persistSession: true, autoRefreshToken: false, storageKey: DEMO_STORAGE_KEY },
    global: { fetch: demoFetch },
  })
}

// Sem .env.local o app ainda abre (mostra o aviso de configuração), sem quebrar no import.
export const supabase = isDemo
  ? await createDemoClient()
  : createClient(url || 'http://localhost:54321', anonKey || 'missing-anon-key', {
      auth: { persistSession: true, autoRefreshToken: true },
    })
