// Características do construtor de persona. O rótulo aparece em português na
// tela; o `prompt` vai em inglês, que é como os modelos de imagem respondem melhor.
//
// Os grupos `photos` mostram cada opção como imagem (o mesmo manequim mudando
// só aquela característica). As fotos reais saem de `npm run traits:images`;
// enquanto não existem, a tela desenha uma ilustração equivalente.

export type TraitGroupId =
  | 'niche'
  | 'gender'
  | 'age'
  | 'ethnicity'
  | 'hairstyle'
  | 'faceShape'
  | 'facialHair'
  | 'features'
  | 'expression'
  | 'build'
  | 'outfit'
  | 'setting'
  | 'skin'
  | 'hairColor'
  | 'eyeColor'
  | 'outfitColor'

export type TraitDisplay = 'photos' | 'tiles' | 'chips' | 'swatches'

/** As abas do construtor, na ordem em que aparecem. */
export type TraitSection = 'perfil' | 'rosto' | 'corpo' | 'cores'

export const TRAIT_SECTIONS: readonly { readonly id: TraitSection; readonly label: string }[] = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'rosto', label: 'Cabelo e rosto' },
  { id: 'corpo', label: 'Corpo e roupa' },
  { id: 'cores', label: 'Cores' },
]

export interface TraitOption {
  readonly value: string
  readonly label: string
  readonly prompt: string
  /** Cor da amostra, nos grupos de cor. */
  readonly swatch?: string
}

export interface TraitGroup {
  readonly id: TraitGroupId
  readonly label: string
  readonly section: TraitSection
  readonly display: TraitDisplay
  readonly multiple?: boolean
  /** Grupo que não vale para persona feminina (barba e bigode). */
  readonly notForFeminine?: true
  readonly options: readonly TraitOption[]
}

