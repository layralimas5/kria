// Roteiros falsos do Multiplicador no modo demo: o mesmo formato que a function devolve,
// montados a partir dos takes do projeto. Servem para testar a tela e a montagem sem custo.

import { normalizeAnalysis, normalizeScript, type TakeInfo, type VariationScript } from '@/domain/multiplier'
import type { Row } from './demoData'

const ANGLES = [
  'Problema e solução',
  'Demonstração',
  'Educativo',
  'Curiosidade',
  'Passo a passo',
  'Objeção',
  'Rotina',
  'Lista rápida',
  'Bastidores',
  'Comparação honesta',
] as const

const HOOKS: Record<(typeof ANGLES)[number], (product: string) => string> = {
  'Problema e solução': (product) => `Cansou de tentar e nada funcionar? Olha o ${product}`,
  Demonstração: (product) => `Vou te mostrar o ${product} de perto`,
  Educativo: () => 'Três coisas que ninguém te conta antes de comprar',
  Curiosidade: () => 'Repara no detalhe do segundo 3',
  'Passo a passo': (product) => `Como usar o ${product} em 3 passos`,
  Objeção: () => '"Será que vale a pena?" Vem ver',
  Rotina: (product) => `Minha rotina com o ${product}`,
  'Lista rápida': () => 'Tudo que vem na caixa, rapidinho',
  Bastidores: () => 'O que acontece antes do post',
  'Comparação honesta': () => 'Antes e depois de organizar a rotina',
}

const CTAS = ['Link na bio', 'Comenta EU que te mando o link', 'Salva para não perder', 'Chama no direct', 'Compartilha com quem precisa']

function beatsFor(takes: readonly TakeInfo[], variation: number) {
  return [0, 1, 2].map((step) => {
    const index = (variation + step) % takes.length
    const take = takes[index]!
    const room = Math.max(0, take.duration - 3.5)
    return {
      take: index + 1,
      start: take.kind === 'video' ? Math.round(((variation * 1.7 + step * 2.3) % (room + 0.1)) * 10) / 10 : 0,
      duration: step === 1 ? 4 : 3.5,
      text: take.note ? take.note : step === 0 ? 'Olha só' : step === 1 ? 'Na prática' : 'E pronto',
    }
  })
}

export function demoMultiplierOutput(project: Row, count: number) {
  const takes = project.takes as TakeInfo[]
  const product = String(project.product_name || project.name)
  const variations: VariationScript[] = []
  for (let index = 0; index < count; index += 1) {
    const angle = ANGLES[index % ANGLES.length]!
    const script = normalizeScript(
      {
        angle,
        hook: HOOKS[angle](product),
        beats: beatsFor(takes, index),
        cta: CTAS[index % CTAS.length],
        caption: `${HOOKS[angle](product)}\n\nRoteiro de exemplo do modo demo, com o ângulo "${angle}".\n\n${CTAS[index % CTAS.length]}`,
      },
      takes,
    )
    if (script) variations.push(script)
  }
  const analysis = normalizeAnalysis({
    benefits: project.product_description ? [String(project.product_description).slice(0, 120)] : [],
    limitations: takes.some((take) => !take.note) ? ['Alguns takes estão sem descrição: os roteiros usam esses só como apoio visual.'] : [],
    opportunities: ['Gravar um take curto de reação ao produto renderia ganchos mais fortes.'],
  })
  return { analysis, variations }
}
