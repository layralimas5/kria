// Quanto cada geração custa em créditos e o que ela entrega. Espelha a tabela
// `models` (0001 e 0010); `costs.test.ts` falha se o banco mudar e a vitrine não.

export interface GenerationCost {
  /** `models.slug` no banco. */
  readonly slug: string
  readonly label: string
  readonly credits: number
  /** Formato, duração e resolução quando se aplicam. */
  readonly output: string
  /** Quem não pode usar, quando há restrição. */
  readonly restriction?: string
}

export const GENERATION_COSTS: readonly GenerationCost[] = [
  { slug: 'foto', label: 'Foto (Nano Banana 2)', credits: 5, output: 'Imagem 4:5' },
  { slug: 'foto-persona', label: 'Foto com personagem', credits: 6, output: 'Imagem 4:5 com o rosto salvo' },
  { slug: 'video-kling', label: 'Vídeo Kling 3.0', credits: 40, output: '5 s com áudio, na proporção da imagem' },
  { slug: 'video-veo', label: 'Vídeo Veo 3.1', credits: 200, output: '8 s, 720p, vertical 9:16, com fala e som', restriction: 'Planos pagos' },
  { slug: 'copy', label: 'Ideias, copy ou roteiro', credits: 3, output: 'Texto por pedido' },
  { slug: 'ugc-roteiro', label: 'Roteiro UGC', credits: 3, output: 'Cenas com fala e descrição visual', restriction: 'Pro e Studio' },
]

/** Pacotes avulsos (`credit_packs`, 0001 e 0006). Não vencem. */
export const CREDIT_PACKS = [
  { slug: 'inicial', name: 'Inicial', credits: 100, price_cents: 1990 },
  { slug: 'criador', name: 'Criador', credits: 300, price_cents: 4990 },
  { slug: 'estudio', name: 'Estúdio', credits: 800, price_cents: 13990 },
] as const
