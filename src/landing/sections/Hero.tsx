import { motion, useReducedMotion } from 'framer-motion'
import { Gift } from 'lucide-react'
import { AnchorButton, CtaLink } from '../components/CtaLink'
import { PhoneVideo } from '../components/PhoneVideo'
import { CLIPS, WELCOME_CREDITS } from '../content'

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const
const MODELS = ['Veo 3.1', 'Kling', 'Nano Banana'] as const

/** Celulares que entram pelas bordas do card, como os rostos do card de influenciador. */
const SIDE_PHONES = [
  { clip: CLIPS.dunes, className: 'left-[-3%] top-[14%] w-[15%] -rotate-[10deg]', from: -60 },
  { clip: CLIPS.chrome, className: 'left-[11%] top-[34%] w-[13%] rotate-[4deg]', from: -60 },
  { clip: CLIPS.aurora, className: 'right-[11%] top-[30%] w-[13%] -rotate-[5deg]', from: 60 },
  { clip: CLIPS.planet, className: 'right-[-3%] top-[10%] w-[15%] rotate-[10deg]', from: 60 },
] as const

const MOBILE_PHONES = [CLIPS.chrome, CLIPS.dunes, CLIPS.aurora] as const

export function Hero() {
  const reduceMotion = useReducedMotion()
  const enter = (delay: number, x = 0) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 24, x },
    animate: { opacity: 1, y: 0, x: 0 },
    transition: { duration: 0.8, delay, ease: EASE_OUT_EXPO },
  })

  return (
    <section id="topo" aria-labelledby="hero-title" className="px-4 pt-4">
      <div className="relative mx-auto max-w-[1440px] overflow-hidden rounded-[28px] border border-white/[0.06] bg-[radial-gradient(70%_60%_at_50%_0%,#24272c_0%,#121417_60%,#0f1113_100%)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(70%_70%_at_50%_40%,black,transparent)]"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(45%_70%_at_50%_100%,rgba(198,244,50,0.16),transparent)]" />

        {SIDE_PHONES.map(({ clip, className, from }, index) => (
          <motion.div key={clip.id} {...enter(0.2 + index * 0.08, from)} className={`absolute hidden lg:block ${className}`}>
            <PhoneVideo clip={clip} eager />
          </motion.div>
        ))}

        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 pb-14 pt-14 text-center md:pb-24 md:pt-24">
          <motion.p
            {...enter(0)}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-[13px] font-semibold text-accent ring-1 ring-accent/30"
          >
            <Gift className="size-3.5" aria-hidden="true" />
            {WELCOME_CREDITS} créditos grátis
          </motion.p>
          <motion.p {...enter(0.05)} className="mt-6 font-display text-sm font-bold uppercase tracking-[0.02em] text-zinc-100">
            Vídeo, imagem e influenciador com IA
          </motion.p>
          <motion.h1
            {...enter(0.1)}
            id="hero-title"
            className="mt-3 text-balance font-display text-[3.1rem] font-bold uppercase leading-[0.88] tracking-[-0.045em] text-zinc-50 sm:text-7xl lg:text-[6.4rem]"
          >
            Você descreve. <span className="text-accent">A IA grava.</span>
          </motion.h1>
          <motion.p {...enter(0.16)} className="mt-6 max-w-xl text-pretty text-[17px] font-medium text-zinc-400">
            As melhores IAs de vídeo e imagem num lugar só, em português. Escreve o que você quer e recebe pronto pra postar.
          </motion.p>
          <motion.div {...enter(0.22)} className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <CtaLink size="lg" className="w-full sm:w-auto" />
            <AnchorButton href="#galeria" size="lg" className="w-full sm:w-auto">
              Ver o que dá pra fazer
            </AnchorButton>
          </motion.div>
          <motion.p {...enter(0.28)} className="mt-7 text-[13px] text-zinc-500">
            Sem mensalidade · Paga com Pix · Por trás: {MODELS.join(', ')}
          </motion.p>
        </div>

        <div className="relative -mb-8 flex justify-center gap-3 px-4 lg:hidden" aria-hidden="true">
          {MOBILE_PHONES.map((clip, index) => (
            <motion.div key={clip.id} {...enter(0.3 + index * 0.08)} className={index === 1 ? 'w-[38%] max-w-[200px]' : 'mt-10 w-[30%] max-w-[160px]'}>
              <PhoneVideo clip={clip} eager={index === 1} social={index === 1} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
