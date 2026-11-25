import { describe, expect, it } from 'vitest'
import { formatBrl, generationMessage, saleMessage } from './pushMessages'

describe('saleMessage', () => {
  it('assinatura nova: parabéns com o valor no título e o plano no texto', () => {
    const first = saleMessage({ kind: 'plan', planName: 'Pro', amountCents: 7990, firstPayment: true, id: 'p1' })
    expect(first.title).toBe('Parabéns, Vynkio! Venda de R$ 79,90')
    expect(first.body).toBe('Mais um usuário do plano Pro.')
    expect(first.topic).toBe('sales')
  })

  it('renovação diz que é renovação', () => {
    const renewal = saleMessage({ kind: 'plan', planName: 'Max', amountCents: 19990, firstPayment: false, id: 'p2' })
    expect(renewal.title).toBe('Parabéns, Vynkio! Venda de R$ 199,90')
    expect(renewal.body).toBe('Mais um mês do plano Max renovado.')
  })

  it('loja e pacote também levam o valor, sem dado de quem comprou', () => {
    const store = saleMessage({ kind: 'store', products: ['Kit A', 'Kit B', 'Kit C'], amountCents: 4790, id: 'o1' })
    expect(store.title).toBe('Parabéns, Vynkio! Venda de R$ 47,90')
    expect(store.body).toBe('Mais uma venda na loja: Kit A + 2.')
    expect(saleMessage({ kind: 'pack', packName: 'Turbo', credits: 2300, amountCents: 4900, id: 'x' }).body).toBe('Mais um pacote Turbo vendido: 2.300 créditos.')
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
