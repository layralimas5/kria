// Os formatos da 0015 para o modo demo, sem o texto dos prompts (que no ar fica só no servidor).
// demoFormats.test.ts confere slugs e opções contra a migration.

import type { Row } from './demoData'

const field = (key: string, label: string, choices: readonly (readonly [string, string])[]) => ({
  key,
  label,
  choices: choices.map(([value, choiceLabel]) => ({ value, label: choiceLabel })),
})

const LIGHT_ROOM = field('light', 'Luz', [['dia', 'Dia claro'], ['fim-de-tarde', 'Fim de tarde'], ['noite', 'Noite aconchegante']])

export const DEMO_FORMATS: Row[] = [
  {
    slug: 'tour-comodo', name: 'Tour do cômodo', niche: 'Imóveis', flow: 'single', model_slug: 'video-kling', edit_model_slug: null,
    description: 'A foto do cômodo vira um vídeo com a câmera passeando pelo ambiente.',
    fields: [field('movement', 'Movimento', [['entrar', 'Entrar devagar'], ['panoramica', 'Panorâmica'], ['revelar', 'Revelar']]), LIGHT_ROOM],
    example_path: null, badge: 'NOVO', position: 10,
  },
  {
    slug: 'antes-depois', name: 'Antes e depois', niche: 'Imóveis', flow: 'before_after', model_slug: 'video-kling', edit_model_slug: 'foto-edicao',
    description: 'O cômodo vazio ou antigo ganha móveis ou reforma, e o vídeo mostra a transformação.',
    fields: [
      field('action', 'O que fazer', [['mobiliar', 'Mobiliar'], ['reformar', 'Reformar']]),
      field('style', 'Estilo', [['moderno', 'Moderno'], ['escandinavo', 'Escandinavo'], ['industrial', 'Industrial'], ['classico', 'Clássico']]),
    ],
    example_path: null, badge: 'TOP', position: 20,
  },
  {
    slug: 'vista-drone', name: 'Vista de drone', niche: 'Imóveis', flow: 'single', model_slug: 'video-kling', edit_model_slug: null,
    description: 'A foto da fachada vira uma tomada aérea, como se fosse filmada por drone.',
    fields: [
      field('movement', 'Movimento', [['aproximar', 'Aproximar'], ['orbitar', 'Orbitar'], ['subir', 'Subir']]),
      field('light', 'Luz', [['dia', 'Dia claro'], ['por-do-sol', 'Pôr do sol']]),
    ],
    example_path: null, badge: null, position: 30,
  },
  {
    slug: 'produto-girando', name: 'Produto girando', niche: 'E-commerce', flow: 'single', model_slug: 'video-kling', edit_model_slug: null,
    description: 'A foto do produto vira um vídeo de vitrine, girando ou com a câmera chegando perto.',
    fields: [field('movement', 'Movimento', [['girar', 'Girar 360°'], ['aproximar', 'Aproximar'], ['flutuar', 'Flutuar']])],
    example_path: null, badge: null, position: 40,
  },
  {
    slug: 'produto-em-cena', name: 'Produto em cena', niche: 'E-commerce', flow: 'single', model_slug: 'foto-edicao', edit_model_slug: null,
    description: 'O produto sai do fundo branco e aparece num cenário de anúncio.',
    fields: [
      field('scene', 'Cenário', [['cozinha', 'Cozinha clara'], ['banheiro', 'Banheiro de mármore'], ['cafe', 'Mesa de café'], ['ar-livre', 'Ao ar livre'], ['estudio', 'Estúdio colorido']]),
    ],
    example_path: null, badge: null, position: 50,
  },
  {
    slug: 'prato-vivo', name: 'Prato que ganha vida', niche: 'Restaurantes', flow: 'single', model_slug: 'video-kling', edit_model_slug: null,
    description: 'A foto do prato ganha vapor, calda escorrendo ou a câmera chegando perto.',
    fields: [field('effect', 'Efeito', [['vapor', 'Vapor'], ['calda', 'Calda escorrendo'], ['aproximar', 'Aproximar']])],
    example_path: null, badge: null, position: 60,
  },
]
