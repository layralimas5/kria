// Assina o id da geração na URL de retorno do fal.ai. O webhook nunca
// confia no corpo recebido: com a assinatura válida, ele consulta o
// resultado direto no fal com a nossa chave.

const encoder = new TextEncoder()

async function hmacKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error('WEBHOOK_SECRET precisa de 32+ caracteres')
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function signGenerationId(secret: string, generationId: string): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(`generation:${generationId}`))
  return toHex(signature)
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyGenerationId(secret: string, generationId: string, token: string): Promise<boolean> {
  return timingSafeEqual(await signGenerationId(secret, generationId), token)
}
