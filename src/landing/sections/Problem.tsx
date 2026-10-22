import { Clock, CreditCard, UserRoundX, type LucideIcon } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'

interface Situation {
  readonly icon: LucideIcon
  readonly scene: string
  readonly detail: string
  /** O que a situação custa: tempo, dinheiro ou oportunidade. */
  readonly cost: string
}

const SITUATIONS: readonly Situation[] = [
  {
    icon: Clock,
    scene: 'A pauta num chat, o roteiro em outro, a imagem num terceiro site.',
    detail: 'Para um vídeo de 15 segundos você copia texto, baixa arquivo, sobe de novo e explica tudo outra vez a cada aba.',
    cost: 'Custa a tarde que era para postar',
  },
  {
    icon: UserRoundX,
    scene: 'O personagem muda de rosto a cada geração.',
    detail: 'A foto de ontem e a de hoje parecem pessoas diferentes, o post não fecha e você gera de novo até acertar.',
    cost: 'Custa crédito gasto em imagem que não serve',
  },
  {
    icon: CreditCard,
    scene: 'Uma assinatura em dólar para cada ferramenta.',
    detail: 'Imagem num lugar, vídeo em outro, texto num terceiro, cada um com o seu plano, o seu limite e o prompt em inglês.',
    cost: 'Custa várias faturas no cartão todo mês',
  },
]

export function Problem() {
  return (
    <section id="problema" aria-labelledby="problema-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          id="problema-title"
          align="center"
          title={
            <>
              Um post. <span className="text-zinc-50">Cinco abas abertas.</span>
            </>
          }
          lead="Se você cria com IA, provavelmente já passou por pelo menos uma destas."
        />

        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          {SITUATIONS.map(({ icon: Icon, scene, detail, cost }, index) => (
            <Reveal key={scene} as="li" delay={index * 0.06} className="flex flex-col rounded-2xl border border-white/[0.06] bg-panel p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent-soft ring-1 ring-accent/20">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-pretty text-lg font-semibold leading-snug text-zinc-50">{scene}</h3>
              <p className="mb-5 mt-2 text-pretty text-[15px] text-zinc-400">{detail}</p>
              <p className="mt-auto border-t border-white/[0.06] pt-4 text-sm font-semibold text-hot">{cost}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
