// Peças da vitrine de criações de "Como funciona". Cada uma aponta para um prompt de
// `showcase.json` (foto, gerada por `landing:showcase`) ou de `avatars.json` (vídeo, `landing:avatars`).
// O modelo é o que o script usa para gerar a peça: foto com referência sai do Nano Banana 2 Edição.
import type { Creation } from './components/CreationTile'
import { avatar } from './content'
import { showcase } from './showcase'

function photo(id: string, label: string, title?: string): Creation {
  const image = showcase(id)
  const model = image.prompt.startsWith('A mesma') ? 'Nano Banana 2 Edição' : 'Nano Banana 2'
  return { kind: 'image', image, model, label, title: title ?? image.title }
}

function video(id: string, label = 'Vídeo com IA'): Creation {
  const clip = avatar(id)
  return { kind: 'video', clip, label, title: clip.title }
}

export const TAB_CREATIONS = {
  imagens: [photo('g-hamburguer', 'Publicitária'), photo('g-moqueca', 'Gastronomia'), photo('g-quarto', 'Interiores')],
  videos: [video('seu-juca'), video('tia-gloria'), video('rainha-pastel')],
  personagens: [
    photo('marina', 'Personagem', 'Marina'),
    photo('marina-praia', 'Mesmo rosto'),
    photo('marina-cafe', 'Mesmo rosto'),
    photo('marina-noite', 'Mesmo rosto'),
  ],
} as const
