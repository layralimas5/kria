import { HOME_TAB, type NavGroup } from './nav'

/** Nomes curtos para caber no quadradinho da grade; o resto usa o nome do menu. */
const SHORT_LABELS: Readonly<Record<string, string>> = { 'Créditos e consumo': 'Créditos' }

/**
 * Grupos do menu do celular: sem o Dashboard (já está na barra de baixo) e com grupo de um item só
 * juntado ao anterior. Menos títulos e linhas = a gaveta cabe inteira na tela, sem rolar.
 */
export function compactGroups(groups: readonly NavGroup[]): NavGroup[] {
  const result: NavGroup[] = []
  for (const group of groups) {
    const items = group.items.filter((item) => item.to !== HOME_TAB.to)
    if (items.length === 0) continue
    const previous = result.at(-1)
    if (items.length === 1 && previous) result[result.length - 1] = { title: `${previous.title} e ${group.title.toLowerCase()}`, items: [...previous.items, ...items] }
    else result.push({ title: group.title, items })
  }
  return result
}

export function shortLabel(label: string): string {
  return SHORT_LABELS[label] ?? label
}
