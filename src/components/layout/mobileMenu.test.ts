import { describe, expect, it } from 'vitest'
import { compactGroups, shortLabel } from './mobileMenu'
import { navGroupsFor } from './nav'

describe('compactGroups', () => {
  const groups = compactGroups(navGroupsFor(null, ['image', 'video']))

  it('tira o Dashboard, que já está na barra de baixo', () => {
    expect(groups.flatMap((group) => group.items).some((item) => item.to === '/inicio')).toBe(false)
  })

  it('junta grupo de um item só ao anterior', () => {
    expect(groups.every((group) => group.items.length > 1)).toBe(true)
    expect(groups.map((group) => group.title)).toContain('Conteúdo e resultados')
  })
})

it('shortLabel encurta só o que não cabe no quadradinho', () => {
  expect(shortLabel('Créditos e consumo')).toBe('Créditos')
  expect(shortLabel('Biblioteca')).toBe('Biblioteca')
})
