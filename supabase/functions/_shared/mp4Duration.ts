// Duração de um MP4 ou MOV lida do próprio arquivo (caixa `moov` > `mvhd`), sem biblioteca.
// Serve para cobrar o Copiar movimento pela duração real, não pela que o navegador diz.

const HEADER = 8

function boxType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset + 4]!, bytes[offset + 5]!, bytes[offset + 6]!, bytes[offset + 7]!)
}

/** Tamanho da caixa (32 bits, 64 bits quando vale 1, até o fim quando vale 0) e onde o conteúdo começa. */
function boxBounds(view: DataView, offset: number, end: number): { size: number; body: number } | null {
  if (offset + HEADER > end) return null
  const small = view.getUint32(offset)
  if (small === 1) {
    if (offset + 16 > end) return null
    const large = Number(view.getBigUint64(offset + 8))
    return { size: large, body: offset + 16 }
  }
  return { size: small === 0 ? end - offset : small, body: offset + HEADER }
}

function findBox(bytes: Uint8Array, view: DataView, start: number, end: number, type: string): { body: number; end: number } | null {
  let offset = start
  while (offset + HEADER <= end) {
    const bounds = boxBounds(view, offset, end)
    if (!bounds || bounds.size < HEADER || offset + bounds.size > end) return null
    if (boxType(bytes, offset) === type) return { body: bounds.body, end: offset + bounds.size }
    offset += bounds.size
  }
  return null
}

/** Duração em milissegundos, ou `null` se o arquivo não for MP4/MOV legível. */
export function mp4DurationMs(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const moov = findBox(bytes, view, 0, bytes.length, 'moov')
  if (!moov) return null
  const mvhd = findBox(bytes, view, moov.body, moov.end, 'mvhd')
  if (!mvhd) return null
  const version = bytes[mvhd.body]
  let timescale: number
  let duration: number
  if (version === 1) {
    if (mvhd.body + 32 > mvhd.end) return null
    timescale = view.getUint32(mvhd.body + 20)
    duration = Number(view.getBigUint64(mvhd.body + 24))
  } else {
    if (mvhd.body + 20 > mvhd.end) return null
    timescale = view.getUint32(mvhd.body + 12)
    duration = view.getUint32(mvhd.body + 16)
  }
  if (timescale === 0 || !Number.isFinite(duration)) return null
  return Math.round((duration / timescale) * 1000)
}

export interface MotionTier {
  readonly slug: string
  readonly maxSeconds: number
}

/** Os níveis de cobrança (0044). O vídeo cai no menor nível que cabe nele. */
export const MOTION_TIERS: readonly MotionTier[] = [
  { slug: 'motion-5', maxSeconds: 5 },
  { slug: 'motion-10', maxSeconds: 10 },
]

export const MOTION_MIN_MS = 1_000
/** Folga para o arredondamento do arquivo: um vídeo de "5 s" costuma ter 5,03 s. */
const TOLERANCE_MS = 150

export type MotionCheck =
  | { readonly ok: true; readonly tier: MotionTier }
  | { readonly ok: false; readonly reason: string }

export function motionTierFor(durationMs: number): MotionCheck {
  if (durationMs < MOTION_MIN_MS) return { ok: false, reason: 'O vídeo precisa ter pelo menos 1 segundo.' }
  const tier = MOTION_TIERS.find((item) => durationMs <= item.maxSeconds * 1000 + TOLERANCE_MS)
  if (!tier) {
    const max = MOTION_TIERS[MOTION_TIERS.length - 1]!.maxSeconds
    return { ok: false, reason: `O vídeo pode ter até ${max} segundos. Corte o trecho do movimento e envie de novo.` }
  }
  return { ok: true, tier }
}

export function fitsTier(durationMs: number, maxSeconds: number): boolean {
  return durationMs <= maxSeconds * 1000 + TOLERANCE_MS
}
