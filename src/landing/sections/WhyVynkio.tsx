import { motion, useReducedMotion } from 'framer-motion'
import { Reveal } from '../components/Reveal'
import { AI_MODELS } from '../content'

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

interface Advantage {
  readonly title: string
  readonly text: string
  /** Detalhe real que sustenta a frase, em texto miúdo. */
  readonly detail?: string
}

// Sem comparação com concorrente, sem preço e sem promessa de resultado. Mudou o produto, muda aqui.
const ADVANTAGES: readonly Advantage[] = [
  {
    title: 'Crie sem mudar de plataforma.',
    text: 'Imagem, vídeo, personagem e texto na mesma conta, com um saldo de créditos só.',
  },
  {
    title: 'Explore diferentes modelos de IA.',
    text: 'Escolha entre os modelos disponíveis no seu plano e compare resultados em cada projeto.',
    detail: AI_MODELS.filter((model) => model.kind === 'Imagem' || model.kind === 'Vídeo')
      .map((model) => model.name)
      .join(' · '),
  },
  {
    title: 'Seu processo, mais organizado.',
    text: 'Ideias, roteiros e criações organizados pela sua marca, e cada etapa começa com o que a anterior entregou.',
  },
]

function AdvantageRow({ advantage, index }: { readonly advantage: Advantage; readonly index: number }) {
  const reduceMotion = useReducedMotion()
  const delay = 0.1 + index * 0.12
  return (
    <motion.li
      initial={reduceMotion ? false : 'hidden'}
      whileInView="shown"
      viewport={{ once: true, margin: '-60px' }}
      className="group relative"
    >
      <motion.span
        aria-hidden="true"
        variants={{ hidden: { scaleX: 0 }, shown: { scaleX: 1 } }}
        transition={{ duration: 1.1, delay, ease: EASE_OUT_EXPO }}
        className="absolute inset-x-0 top-0 h-px origin-left bg-white/[0.1]"
      />
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 h-px w-0 bg-accent-soft transition-[width] duration-700 ease-out group-hover:w-24 motion-reduce:transition-none"
      />
      <motion.div
        variants={{ hidden: { opacity: 0, y: 16 }, shown: { opacity: 1, y: 0 } }}
        transition={{ duration: 0.8, delay: delay + 0.15, ease: EASE_OUT_EXPO }}
        className="grid gap-x-8 gap-y-3 py-9 sm:grid-cols-[4rem_minmax(0,1fr)] md:py-11"
      >
        <span className="font-mono text-[13px] tabular-nums text-zinc-500 transition-colors duration-300 group-hover:text-accent-soft">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div>
          <h3 className="text-balance font-landing text-[1.75rem] font-semibold leading-[1.05] tracking-[-0.035em] text-zinc-50 md:text-[2.4rem]">{advantage.title}</h3>
          <p className="mt-3 max-w-[34rem] text-pretty text-base leading-relaxed text-zinc-400 md:text-[17px]">{advantage.text}</p>
          {advantage.detail && <p className="mt-4 max-w-[34rem] text-pretty text-[13px] leading-relaxed text-zinc-500">{advantage.detail}</p>}
        </div>
      </motion.div>
    </motion.li>
  )
}

/** "Por que Vynkio?": título fixo à esquerda e três diferenciais em linhas finas à direita. */
export function WhyVynkio() {
  return (
    <section id="por-que" aria-labelledby="por-que-title" className="scroll-mt-20 px-4 pt-16 md:pt-40">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5 lg:self-start lg:sticky lg:top-28">
          <Reveal>
            <p className="flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              <span aria-hidden="true" className="h-px w-8 bg-accent-soft" />
              Por que Vynkio
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 id="por-que-title" className="mt-7 font-landing text-[2.6rem] font-bold leading-[0.98] tracking-[-0.045em] text-zinc-50 sm:text-[3.4rem] lg:text-[3.9rem]">
              <span className="block">Uma plataforma.</span> <span className="block text-accent-soft">Mais possibilidades.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-6 max-w-[24rem] text-pretty text-base leading-relaxed text-zinc-400 md:text-lg">
              Da primeira ideia ao conteúdo final, com suas ferramentas de criação reunidas em um só lugar.
            </p>
          </Reveal>
        </div>

        <ol className="border-b border-white/[0.1] lg:col-span-7 lg:col-start-6 lg:mt-24">
          {ADVANTAGES.map((advantage, index) => (
            <AdvantageRow key={advantage.title} advantage={advantage} index={index} />
          ))}
        </ol>
      </div>
    </section>
  )
}