export const PERSONA_TRAIT_GROUPS: readonly TraitGroup[] = [
  {
    id: 'niche',
    label: 'Nicho',
    section: 'perfil',
    display: 'tiles',
    options: [
      { value: 'lifestyle', label: 'Lifestyle', prompt: 'lifestyle content creator' },
      { value: 'fitness', label: 'Fitness', prompt: 'fitness influencer' },
      { value: 'moda', label: 'Moda', prompt: 'fashion influencer' },
      { value: 'beleza', label: 'Beleza', prompt: 'beauty and skincare influencer' },
      { value: 'tech', label: 'Tech', prompt: 'tech reviewer' },
      { value: 'games', label: 'Games', prompt: 'gaming streamer' },
      { value: 'viagem', label: 'Viagem', prompt: 'travel creator' },
      { value: 'gastronomia', label: 'Comida', prompt: 'food creator' },
      { value: 'negocios', label: 'Negócios', prompt: 'business and finance creator' },
    ],
  },
  {
    id: 'gender',
    label: 'Gênero',
    section: 'perfil',
    display: 'chips',
    options: [
      { value: 'feminino', label: 'Feminino', prompt: 'woman' },
      { value: 'masculino', label: 'Masculino', prompt: 'man' },
      { value: 'androgino', label: 'Andrógino', prompt: 'androgynous person' },
    ],
  },
  {
    id: 'age',
    label: 'Idade',
    section: 'perfil',
    display: 'chips',
    // Só adultos: o construtor nunca descreve menor de idade.
    options: [
      { value: '20', label: '20 a 25', prompt: 'young adult around 23 years old' },
      { value: '26', label: '26 a 32', prompt: 'adult around 29 years old' },
      { value: '33', label: '33 a 40', prompt: 'adult around 36 years old' },
      { value: '41', label: '41 a 50', prompt: 'adult around 45 years old' },
      { value: '50', label: '50+', prompt: 'mature adult in their mid fifties' },
    ],
  },
  {
    id: 'ethnicity',
    label: 'Etnia',
    section: 'perfil',
    display: 'chips',
    options: [
      { value: 'parda', label: 'Parda', prompt: 'mixed-race Brazilian' },
      { value: 'negra', label: 'Negra', prompt: 'Black Brazilian' },
      { value: 'branca', label: 'Branca', prompt: 'white Brazilian' },
      { value: 'asiatica', label: 'Asiática', prompt: 'East Asian Brazilian' },
      { value: 'indigena', label: 'Indígena', prompt: 'Indigenous Brazilian' },
      { value: 'latina', label: 'Latina', prompt: 'Latin American' },
      { value: 'arabe', label: 'Árabe', prompt: 'Middle Eastern' },
    ],
  },
  {
    id: 'expression',
    label: 'Expressão',
    section: 'perfil',
    display: 'chips',
    options: [
      { value: 'sorriso', label: 'Sorriso aberto', prompt: 'big genuine smile' },
      { value: 'sorriso-leve', label: 'Sorriso leve', prompt: 'soft smile' },
      { value: 'confiante', label: 'Confiante', prompt: 'confident expression' },
      { value: 'serio', label: 'Sério', prompt: 'serious expression' },
      { value: 'misterioso', label: 'Misterioso', prompt: 'mysterious gaze' },
    ],
  },
  {
    id: 'setting',
    label: 'Cenário',
    section: 'perfil',
    display: 'chips',
    options: [
      { value: 'estudio', label: 'Estúdio neutro', prompt: 'plain neutral studio background' },
      { value: 'cafe', label: 'Café', prompt: 'cozy coffee shop' },
      { value: 'rua', label: 'Rua', prompt: 'city street' },
      { value: 'praia', label: 'Praia', prompt: 'beach at golden hour' },
      { value: 'academia', label: 'Academia', prompt: 'modern gym' },
      { value: 'casa', label: 'Casa', prompt: 'bright cozy living room' },
    ],
  },
  {
    id: 'hairstyle',
    label: 'Corte de cabelo',
    section: 'rosto',
    display: 'photos',
    options: [
      { value: 'liso-longo', label: 'Liso longo', prompt: 'long straight hair' },
      { value: 'ondulado', label: 'Ondulado', prompt: 'wavy shoulder-length hair' },
      { value: 'cacheado', label: 'Cacheado', prompt: 'curly hair' },
      { value: 'crespo', label: 'Crespo curto', prompt: 'short coily natural hair' },
      { value: 'black-power', label: 'Black power', prompt: 'voluminous afro' },
      { value: 'trancas', label: 'Tranças', prompt: 'box braids' },
      { value: 'coque', label: 'Coque', prompt: 'hair in a sleek top bun' },
      { value: 'rabo', label: 'Rabo de cavalo', prompt: 'high ponytail' },
      { value: 'chanel', label: 'Chanel', prompt: 'chin-length bob with bangs' },
      { value: 'curto', label: 'Curto', prompt: 'short textured hair' },
      { value: 'raspado', label: 'Raspado', prompt: 'buzz cut' },
      { value: 'careca', label: 'Careca', prompt: 'shaved bald head' },
    ],
  },
  {
    id: 'faceShape',
    label: 'Formato do rosto',
    section: 'rosto',
    display: 'photos',
    options: [
      { value: 'oval', label: 'Oval', prompt: 'oval face shape' },
      { value: 'alongado', label: 'Alongado', prompt: 'long narrow face' },
      { value: 'quadrado', label: 'Quadrado', prompt: 'square face with a strong jawline' },
      { value: 'redondo', label: 'Redondo', prompt: 'round face with soft cheeks' },
      { value: 'coracao', label: 'Coração', prompt: 'heart-shaped face with a pointed chin' },
      { value: 'largo', label: 'Largo', prompt: 'wide face with broad cheekbones' },
    ],
  },
  {
    id: 'facialHair',
    label: 'Barba e bigode',
    section: 'rosto',
    display: 'photos',
    notForFeminine: true,
    options: [
      { value: 'sem', label: 'Sem barba', prompt: 'clean-shaven' },
      { value: 'bigode', label: 'Bigode fino', prompt: 'thin mustache' },
      { value: 'bigode-grosso', label: 'Bigode grosso', prompt: 'thick mustache' },
      { value: 'cavanhaque', label: 'Cavanhaque', prompt: 'goatee' },
      { value: 'barba-curta', label: 'Barba curta', prompt: 'short stubble beard' },
      { value: 'barba-cheia', label: 'Barba cheia', prompt: 'full thick beard' },
    ],
  },
  {
    id: 'features',
    label: 'Detalhes',
    section: 'rosto',
    display: 'chips',
    multiple: true,
    options: [
      { value: 'sardas', label: 'Sardas', prompt: 'freckles' },
      { value: 'covinhas', label: 'Covinhas', prompt: 'dimples' },
      { value: 'oculos', label: 'Óculos', prompt: 'stylish glasses' },
      { value: 'tatuagens', label: 'Tatuagens', prompt: 'visible tattoos' },
      { value: 'piercing', label: 'Piercing', prompt: 'nose piercing' },
      { value: 'pinta', label: 'Pinta', prompt: 'beauty mark' },
      { value: 'sobrancelhas', label: 'Sobrancelhas marcadas', prompt: 'bold eyebrows' },
      { value: 'maquiagem', label: 'Maquiagem marcante', prompt: 'bold makeup' },
    ],
  },
  {
    id: 'build',
    label: 'Tipo de corpo',
    section: 'corpo',
    display: 'photos',
    options: [
      { value: 'magro', label: 'Magro', prompt: 'slim build' },
      { value: 'atletico', label: 'Atlético', prompt: 'athletic build' },
      { value: 'medio', label: 'Médio', prompt: 'average build' },
      { value: 'curvilineo', label: 'Curvilíneo', prompt: 'curvy build' },
      { value: 'plus', label: 'Plus size', prompt: 'plus-size build' },
      { value: 'musculoso', label: 'Musculoso', prompt: 'very muscular bodybuilder build' },
    ],
  },
  {
    id: 'outfit',
    label: 'Estilo de roupa',
    section: 'corpo',
    display: 'photos',
    options: [
      { value: 'casual', label: 'Casual', prompt: 'casual outfit with a t-shirt and jeans' },
      { value: 'streetwear', label: 'Streetwear', prompt: 'streetwear outfit with an oversized hoodie and cargo pants' },
      { value: 'elegante', label: 'Elegante', prompt: 'elegant long dress' },
      { value: 'esportivo', label: 'Esportivo', prompt: 'sporty tracksuit' },
      { value: 'boho', label: 'Boho', prompt: 'boho flowy tunic dress' },
      { value: 'minimalista', label: 'Minimalista', prompt: 'minimalist knit sweater and straight trousers' },
      { value: 'y2k', label: 'Y2K', prompt: 'Y2K outfit with a baby tee and baggy low-rise jeans' },
      { value: 'executivo', label: 'Executivo', prompt: 'tailored business suit' },
    ],
  },
  {
    id: 'skin',
    label: 'Tom de pele',
    section: 'cores',
    display: 'swatches',
    options: [
      { value: 'muito-clara', label: 'Muito clara', prompt: 'very fair skin', swatch: '#f6dcc8' },
      { value: 'clara', label: 'Clara', prompt: 'fair skin', swatch: '#ecc3a3' },
      { value: 'media-clara', label: 'Média clara', prompt: 'light olive skin', swatch: '#d9a782' },
      { value: 'media', label: 'Média', prompt: 'medium tan skin', swatch: '#c28a62' },
      { value: 'morena', label: 'Morena', prompt: 'warm brown skin', swatch: '#a06a45' },
      { value: 'escura', label: 'Escura', prompt: 'deep brown skin', swatch: '#7a4b2e' },
      { value: 'muito-escura', label: 'Muito escura', prompt: 'very dark skin', swatch: '#4f2f1d' },
      { value: 'retinta', label: 'Retinta', prompt: 'rich deep ebony skin', swatch: '#33201a' },
    ],
  },
  {
    id: 'hairColor',
    label: 'Cor do cabelo',
    section: 'cores',
    display: 'swatches',
    options: [
      { value: 'preto', label: 'Preto', prompt: 'black', swatch: '#141010' },
      { value: 'castanho-escuro', label: 'Castanho escuro', prompt: 'dark brown', swatch: '#3b2416' },
      { value: 'castanho', label: 'Castanho claro', prompt: 'light brown', swatch: '#7a4e2d' },
      { value: 'ruivo', label: 'Ruivo', prompt: 'copper red', swatch: '#a8461f' },
      { value: 'mel', label: 'Loiro mel', prompt: 'honey blonde', swatch: '#c8964f' },
      { value: 'platinado', label: 'Platinado', prompt: 'platinum blonde', swatch: '#e8e1cf' },
      { value: 'grisalho', label: 'Grisalho', prompt: 'silver gray', swatch: '#a3a3a3' },
      { value: 'rosa', label: 'Rosa', prompt: 'pastel pink', swatch: '#f2a7c3' },
      { value: 'lilas', label: 'Lilás', prompt: 'lavender', swatch: '#b9a2e0' },
      { value: 'azul', label: 'Azul', prompt: 'electric blue', swatch: '#2f6bd8' },
      { value: 'neon', label: 'Verde neon', prompt: 'neon lime green', swatch: '#c6f432' },
    ],
  },
  {
    id: 'eyeColor',
    label: 'Cor dos olhos',
    section: 'cores',
    display: 'swatches',
    options: [
      { value: 'castanho-escuro', label: 'Castanho escuro', prompt: 'dark brown', swatch: '#3a2414' },
      { value: 'castanho', label: 'Castanho', prompt: 'brown', swatch: '#6b4423' },
      { value: 'mel', label: 'Mel', prompt: 'hazel', swatch: '#8a6a2e' },
      { value: 'ambar', label: 'Âmbar', prompt: 'amber', swatch: '#c07a1c' },
      { value: 'verde', label: 'Verde', prompt: 'green', swatch: '#4f7d4a' },
      { value: 'azul', label: 'Azul', prompt: 'blue', swatch: '#4a7fb8' },
      { value: 'azul-claro', label: 'Azul claro', prompt: 'light blue', swatch: '#9cc6e4' },
      { value: 'cinza', label: 'Cinza', prompt: 'gray', swatch: '#8b949b' },
    ],
  },
  {
    id: 'outfitColor',
    label: 'Cor predominante da roupa',
    section: 'cores',
    display: 'swatches',
    options: [
      { value: 'preto', label: 'Preto', prompt: 'black', swatch: '#18181b' },
      { value: 'branco', label: 'Branco', prompt: 'white', swatch: '#f4f4f0' },
      { value: 'cinza', label: 'Cinza', prompt: 'gray', swatch: '#8a8a8e' },
      { value: 'bege', label: 'Bege', prompt: 'beige', swatch: '#d6c3a5' },
      { value: 'marrom', label: 'Marrom', prompt: 'brown', swatch: '#6e4a32' },
      { value: 'vermelho', label: 'Vermelho', prompt: 'red', swatch: '#d22f2f' },
      { value: 'laranja', label: 'Laranja', prompt: 'orange', swatch: '#ff6b2c' },
      { value: 'amarelo', label: 'Amarelo', prompt: 'yellow', swatch: '#efc22b' },
      { value: 'verde', label: 'Verde', prompt: 'green', swatch: '#2f8f4e' },
      { value: 'azul', label: 'Azul', prompt: 'blue', swatch: '#2f6bd8' },
      { value: 'marinho', label: 'Azul-marinho', prompt: 'navy blue', swatch: '#1e2a4a' },
      { value: 'roxo', label: 'Roxo', prompt: 'purple', swatch: '#7d4cc4' },
      { value: 'rosa', label: 'Rosa', prompt: 'pink', swatch: '#ec6fa8' },
      { value: 'vinho', label: 'Vinho', prompt: 'burgundy', swatch: '#6e1f33' },
    ],
  },
]

