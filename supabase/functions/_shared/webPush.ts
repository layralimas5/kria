// Web Push sem biblioteca: só WebCrypto, roda igual no Deno (functions) e no Node (testes).
// Criptografia do conteúdo pela RFC 8291 (aes128gcm, RFC 8188) e identificação do servidor
// pela RFC 8292 (VAPID, JWT ES256).

export interface PushTarget {
  readonly endpoint: string
  /** Chave pública P-256 do navegador, base64url (65 bytes). */
  readonly p256dh: string
  /** Segredo de autenticação do navegador, base64url (16 bytes). */
  readonly auth: string
}

export interface VapidKeys {
  /** Chave pública P-256 sem compressão, base64url (65 bytes). Também vai para o front. */
  readonly publicKey: string
  /** Escalar privado `d`, base64url (32 bytes). Só no servidor. */
  readonly privateKey: string
  /** `mailto:` ou `https:` de contato, exigido pelos serviços de push. */
  readonly subject: string
}

export interface ServerKeys {
  readonly privateKey: CryptoKey
  readonly publicKey: Bytes
}

/** Bytes num ArrayBuffer comum, o que o WebCrypto aceita. */
export type Bytes = Uint8Array<ArrayBuffer>

const RECORD_SIZE = 4096
/** Um registro só: conteúdo + delimitador + tag do GCM cabem em 4096. */
export const MAX_PAYLOAD_BYTES = RECORD_SIZE - 16 - 1 - 100
const JWT_LIFETIME_SECONDS = 12 * 60 * 60

const encoder = new TextEncoder()

export function base64UrlEncode(bytes: Bytes): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlDecode(value: string): Bytes {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function concat(...parts: readonly Bytes[]): Bytes {
  const out = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function publicKeyJwk(publicKey: Bytes): JsonWebKey {
  if (publicKey.length !== 65 || publicKey[0] !== 4) throw new Error('chave pública P-256 inválida')
  return {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(publicKey.slice(1, 33)),
    y: base64UrlEncode(publicKey.slice(33, 65)),
  }
}

/** Chave privada P-256 a partir do `d` e da pública (WebCrypto não importa `d` cru). */
export function importPrivateKey(privateKey: string, publicKey: string, usage: 'sign' | 'deriveBits'): Promise<CryptoKey> {
  const jwk: JsonWebKey = { ...publicKeyJwk(base64UrlDecode(publicKey)), d: privateKey, ext: true }
  const algorithm = usage === 'sign' ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'ECDH', namedCurve: 'P-256' }
  return crypto.subtle.importKey('jwk', jwk, algorithm, false, [usage])
}

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, bytes: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8)
  return new Uint8Array(bits)
}

async function generateServerKeys(): Promise<ServerKeys> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  return { privateKey: pair.privateKey, publicKey: new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)) }
}

/**
 * Corpo cifrado (aes128gcm) para um navegador. `salt` e `serverKeys` só são passados pelos testes;
 * em produção nascem novos a cada envio.
 */
export async function encryptPayload(
  payload: Bytes,
  target: PushTarget,
  options: { salt?: Bytes; serverKeys?: ServerKeys } = {},
): Promise<Bytes> {
  if (payload.length > MAX_PAYLOAD_BYTES) throw new Error('notificação grande demais')
  const userPublic = base64UrlDecode(target.p256dh)
  const authSecret = base64UrlDecode(target.auth)
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const server = options.serverKeys ?? (await generateServerKeys())

  const userKey = await crypto.subtle.importKey('jwk', publicKeyJwk(userPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: userKey }, server.privateKey, 256))

  const keyInfo = concat(encoder.encode('WebPush: info\0'), userPublic, server.publicKey)
  const ikm = await hkdf(authSecret, shared, keyInfo, 32)
  const contentKey = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12)

  const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt'])
  // Registro único: conteúdo seguido do delimitador 0x02.
  const plain = concat(payload, new Uint8Array([2]))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plain))

  const header = new Uint8Array(16 + 4 + 1)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE)
  header[20] = server.publicKey.length
  return concat(header, server.publicKey, cipher)
}

/** Cabeçalho `Authorization` VAPID para o serviço de push do endpoint. */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, nowMs = Date.now()): Promise<string> {
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = base64UrlEncode(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(nowMs / 1000) + JWT_LIFETIME_SECONDS,
        sub: vapid.subject,
      }),
    ),
  )
  const unsigned = `${header}.${claims}`
  const key = await importPrivateKey(vapid.privateKey, vapid.publicKey, 'sign')
  // WebCrypto já devolve a assinatura no formato do JWT (r || s, 64 bytes).
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned)))
  return `vapid t=${unsigned}.${base64UrlEncode(signature)}, k=${vapid.publicKey}`
}

export interface PushOptions {
  /** Quanto tempo o serviço guarda a mensagem se o aparelho estiver desligado. */
  readonly ttlSeconds: number
  readonly urgency: 'normal' | 'high'
}

export interface PushRequest {
  readonly url: string
  readonly init: { method: 'POST'; headers: Record<string, string>; body: Bytes }
}

/** Monta o POST para o serviço de push (separado do envio para dar para testar sem rede). */
export async function buildPushRequest(target: PushTarget, payload: unknown, vapid: VapidKeys, options: PushOptions): Promise<PushRequest> {
  const body = await encryptPayload(encoder.encode(JSON.stringify(payload)), target)
  return {
    url: target.endpoint,
    init: {
      method: 'POST',
      headers: {
        Authorization: await vapidAuthorization(target.endpoint, vapid),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(options.ttlSeconds),
        Urgency: options.urgency,
      },
      body,
    },
  }
}

/** O aparelho saiu (desinstalou, revogou, trocou de navegador): apagar a inscrição. */
export function isGone(status: number): boolean {
  return status === 404 || status === 410
}
