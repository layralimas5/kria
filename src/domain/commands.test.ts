import { describe, expect, it } from 'vitest'
import { filterCommands, goShortcutFor, isTypingTarget, normalize, pushRecent, scoreCommand, uniqueById, type Command } from './commands'

const commands: Command[] = [
  { id: 'fin', label: 'Financeiro', group: 'Ir para', section: 'Comercial', keywords: ['pagamento', 'receita'] },
  { id: 'cred', label: 'Créditos e consumo', group: 'Ir para', section: 'Gerenciamento' },
  { id: 'buy', label: 'Comprar créditos', group: 'Ações' },
  { id: 'users', label: 'Usuários', group: 'Ir para', section: 'Operação', keywords: ['clientes'] },
]

describe('busca', () => {
  it('ignora acento e caixa', () => {
    expect(normalize('  Créditos ')).toBe('creditos')
    expect(filterCommands('creditos', commands).map((c) => c.id)).toEqual(['cred', 'buy'])
  })

  it('começo do nome vale mais que palavra-chave', () => {
    expect(scoreCommand('fin', commands[0] as Command)).toBeGreaterThan(scoreCommand('pag', commands[0] as Command))
    expect(filterCommands('cli', commands).map((c) => c.id)).toEqual(['users'])
  })

  it('todas as palavras precisam casar', () => {
    expect(filterCommands('comprar creditos', commands).map((c) => c.id)).toEqual(['buy'])
    expect(filterCommands('comprar plano', commands)).toEqual([])
  })

  it('agrupa na ordem fixa e mantém tudo sem busca', () => {
    expect(filterCommands('', [commands[2] as Command, commands[0] as Command]).map((c) => c.group)).toEqual(['Ir para', 'Ações'])
  })
})

describe('recentes e atalhos', () => {
  it('recente vai para o topo, sem repetir, até cinco', () => {
    expect(pushRecent(['a', 'b', 'c', 'd', 'e'], 'c')).toEqual(['c', 'a', 'b', 'd', 'e'])
    expect(pushRecent(['a', 'b', 'c', 'd', 'e'], 'f')).toHaveLength(5)
  })

  it('tira repetidos pelo id', () => {
    expect(uniqueById([commands[0] as Command, { ...(commands[0] as Command), group: 'Recentes' }])).toHaveLength(1)
  })

  it('acha o atalho G + letra e ignora digitação em campo', () => {
    expect(goShortcutFor('F', [{ key: 'f', to: '/admin/financeiro', label: 'Financeiro' }])?.to).toBe('/admin/financeiro')
    expect(goShortcutFor('x', [])).toBeNull()
    expect(isTypingTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true)
    expect(isTypingTarget({ tagName: 'BUTTON', isContentEditable: false } as unknown as EventTarget)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