/** Valor escolhido em cada grupo: um valor, ou vários nos grupos `multiple`. */
export type TraitSelection = Partial<Record<TraitGroupId, readonly string[]>>

/** Começo fixo do prompt de retrato. Também serve para achar os retratos no histórico. */
export const PERSONA_PROMPT_PREFIX = 'Photorealistic portrait photo of an adult'

const groupById = new Map(PERSONA_TRAIT_GROUPS.map((group) => [group.id, group]))

/** Cor da amostra de uma opção (ex.: a cor do cabelo escolhida), para tingir as ilustrações. */
export function swatchOf(id: TraitGroupId, value: string | undefined): string | undefined {
  return value ? groupById.get(id)?.options.find((option) => option.value === value)?.swatch : undefined
}

/** Barba e bigode somem quando a persona é feminina. */
export function isGroupVisible(group: TraitGroup, selection: TraitSelection): boolean {
  return !(group.notForFeminine && selection.gender?.[0] === 'feminino')
}

export function groupsOfSection(section: TraitSection, selection: TraitSelection): TraitGroup[] {
  return PERSONA_TRAIT_GROUPS.filter((group) => group.section === section && isGroupVisible(group, selection))
}

function pick(selection: TraitSelection, id: TraitGroupId, field: 'prompt' | 'label'): string[] {
  const group = groupById.get(id)
  const values = selection[id] ?? []
  if (!group || !isGroupVisible(group, selection)) return []
  return group.options.filter((option) => values.includes(option.value)).map((option) => option[field])
}

