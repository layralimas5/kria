import { describe, expect, it } from 'vitest'
import {
  buildTimeline,
  exportFileName,
  groupBatches,
  missingForScripts,
  overlaysAt,
  segmentAt,
  toVariation,
  wrapText,
  type TakeInfo,
  type Variation,
  type VariationScript,
} from './multiplier'

const TAKES: TakeInfo[] = [
  { id: 'a', name: 'abrindo.mp4', kind: 'video', duration: 10, note: '' },
  { id: 'b', name: 'frasco.jpg', kind: 'image', duration: 3, note: '' },
]

const SCRIPT: VariationScript = {
  angle: 'Dor',
  hook: 'Pele sem viço?',
  beats: [
    { take: 1, start: 2, duration: 4, text: 'Abre a caixa' },
    { take: 2, start: 0, duration: 3, text: 'O frasco' },
  ],
  cta: 'Link na bio',
  caption: '',
}

describe('buildTimeline', () => {
  const timeline = buildTimeline(SCRIPT, TAKES, '9:16')

  it('põe as cenas em sequência e soma o cartão final', () => {
    expect(timeline.width).toBe(1080)
    expect(timeline.height).toBe(1920)
    expect(timeline.segments).toEqual([
      { takeId: 'a', kind: 'video', at: 0, from: 2, duration: 4 },
      { takeId: 'b', kind: 'image', at: 4, from: 0, duration: 3 },
    ])
    expect(timeline.endCardAt).toBe(7)
    expect(timeline.duration).toBe(9.5)
  })

  it('gancho nos 3 primeiros segundos, texto da cena depois dele e CTA no fim', () => {
    expect(timeline.overlays).toEqual([
      { kind: 'hook', text: 'Pele sem viço?', at: 0, duration: 3 },
      { kind: 'beat', text: 'Abre a caixa', at: 3, duration: 1 },
      { kind: 'beat', text: 'O frasco', at: 4, duration: 3 },
      { kind: 'cta', text: 'Link na bio', at: 7, duration: 2.5 },
    ])
    expect(overlaysAt(timeline, 1).map((item) => item.kind)).toEqual(['hook'])
    expect(overlaysAt(timeline, 8).map((item) => item.kind)).toEqual(['cta'])
    expect(segmentAt(timeline, 5)?.takeId).toBe('b')
    expect(segmentAt(timeline, 8)).toBeNull()
  })

  it('sem CTA não tem cartão final; texto curto demais depois do gancho some', () => {
    const short = buildTimeline({ ...SCRIPT, cta: '', beats: [{ take: 1, start: 0, duration: 3.5, text: 'curto' }] }, TAKES, '1:1')
    expect(short.duration).toBe(3.5)
    expect(short.overlays.map((item) => item.kind)).toEqual(['hook'])
  })
})

describe('wrapText', () => {
  it('quebra por palavra sem passar da largura', () => {
    expect(wrapText('um dois três quatro', 9, (value) => value.length)).toEqual(['um dois', 'três', 'quatro'])
    expect(wrapText('palavragrandedemais', 5, (value) => value.length)).toEqual(['palavragrandedemais'])
    expect(wrapText('   ', 5, (value) => value.length)).toEqual([])
  })
})

describe('variações e lotes', () => {
  const row = (id: string, batch: string, position: number, createdAt: string) => ({
    id,
    project_id: '00000000-0000-4000-8000-000000000001',
    generation_id: batch,
    position,
    script: SCRIPT,
    edited: false,
    render_status: 'pending' as const,
    rendered_at: null,
    created_at: createdAt,
  })

  it('roteiro que não cabe mais nos takes fica de fora', () => {
    expect(toVariation({ ...row('1', 'x', 1, '2026-11-06'), script: { ...SCRIPT, beats: [{ take: 5, start: 0, duration: 2, text: '' }] } }, TAKES)).toBeNull()
  })

  it('agrupa por lote, mais novo primeiro, em ordem de posição', () => {
    const variations = [row('1', 'old', 2, '2026-11-01'), row('2', 'new', 1, '2026-11-05'), row('3', 'old', 1, '2026-11-01')]
      .map((item) => toVariation(item, TAKES))
      .filter((item): item is Variation => item !== null)
    const batches = groupBatches(variations)
    expect(batches.map((batch) => batch.id)).toEqual(['new', 'old'])
    expect(batches[1]?.variations.map((item) => item.id)).toEqual(['3', '1'])
  })
})

describe('missingForScripts', () => {
  it('lista o que falta antes de gastar crédito', () => {
    expect(missingForScripts({ takes: [], rights_confirmed: false, product_name: '', product_description: '' })).toHaveLength(3)
    expect(missingForScripts({ takes: TAKES, rights_confirmed: true, product_name: 'Sérum', product_description: '' })).toEqual([])
  })
})

describe('exportFileName', () => {
  it('sem acento nem espaço', () => {
    expect(exportFileName('Sérum Vitamina C', { position: 3, script: { ...SCRIPT, angle: 'Problema e solução' } }, 'mp4')).toBe(
      'serum-vitamina-c-03-problema-e-solucao.mp4',
    )
  })
})
