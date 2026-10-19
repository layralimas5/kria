// Cliente mínimo da fila do fal.ai (https://fal.ai/docs/model-apis/model-endpoints/queue).
// Status e resultado são lidos pelas URLs que o próprio fal devolve no envio.

const QUEUE_BASE = 'https://queue.fal.run'

export class FalError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'FalError'
    this.status = status
  }
}

export interface FalSubmission {
  readonly request_id: string
  readonly status_url: string
  readonly response_url: string
}

export type FalQueueStatus = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED'

export interface FalStatus {
  readonly status: FalQueueStatus
  readonly error?: string
}

async function call<T>(key: string, method: 'GET' | 'POST', url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { authorization: `Key ${key}`, 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) throw new FalError(response.status, describeError(text) ?? `fal respondeu ${response.status}`)
  return (text ? JSON.parse(text) : {}) as T
}

/** Tira a mensagem legível de um erro do fal (`detail` pode ser texto ou lista de validação). */
export function describeError(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown; error?: unknown }
    if (typeof parsed.detail === 'string') return parsed.detail.slice(0, 300)
    if (Array.isArray(parsed.detail)) {
      const first = parsed.detail[0] as { msg?: unknown } | undefined
      if (typeof first?.msg === 'string') return first.msg.slice(0, 300)
    }
    if (typeof parsed.error === 'string') return parsed.error.slice(0, 300)
  } catch {
    // corpo não era JSON
  }
  return body ? body.slice(0, 300) : null
}

function assertFalUrl(url: string): string {
  if (!url.startsWith(`${QUEUE_BASE}/`)) throw new FalError(400, 'URL do fal inesperada')
  return url
}

export function submit(key: string, endpoint: string, input: unknown, webhookUrl: string): Promise<FalSubmission> {
  const url = `${QUEUE_BASE}/${endpoint}?fal_webhook=${encodeURIComponent(webhookUrl)}`
  return call<FalSubmission>(key, 'POST', url, input)
}

export function getStatus(key: string, statusUrl: string): Promise<FalStatus> {
  return call<FalStatus>(key, 'GET', assertFalUrl(statusUrl))
}

export function getResult(key: string, responseUrl: string): Promise<unknown> {
  return call<unknown>(key, 'GET', assertFalUrl(responseUrl))
}
