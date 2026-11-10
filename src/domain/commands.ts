// Busca global (Ctrl+K): comandos de navegação e ação, busca sem acento e atalhos "G + letra".
// A tela (CommandPalette) só desenha; quem monta a lista é o app ou o admin, conforme o acesso.

export type CommandGroup = 'Recentes' | 'Ir para' | 'Ações' | 'Clientes' | 'Admin'

export interface Command {
  readonly id: string
  readonly label: string
  readonly group: CommandGroup
  /** Seção do menu ("Criar", "Comercial"), mostrada ao lado do nome. */
  readonly section?: string
  /** Outras palavras que acham o comando ("pagamento" acha Financeiro). */
  readonly keywords?: readonly string[]
  /** Atalho exibido à direita ("G F"). */
  readonly shortcut?: string
  /** Rota interna; sem rota, `run` faz a ação. */
  readonly to?: string
  readonly run?: () => void
}

/** Minúsculas e sem acento: "Créditos" e "creditos" são a mesma busca. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Relevância de um comando para a busca; zero = não aparece. Começo do nome vale mais que começo de
 * palavra, que vale mais que palavra-chave, que vale mais que trecho no meio.
 */
export function scoreCommand(query: string, command: Command): number {
  const q = normalize(query)
  if (!q) return 1
  const label = normalize(command.label)
  const words = label.split(/\s+/)
  const extra = [command.section ?? '', ...(command.keywords ?? [])].map(normalize)
  const terms = q.split(/\s+/).filter(Boolean)
  let score = 0
  for (const term of terms) {
    if (label.startsWith(term)) score += 100
    else if (words.some((word) => word.startsWith(term))) score += 60
    else if (extra.some((word) => word.startsWith(term))) score += 35
    else if (label.includes(term)) score += 20
    else if (extra.some((word) => word.includes(term))) score += 10
    else return 0
  }
  return score
}

const GROUP_ORDER: readonly CommandGroup[] = ['Recentes', 'Ir para', 'Ações', 'Clientes', 'Admin']

/** Comandos que casam com a busca, em grupos na ordem fixa e, dentro do grupo, por relevância. */
export function filterCommands(query: string, commands: readonly Command[], limit = 40): Command[] {
  const scored = commands
    .map((command, index) => ({ command, index, score: scoreCommand(query, command) }))
    .filter((item) => item.score > 0)
  const byGroup = (group: CommandGroup) =>
    scored.filter((item) => item.command.group === group).sort((a, b) => b.score - a.score || a.index - b.index)
  return GROUP_ORDER.flatMap(byGroup)
    .map((item) => item.command)
    .slice(0, limit)
}

/** Remove repetidos pelo id, mantendo a primeira ocorrência (o recente fica, a cópia em "Ir para" sai). */
export function uniqueById(commands: readonly Command[]): Command[] {
  const seen = new Set<string>()
  return commands.filter((command) => (seen.has(command.id) ? false : (seen.add(command.id), true)))
}

export const RECENT_LIMIT = 5

/** Lista de recentes depois de usar um comando: ele vai para o topo, sem repetir. */
export function pushRecent(recent: readonly string[], id: string): string[] {
  return [id, ...recent.filter((item) => item !== id)].slice(0, RECENT_LIMIT)
}

export interface GoShortcut {
  /** Tecla depois do G. */
  readonly key: string
  readonly to: string
  readonly label: string
}

/** Atalho "G + letra" a partir da tecla apertada; nulo se não houver. */
export function goShortcutFor(key: string, shortcuts: readonly GoShortcut[]): GoShortcut | null {
  return shortcuts.find((item) => item.key === key.toLowerCase()) ?? null
}

/** Tecla vinda de campo de texto não dispara atalho: digitar "g" num prompt não muda de tela. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as { tagName?: unknown }).tagName !== 'string') return false
  const element = target as HTMLElement
  const tag = element.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable === true
}