const first = (values: string[]) => values[0] ?? null

/** Prompt de retrato a partir das escolhas. Grupo sem escolha simplesmente fica de fora. */
export function buildPersonaPrompt(selection: TraitSelection, extra = ''): string {
  const p = (id: TraitGroupId) => first(pick(selection, id, 'prompt'))
  const subject = [p('age'), p('ethnicity'), p('gender') ?? 'person'].filter(Boolean).join(' ')
  const hairstyle = p('hairstyle')
  // A cor vai na frente do estilo ("honey blonde box braids"); careca não tem cor.
  const hair =
    selection.hairstyle?.[0] === 'careca' ? hairstyle : [p('hairColor'), hairstyle ?? (p('hairColor') ? 'hair' : null)].filter(Boolean).join(' ')
  const outfit = p('outfit') ?? (p('outfitColor') ? 'outfit' : null)

  const details = [
    p('niche') && `a ${p('niche')}`,
    p('build'),
    p('skin'),
    p('faceShape'),
    hair,
    p('eyeColor') && `${p('eyeColor')} eyes`,
    p('facialHair'),
    outfit && `wearing a ${[p('outfitColor'), outfit].filter(Boolean).join(' ')}`,
    ...pick(selection, 'features', 'prompt'),
    p('expression'),
  ].filter((part): part is string => Boolean(part))

  const setting = p('setting') ?? 'plain neutral studio background'
  const sentences = [
    `${PERSONA_PROMPT_PREFIX}: ${subject}${details.length ? `, ${details.join(', ')}` : ''}.`,
    `Setting: ${setting}.`,
    'Upper body, looking at the camera, natural light, real skin texture, shot on a modern smartphone, sharp focus.',
  ]
  const trimmed = extra.trim()
  if (trimmed) sentences.push(`Extra details: ${trimmed}.`)
  return sentences.join(' ')
}

