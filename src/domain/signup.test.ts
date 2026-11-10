import { describe, expect, it } from 'vitest'
import { normalizeFullName, signupError } from './signup'

const VALID = { fullName: 'Layra Lima', password: 'senha-forte', confirmPassword: 'senha-forte' }

describe('signupError', () => {
  it('aceita nome com sobrenome e senhas iguais', () => {
    expect(signupError(VALID)).toBeNull()
  })

  it('pede o nome completo quando vem só o primeiro nome', () => {
    expect(signupError({ ...VALID, fullName: '  Layra  ' })).toMatch(/nome completo/)
    expect(signupError({ ...VALID, fullName: 'Layra L' })).toMatch(/nome completo/)
  })

  it('barra nome acima do limite do perfil', () => {
    expect(signupError({ ...VALID, fullName: `Layra ${'a'.repeat(80)}` })).toMatch(/até 80/)
  })

  it('confere tamanho e repetição da senha', () => {
    expect(signupError({ ...VALID, password: 'curta', confirmPassword: 'curta' })).toMatch(/8 caracteres/)
    expect(signupError({ ...VALID, confirmPassword: 'outra-senha' })).toBe('As senhas não são iguais.')
  })
})

describe('normalizeFullName', () => {
  it('tira espaços das pontas e repetidos', () => {
    expect(normalizeFullName('  Layra   Lima ')).toBe('Layra Lima')
  })
})
