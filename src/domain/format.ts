const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function formatBRL(cents: number): string {
  return brl.format(cents / 100)
}

export function formatCredits(credits: number): string {
  return `${credits.toLocaleString('pt-BR')} ${Math.abs(credits) === 1 ? 'crédito' : 'créditos'}`
}

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

const dateOnly = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' })

/** "18 de out. de 2026" no fuso de Brasília, para vencimentos e renovações. */
export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso))
}

/** Prompt que gera um retrato limpo, bom de usar como referência de persona. */
export function personaPortraitPrompt(description: string): string {
  return [
    'Retrato fotográfico realista, rosto e ombros, olhando para a câmera,',
    'luz natural suave, fundo neutro, pele com textura real, foto de celular de alta qualidade.',
    `Pessoa: ${description.trim()}`,
  ].join(' ')
}

/** Chips de configuração do modelo (formato, duração, áudio) a partir dos defaults do catálogo. */
/** Onde cada proporção encaixa, para a pessoa escolher sem saber o número de cor. */
export const ASPECT_LABELS: Readonly<Record<string, string>> = {
  '4:5': 'Feed',
  '1:1': 'Quadrado',
  '9:16': 'Stories e Reels',
  '16:9': 'YouTube',
}

/** Os defaults que viram chip fixo: o que a pessoa pode escolher (`options`) sai daqui e ganha seletor. */
export function fixedDefaults(defaults: Record<string, unknown>, options: Readonly<Record<string, readonly string[]>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(defaults).filter(([key]) => !(key in options)))
}

export function modelSpecs(defaults: Record<string, unknown>): string[] {
  const specs: string[] = []
  if (typeof defaults.aspect_ratio === 'string' && defaults.aspect_ratio !== 'auto') specs.push(defaults.aspect_ratio)
  if (typeof defaults.duration === 'string' || typeof defaults.duration === 'number') {
    specs.push(`${String(defaults.duration).replace(/s$/, '')}s`)
  }
  if (defaults.generate_audio === true) specs.push('Áudio')
  return specs
}
