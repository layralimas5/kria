import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { track } from '@/lib/analytics'
import { appendUtmToPath } from '@/lib/utm'
import { Reveal } from '../components/Reveal'

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

// O mesmo trabalho, contado duas vezes. Sem número inventado de horas ou de economia.
// O recuo de cada linha é o que desenha a fragmentação: nada de caixa, seta ou ícone.
const SCATTERED = [
  { text: 'Um chat para a ideia.', indent: 'sm:ml-0' },
  { text: 'Outro para o roteiro.', indent: 'sm:ml-14' },
  { text: 'Um site para a imagem.', indent: 'sm:ml-5' },
  { text: 'Mais um para o vídeo.', indent: 'sm:ml-20' },
] as const

const STEPS = ['Ideia', 'Roteiro', 'Imagem', 'Vídeo'] as const

function Fragmented() {
  const reduceMotion = useReducedMotion()
  return (
    <div className="lg:col-span-5 lg:pt-6">
      <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Criação fragmentada</p>
      <ul className="mt-7 space-y-3">
        {SCATTERED.map(({ text, indent }, index) => (
          <motion.li
            key={text}
            initial={reduceMotion ? false : { opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, delay: index * 0.09, ease: EASE_OUT_EXPO }}
            className={clsx('font-landing text-[1.35rem] font-medium tracking-[-0.02em] text-zinc-500 md:text-[1.6rem]', indent)}
          >
            {text}
          </motion.li>
        ))}
      </ul>
      <p className="mt-8 max-w-[22rem] text-pretty text-sm leading-relaxed text-zinc-500">
        Cada troca de aba é um arquivo baixado e enviado de novo, um texto colado e a marca explicada outra vez.
      </p>
    </div>
  )
}

function Integrated() {
  const reduceMotion = useReducedMotion()
  const destination = appendUtmToPath('/assistente/ideias')
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.9, delay: 0.35, ease: EASE_OUT_EXPO }}
      className="relative lg:col-span-6 lg:col-start-7"
    >
      <p className="flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-accent-soft">
        <span aria-hidden="true" className="h-px w-8 bg-accent-soft" />
        Criação com Vynkio
      </p>
      <p className="mt-7 text-balance font-landing text-[2rem] font-semibold leading-[1.04] tracking-[-0.04em] text-zinc-50 md:text-[2.6rem]">
        Ideia, roteiro, imagem e vídeo. <span className="text-accent-soft">No mesmo lugar.</span>
      </p>

      <div className="relative mt-9">
        <motion.span
          aria-hidden="true"
          initial={reduceMotion ? false : { scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1.4, delay: 0.7, ease: EASE_OUT_EXPO }}
          className="absolute inset-x-0 top-0 h-px origin-left bg-gradient-to-r from-accent-soft via-accent to-galaxy"
        />
        <ol aria-label="Etapas na mesma conta" className="grid grid-cols-2 sm:grid-cols-4">
          {STEPS.map((step, index) => (
            <motion.li
              key={step}
              initial={reduceMotion ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.85 + index * 0.18 }}
              className="pt-4 text-[15px] font-medium text-zinc-200"
            >
              <span className="mr-2 font-mono text-[12px] tabular-nums text-zinc-500">{String(index + 1).padStart(2, '0')}</span>
              {step}
            </motion.li>
          ))}
        </ol>
      </div>

      <p className="mt-8 max-w-[30rem] text-pretty text-base leading-relaxed text-zinc-400">
        Uma conta e um saldo de créditos. A marca guarda o público e o tom, e o que sai de uma etapa já entra na próxima.
      </p>

      <Link
        to={destination}
        onClick={() => track({ name: 'cta_click', params: { cta_id: 'workflow', destination } })}
        className="group mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg text-[15px] font-semibold text-zinc-50 underline-offset-[6px] transition-colors hover:text-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Testar o fluxo inteiro
        <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
      </Link>
    </motion.div>
  )
}

/** Comparação dos dois jeitos de criar, só com tipografia: o espalhado em cinza, o reunido em destaque. */
export function Workflow() {
  return (
    <section id="fluxo" aria-labelledby="fluxo-title" className="scroll-mt-20 px-4 pt-28 md:pt-40">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <Reveal>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Um jeito mais simples de criar</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 id="fluxo-title" className="mt-6 text-balance font-landing text-[2.4rem] font-bold leading-[1] tracking-[-0.045em] text-zinc-50 sm:text-[3.2rem] lg:text-[3.6rem]">
              Menos abas abertas. <span className="text-zinc-500">Mais ideias acontecendo.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-6 max-w-[32rem] text-pretty text-base leading-relaxed text-zinc-400 md:text-lg">
              Seu processo criativo não precisa ficar espalhado entre ferramentas diferentes.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-16 border-t border-white/[0.08] pt-14 md:mt-20 lg:grid-cols-12 lg:gap-8">
          <Fragmented />
          <Integrated />
        </div>
      </div>
    </section>
  )
}
