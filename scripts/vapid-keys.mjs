// Gera o par de chaves VAPID das notificações (docs/app-e-notificacoes.md). Rodar uma vez só:
// trocar a chave desliga todos os aparelhos já inscritos.
//   node scripts/vapid-keys.mjs
import { webcrypto as crypto } from 'node:crypto'

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url')
const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey)

console.log('# Segredos das functions (npx supabase secrets set ...):')
console.log(`VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${d}`)
console.log('VAPID_SUBJECT=mailto:suporte@vynkio-ia.com.br')
console.log('\n# Front (Netlify e .env.local):')
console.log(`VITE_VAPID_PUBLIC_KEY=${publicKey}`)
