// Captura e repassa UTMs da URL de entrada: o visitante chega pela landing com
// ?utm_source=youtube&utm_medium=nivora&utm_campaign=<slug> e, ao clicar em qualquer
// CTA, os mesmos parâmetros viajam para a tela de cadastro e checkout. A primeira
// visita grava em sessionStorage; cliques futuros no mesmo tab aproveitam o mesmo
// atribuído, mesmo que o visitante vá para outra seção antes de converter.

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const
type UtmKey = (typeof UTM_KEYS)[number]
export type UtmParams = Partial<Record<UtmKey, string>>

const STORAGE_KEY = 'vynkio:utm'

function readStorage(): UtmParams {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: UtmParams = {}
    for (const key of UTM_KEYS) {
      const value = (parsed as Record<string, unknown>)[key]
      if (typeof value === 'string' && value.length > 0) out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

function writeStorage(params: UtmParams): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(params))
  } catch {
    // storage pode estar bloqueado (modo privado); seguimos sem persistir.
  }
}

/** Captura utm_* da URL atual e grava na sessão. Chame uma vez, no boot da landing. */
export function captureUtmFromLocation(): UtmParams {
  if (typeof window === 'undefined') return {}
  const search = new URLSearchParams(window.location.search)
  const captured: UtmParams = {}
  for (const key of UTM_KEYS) {
    const value = search.get(key)
    if (value && value.length > 0) captured[key] = value
  }
  if (Object.keys(captured).length === 0) return readStorage()
  writeStorage(captured)
  return captured
}

export function getStoredUtm(): UtmParams {
  return readStorage()
}

/** Adiciona utm_* a uma URL interna (/entrar, /assinar/pro). Preserva o que já estava. */
export function appendUtmToPath(path: string, utm: UtmParams = getStoredUtm()): string {
  const entries = Object.entries(utm).filter((entry): entry is [string, string] => Boolean(entry[1]))
  if (entries.length === 0) return path
  const [base = path, existing] = path.split('?')
  const params = new URLSearchParams(existing ?? '')
  for (const [key, value] of entries) {
    if (!params.has(key)) params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}
