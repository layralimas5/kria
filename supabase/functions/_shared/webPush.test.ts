import { describe, expect, it } from 'vitest'
import {
  base64UrlDecode,
  base64UrlEncode,
  buildPushRequest,
  encryptPayload,
  importPrivateKey,
  isGone,
  vapidAuthorization,
  type VapidKeys,
} from './webPush'

// Exemplo do apêndice A da RFC 8291.
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  serverPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  serverPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  userPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  userPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
}

const target = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: RFC.userPublic, auth: RFC.auth }

async function vapidPair(): Promise<VapidKeys> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  return { publicKey: base64UrlEncode(raw), privateKey: jwk.d ?? '', subject: 'mailto:suporte@vynkio-ia.com.br' }
}

describe('encryptPayload', () => {
  it('reproduz o exemplo da RFC 8291 byte a byte', async () => {
    const serverKeys = {
      privateKey: await importPrivateKey(RFC.serverPrivate, RFC.serverPublic, 'deriveBits'),
      publicKey: base64UrlDecode(RFC.serverPublic),
    }
    const body = await encryptPayload(new TextEncoder().encode(RFC.plaintext), target, {
      salt: base64UrlDecode(RFC.salt),
      serverKeys,
    })
    expect(base64UrlEncode(body)).toBe(RFC.body)
  })

  it('usa sal e chave novos a cada envio', async () => {
    const payload = new TextEncoder().encode('{"title":"Venda"}')
    const [a, b] = await Promise.all([encryptPayload(payload, target), encryptPayload(payload, target)])
    expect(base64UrlEncode(a)).not.toBe(base64UrlEncode(b))
    expect(a.length).toBe(16 + 4 + 1 + 65 + payload.length + 1 + 16)
  })

  it('recusa conteúdo grande demais para um registro', async () => {
    await expect(encryptPayload(new Uint8Array(5000), target)).rejects.toThrow('grande demais')
  })
})

describe('vapidAuthorization', () => {
  it('assina um JWT ES256 válido para a origem do endpoint', async () => {
    const vapid = await vapidPair()
    const header = await vapidAuthorization(target.endpoint, vapid, Date.UTC(2026, 10, 25))
    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)
    expect(match).not.toBeNull()
    const [, head, claims, signature, k] = match as unknown as [string, string, string, string, string]
    expect(k).toBe(vapid.publicKey)
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(claims))) as Record<string, unknown>
    expect(decoded).toEqual({ aud: 'https://fcm.googleapis.com', exp: Date.UTC(2026, 10, 25) / 1000 + 43_200, sub: vapid.subject })

    const publicKey = await crypto.subtle.importKey('raw', base64UrlDecode(vapid.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      base64UrlDecode(signature),
      new TextEncoder().encode(`${head}.${claims}`),
    )
    expect(valid).toBe(true)
  })
})

describe('buildPushRequest', () => {
  it('monta o POST com os cabeçalhos do protocolo', async () => {
    const request = await buildPushRequest(target, { title: 'Oi' }, await vapidPair(), { ttlSeconds: 3600, urgency: 'high' })
    expect(request.url).toBe(target.endpoint)
    expect(request.init.headers).toMatchObject({ 'Content-Encoding': 'aes128gcm', TTL: '3600', Urgency: 'high' })
    expect(request.init.headers.Authorization).toMatch(/^vapid t=/)
  })
})

it('isGone: 404 e 410 apagam a inscrição', () => {
  expect([404, 410, 201, 429, 500].map(isGone)).toEqual([true, true, false, false, false])
})