/** Resumo em português, usado como descrição da persona salva. */
export function summarizeTraits(selection: TraitSelection): string {
  return PERSONA_TRAIT_GROUPS.flatMap((group) => pick(selection, group.id, 'label')).join(', ')
}

export function countSelected(selection: TraitSelection): number {
  return PERSONA_TRAIT_GROUPS.reduce((total, group) => total + pick(selection, group.id, 'label').length, 0)
}

/** Quantas escolhas há em cada aba, para o número ao lado do nome dela. */
export function countSelectedInSection(selection: TraitSelection, section: TraitSection): number {
  return groupsOfSection(section, selection).reduce((total, group) => total + pick(selection, group.id, 'label').length, 0)
}

/** Sorteia uma persona coerente: um valor por grupo e até dois detalhes. */
export function randomTraits(random: () => number = Math.random): TraitSelection {
  const choose = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
  const selection: Partial<Record<TraitGroupId, string[]>> = {}
  for (const group of PERSONA_TRAIT_GROUPS) {
    if (group.multiple) {
      const amount = Math.floor(random() * 3)
      const shuffled = [...group.options].sort(() => random() - 0.5)
      selection[group.id] = shuffled.slice(0, amount).map((option) => option.value)
    } else {
      selection[group.id] = [choose(group.options).value]
    }
  }
  if (selection.gender?.[0] === 'feminino') selection.facialHair = []
  // Retrato de referência sai melhor em fundo neutro.
  selection.setting = ['estudio']
  return selection
}

/** Liga ou desliga uma opção, respeitando grupos de escolha única. */
export function toggleTrait(selection: TraitSelection, group: TraitGroup, value: string): TraitSelection {
  const current = selection[group.id] ?? []
  const has = current.includes(value)
  const next = group.multiple ? (has ? current.filter((item) => item !== value) : [...current, value]) : has ? [] : [value]
  return { ...selection, [group.id]: next }
}
