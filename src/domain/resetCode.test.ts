import { describe, expect, it } from 'vitest'
import { isCompleteCode, RESET_CODE_LENGTH, sanitizeCode } from './resetCode'

describe('sanitizeCode', () => {
  it('fica só com os dígitos de um código colado com espaço ou traço', () => {
    expect(sanitizeCode('123 456')).toBe('123456')
    expect(sanitizeCode('12-34-56')).toBe('123456')
  })

  it('corta no tamanho do código', () => {
    expect(sanitizeCode('1234567890')).toHaveLength(RESET_CODE_LENGTH)
  })
})

describe('isCompleteCode', () => {
  it('aceita só o código inteiro, só com números', () => {
    expect(isCompleteCode('123456')).toBe(true)
    expect(isCompleteCode('12345')).toBe(false)
    expect(isCompleteCode('12345a')).toBe(false)
  })
})
