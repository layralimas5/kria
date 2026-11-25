import { describe, expect, it } from 'vitest'
import { fitsTier, motionTierFor, mp4DurationMs } from './mp4Duration'

function box(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + body.length)
  new DataView(out.buffer).setUint32(0, out.length)
  out.set([...type].map((char) => char.charCodeAt(0)), 4)
  out.set(body, 8)
  return out
}

function mvhd(version: 0 | 1, timescale: number, duration: number): Uint8Array {
  const body = new Uint8Array(version === 1 ? 108 : 96)
  const view = new DataView(body.buffer)
  body[0] = version
  if (version === 1) {
    view.setUint32(20, timescale)
    view.setBigUint64(24, BigInt(duration))
  } else {
    view.setUint32(12, timescale)
    view.setUint32(16, duration)
  }
  return box('mvhd', body)
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

const ftyp = box('ftyp', new TextEncoder().encode('isom\0\0\0\0isomiso2mp41'))

describe('mp4DurationMs', () => {
  it('lê o mvhd versão 0 com o moov no começo', () => {
    const file = concat(ftyp, box('moov', concat(mvhd(0, 1000, 7_250), box('trak', new Uint8Array(20)))), box('mdat', new Uint8Array(64)))
    expect(mp4DurationMs(file)).toBe(7_250)
  })

  it('lê o moov no fim do arquivo (vídeo gravado no celular) e a versão 1', () => {
    const file = concat(ftyp, box('mdat', new Uint8Array(500)), box('moov', mvhd(1, 600, 5_400)))
    expect(mp4DurationMs(file)).toBe(9_000)
  })

  it('devolve nulo para arquivo que não é MP4 ou está cortado', () => {
    expect(mp4DurationMs(new TextEncoder().encode('não é vídeo nenhum'))).toBeNull()
    expect(mp4DurationMs(concat(ftyp, box('mdat', new Uint8Array(10))))).toBeNull()
    const truncated = concat(ftyp, box('moov', mvhd(0, 1000, 3000))).slice(0, 40)
    expect(mp4DurationMs(truncated)).toBeNull()
  })
})

describe('motionTierFor', () => {
  it('escolhe o menor nível que cabe, com folga de arredondamento', () => {
    expect(motionTierFor(3_000)).toEqual({ ok: true, tier: { slug: 'motion-5', maxSeconds: 5 } })
    expect(motionTierFor(5_100)).toMatchObject({ ok: true, tier: { slug: 'motion-5' } })
    expect(motionTierFor(5_400)).toMatchObject({ ok: true, tier: { slug: 'motion-10' } })
    expect(motionTierFor(10_000)).toMatchObject({ ok: true, tier: { slug: 'motion-10' } })
  })

  it('recusa curto demais e longo demais', () => {
    expect(motionTierFor(400)).toMatchObject({ ok: false })
    expect(motionTierFor(12_000)).toEqual({ ok: false, reason: 'O vídeo pode ter até 10 segundos. Corte o trecho do movimento e envie de novo.' })
  })
})

it('fitsTier confere o vídeo contra o nível escolhido', () => {
  expect(fitsTier(4_900, 5)).toBe(true)
  expect(fitsTier(9_000, 5)).toBe(false)
})
