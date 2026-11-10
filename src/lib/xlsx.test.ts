import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { buildXlsx } from './xlsx'

describe('buildXlsx', () => {
  const zip = unzipSync(
    buildXlsx([
      { name: 'Resumo', header: ['Indicador', 'Valor'], rows: [['Receita <bruta> & "líquida"', 1234.5], ['Vazio', null]] },
      { name: 'Movimentações: 2026/11', header: ['A'], rows: [['=1+1']] },
    ]),
  )

  const part = (name: string) => strFromU8(zip[name] ?? new Uint8Array())

  it('monta as partes que o Excel exige, uma aba por planilha', () => {
    expect(Object.keys(zip).sort()).toEqual(
      [
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/_rels/workbook.xml.rels',
        'xl/styles.xml',
        'xl/workbook.xml',
        'xl/worksheets/sheet1.xml',
        'xl/worksheets/sheet2.xml',
      ].sort(),
    )
  })

  it('escapa texto, mantém número como número e pula célula vazia', () => {
    const sheet = part('xl/worksheets/sheet1.xml')
    expect(sheet).toContain('Receita &lt;bruta&gt; &amp; &quot;líquida&quot;')
    expect(sheet).toContain('<c r="B2"><v>1234.5</v></c>')
    expect(sheet).not.toContain('r="B3"')
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1">')
  })

  it('limpa o nome da aba e grava fórmula como texto', () => {
    expect(part('xl/workbook.xml')).toContain('name="Movimentações  2026 11"')
    expect(part('xl/worksheets/sheet2.xml')).toContain('<t xml:space="preserve">=1+1</t>')
  })
})
