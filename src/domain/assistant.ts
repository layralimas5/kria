import type { PlanTool } from './plans'
import type { AssistantTool } from './types'

/** Canais aceitos pela function `assistant`. Espelha `CHANNELS` em `_shared/assistant.ts`. */
export const CHANNELS = ['instagram', 'tiktok', 'youtube', 'shorts', 'anuncio', 'whatsapp', 'linkedin', 'facebook'] as const
export type Channel = (typeof CHANNELS)[number]

export const CHANNEL_LABELS: Record<Channel, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  shorts: 'Shorts',
  anuncio: 'Anúncio',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
}

/** Tipos de texto da ferramenta de copy. Espelha `COPY_FORMATS` em `_shared/assistant.ts`. */
export const COPY_FORMATS = [
  'legenda',
  'anuncio',
  'descricao-produto',
  'titulo',
  'gancho',
  'texto-vendas',
  'adaptacao',
  'reescrita',
  'analise',
] as const
export type CopyFormat = (typeof COPY_FORMATS)[number]

export const COPY_FORMAT_LABELS: Record<CopyFormat, string> = {
  legenda: 'Legenda',
  anuncio: 'Copy de anúncio',
  'descricao-produto': 'Descrição de produto',
  titulo: 'Títulos',
  gancho: 'Ganchos',
  'texto-vendas': 'Texto de vendas',
  adaptacao: 'Adaptar para outra rede',
  reescrita: 'Revisar e reescrever',
  analise: 'Analisar uma copy',
}

/** Tipos que trabalham em cima de um texto que a pessoa cola no briefing. */
export const FORMATS_ON_EXISTING_TEXT: readonly CopyFormat[] = ['adaptacao', 'reescrita', 'analise']

export const CONTENT_GOALS = ['engajamento', 'alcance', 'vendas', 'leads', 'autoridade', 'lancamento'] as const
export type ContentGoal = (typeof CONTENT_GOALS)[number]

export const CONTENT_GOAL_LABELS: Record<ContentGoal, string> = {
  engajamento: 'Engajamento',
  alcance: 'Alcance',
  vendas: 'Vendas',
  leads: 'Captar contatos',
  autoridade: 'Autoridade',
  lancamento: 'Lançamento',
}

export const TEXT_LENGTHS = ['curto', 'medio', 'longo'] as const
export type TextLength = (typeof TEXT_LENGTHS)[number]

export const TEXT_LENGTH_LABELS: Record<TextLength, string> = {
  curto: 'Curto',
  medio: 'Médio',
  longo: 'Longo',
}

export interface AssistantToolInfo {
  readonly tool: AssistantTool
  /** Segmento da rota `/assistente/:ferramenta`. */
  readonly path: string
  readonly label: string
  readonly heading: string
  readonly placeholder: string
  /** Ferramenta de plano que libera a aba (`subscription_plans.tools`). */
  readonly planTool: PlanTool
  /** O resultado traz cenas com prompt visual: cada uma pode ir para o Studio. */
  readonly scenes: boolean
  /** Mostra a escolha do tipo de texto (só a copy). */
  readonly formats: boolean
}

export const ASSISTANT_TOOLS: readonly AssistantToolInfo[] = [
  {
    tool: 'ideias',
    path: 'ideias',
    label: 'Ideias',
    heading: 'O que postar',
    placeholder: 'Ex.: pautas para a semana de lançamento do café gelado, pensando em quem trabalha no centro.',
    planTool: 'copy',
    scenes: false,
    formats: false,
  },
  {
    tool: 'roteiro',
    path: 'roteiro',
    label: 'Roteiro',
    heading: 'Roteiro de vídeo',
    placeholder: 'Ex.: Reels de 30 segundos mostrando o café gelado sendo preparado, com gancho forte.',
    planTool: 'copy',
    scenes: true,
    formats: false,
  },
  {
    tool: 'copy',
    path: 'copy',
    label: 'Copys',
    heading: 'Copys e textos',
    placeholder: 'Ex.: legenda para o post do café gelado, com CTA para pedir pelo WhatsApp. Para revisar ou analisar, cole o texto aqui.',
    planTool: 'copy',
    scenes: false,
    formats: true,
  },
  {
    tool: 'ugc-roteiro',
    path: 'ugc',
    label: 'Roteiro UGC',
    heading: 'Roteiro UGC',
    placeholder: 'Ex.: criadora mostrando como preparar o café gelado em casa, gravando no celular na cozinha.',
    planTool: 'ugc_studio',
    scenes: true,
    formats: false,
  },
  {
    tool: 'planejamento',
    path: 'planejamento',
    label: 'Planejamento',
    heading: 'Planejamento editorial',
    placeholder: 'Ex.: 12 posts para as próximas 4 semanas, foco no lançamento do café gelado e em trazer gente nova.',
    planTool: 'copy',
    scenes: false,
    formats: false,
  },
]

export function toolByPath(path: string | undefined): AssistantToolInfo | null {
  return ASSISTANT_TOOLS.find((info) => info.path === path) ?? null
}

export function toolInfo(tool: AssistantTool): AssistantToolInfo {
  const info = ASSISTANT_TOOLS.find((item) => item.tool === tool)
  if (!info) throw new Error(`ferramenta desconhecida: ${tool}`)
  return info
}

/** O briefing que um item leva para a próxima ferramenta: título + o texto dele. */
export function briefFromIdea(label: string, text: string): string {
  return `${label}\n\n${text}`.trim().slice(0, 2000)
}

/** Dia do post no planejamento ("Dia 3, Reels" vira 3); sem número, vale a posição na lista. */
export function planDay(label: string, index: number): number {
  const match = /dia\s*(\d{1,3})/i.exec(label)
  return match ? Number(match[1]) : index + 1
}
