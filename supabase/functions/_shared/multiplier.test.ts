import { describe, expect, it } from 'vitest'
import { buildMultiplierMessage, MULTIPLIER_SYSTEM_PROMPT, parseMultiplierOutput, type MultiplierProject } from './multiplier'

const PROJECT: MultiplierProject = {
  name: 'Sérum',
  product_name: 'Sérum vitamina C',
  product_description: 'Textura leve, frasco de 30 ml.',
  audience: 'Mulheres de 25 a 35 anos',
  platform: 'tiktok',
  objective: 'vendas',
  aspect: '9:16',
  transcript: '',
  takes: [
    { id: 'a', name: 'abrindo.mp4', kind: 'video', duration: 12, note: 'mão abrindo a caixa' },
    { id: 'b', name: 'frasco.jpg', kind: 'image', duration: 3, note: '' },
  ],
}

describe('buildMultiplierMessage', () => {
  it('descreve os takes, o canal e a quantidade, com o briefing entre marcadores', () => {
    const message = buildMultiplierMessage(PROJECT, 4)
    expect(message).toContain('escreva 4 variações de vídeo curto para TikTok, formato 9:16')
    expect(message).toContain('Take 1 (vídeo de 12.0s): mão abrindo a caixa')
    expect(message).toContain('Take 2 (foto) (sem descrição; use como apoio visual)')
    expect(message).toMatch(/<pedido>\nProduto: Sérum vitamina C\nDescrição: Textura leve, frasco de 30 ml\.\nPúblico: Mulheres de 25 a 35 anos\n<\/pedido>$/)
    expect(message).not.toContain('O que a pessoa fala')
  })

  it('o system prompt proíbe inventar e driblar duplicado', () => {
    expect(MULTIPLIER_SYSTEM_PROMPT).toContain('Não invente característica')
    expect(MULTIPLIER_SYSTEM_PROMPT).toContain('Nunca proponha mudar velocidade, filtro ou metadado')
  })
})

describe('parseMultiplierOutput', () => {
  const variation = (hook: string) => ({ angle: 'Dor', hook, beats: [{ take: 1, start: 0, duration: 3, text: 'x' }], cta: 'Link', caption: 'c' })

  it('ajusta cada roteiro, descarta o inválido e respeita a quantidade pedida', () => {
    const raw = JSON.stringify({
      analysis: { benefits: ['textura leve'], limitations: [], opportunities: [] },
      variations: [variation('Um'), { ...variation('Dois'), beats: [{ take: 9, start: 0, duration: 2, text: '' }] }, variation('Três'), variation('Quatro')],
    })
    const output = parseMultiplierOutput(raw, PROJECT.takes, 2)
    expect(output?.variations.map((item) => item.hook)).toEqual(['Um', 'Três'])
    expect(output?.analysis.benefits).toEqual(['textura leve'])
  })

  it('nulo para JSON quebrado ou sem variação aproveitável', () => {
    expect(parseMultiplierOutput('{', PROJECT.takes, 2)).toBeNull()
    expect(parseMultiplierOutput(JSON.stringify({ variations: [] }), PROJECT.takes, 2)).toBeNull()
  })
})
