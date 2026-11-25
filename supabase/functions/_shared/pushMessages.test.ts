import { describe, expect, it } from 'vitest'
import { formatBrl, generationMessage, saleMessage } from './pushMessages'

describe('saleMessage', () => {
  it('separa assinatura nova de renovação', () => {
    const first = saleMessage({ kind: 'plan', planName: 'Pro', amountCents: 9790, firstPayment: true, id: 'p1' })
    expect(first.title).toBe('Nova assinatura: Pro')
    expect(first.body).toContain('R$ 97,90')
    expect(first.topic).toBe('sales')
    const renewal = saleMessage({ kind: 'plan', planName: 'Pro', amountCents: 9790, firstPayment: false, id: 'p2' })
    expect(renewal.title).toBe('Renovação: Pro')
  })

  it('resume a loja sem dado de quem comprou', () => {
    const message = saleMessage({ kind: 'store', products: ['Kit A', 'Kit B', 'Kit C'], amountCents: 4790, id: 'o1' })
    expect(message.body).toBe('R$ 47,90 · Kit A + 2')
    expect(message.tag).toBe('sale-o1')
  })

  it('pacote mostra créditos', () => {
    expect(saleMessage({ kind: 'pack', packName: 'Turbo', credits: 2300, amountCents: 4900, id: 'x' }).body).toBe('R$ 49,00 por 2.300 créditos.')
  })
})

describe('generationMessage', () => {
  it('leva para a galeria quando sai e para o Studio quando falha', () => {
    expect(generationMessage({ id: 'g', kind: 'video', succeeded: true })).toMatchObject({ title: 'Seu vídeo ficou pronto', url: '/galeria' })
    expect(generationMessage({ id: 'g', kind: 'image', succeeded: false }).url).toBe('/estudio?modo=imagem')
  })
})

it('formatBrl usa espaço comum', () => {
  expect(formatBrl(123456)).toBe('R$ 1.234,56')
})
