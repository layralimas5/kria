import { describe, expect, it } from 'vitest'
import { cardBrand, maskCardNumber, maskCep, maskCpf, maskExpiry, maskPhone } from './checkoutMasks'

describe('máscaras do checkout', () => {
  it('formata enquanto a pessoa digita', () => {
    expect(maskCpf('52998224725')).toBe('529.982.247-25')
    expect(maskCpf('5299')).toBe('529.9')
    expect(maskPhone('11987654321')).toBe('(11) 98765-4321')
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444')
    expect(maskCep('01310100')).toBe('01310-100')
    expect(maskCardNumber('4111111111111111')).toBe('4111 1111 1111 1111')
    expect(maskExpiry('0735')).toBe('07/35')
  })

  it('reconhece as bandeiras mais comuns', () => {
    expect(cardBrand('4111 1111')).toBe('visa')
    expect(cardBrand('5162 3062')).toBe('mastercard')
    expect(cardBrand('3782')).toBe('amex')
    expect(cardBrand('6362 9700')).toBe('elo')
    expect(cardBrand('9')).toBe(null)
  })
})
