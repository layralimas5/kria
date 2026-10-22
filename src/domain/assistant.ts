import type { PlanTool } from './plans'
import type { AssistantTool } from './types'

/** Canais aceitos pela function `assistant`. Espelha `CHANNELS` em `_shared/assistant.ts`. */
export const CHANNELS = ['instagram', 'tiktok', 'youtube', 'shorts', 'anuncio', 'whatsapp'] as const
export type Channel = (typeof CHANNELS)[number]

export const CHANNEL_LABELS: Record<Channel, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  shorts: 'Shorts',
  anuncio: 'Anúncio',
  whatsapp: 'WhatsApp',
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
  },
  {
    tool: 'roteiro',
    path: 'roteiro',
    label: 'Roteiro',
    heading: 'Roteiro de vídeo',
    placeholder: 'Ex.: Reels de 30 segundos mostrando o café gelado sendo preparado, com gancho forte.',
    planTool: 'copy',
    scenes: true,
  },
  {
    tool: 'copy',
    path: 'copy',
    label: 'Copy e legenda',
    heading: 'Copy e legenda',
    placeholder: 'Ex.: legenda para o post do café gelado, com CTA para pedir pelo WhatsApp.',
    planTool: 'copy',
    scenes: false,
  },
  {
    tool: 'ugc-roteiro',
    path: 'ugc',
    label: 'Roteiro UGC',
    heading: 'Roteiro UGC',
    placeholder: 'Ex.: cliente contando que trocou o café da padaria pelo nosso, gravando no celular dentro do carro.',
    planTool: 'ugc_studio',
    scenes: true,
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

/** O briefing que uma ideia leva para o roteiro: título + o que a ideia propõe. */
export function briefFromIdea(label: string, text: string): string {
  return `${label}\n\n${text}`.trim().slice(0, 2000)
}
