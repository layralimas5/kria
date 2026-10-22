import { CtaLink } from '../components/CtaLink'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { STEPS } from '../content'
import { CARD_HOVER } from '../styles'

export function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading id="como-title" align="center" title="Como funciona" lead="Quatro passos, do zero ao arquivo pronto. Sem câmera, sem editor, sem prompt em inglês." />
        <ol className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map(({ title, text }, index) => (
            <Reveal key={title} as="li" delay={index * 0.06} className={`relative rounded-2xl border border-white/[0.06] bg-panel p-6 ${CARD_HOVER}`}>
              <span className="font-landing text-5xl font-bold leading-none tracking-[-0.05em] text-accent-soft">0{index + 1}</span>
              <h3 className="mt-6 text-lg font-semibold text-zinc-50">{title}</h3>
              <p className="mt-1.5 text-pretty text-[15px] text-zinc-400">{text}</p>
            </Reveal>
          ))}
        </ol>
        <div className="mt-8 flex justify-center">
          <CtaLink cta="how_it_works">Começar a criar</CtaLink>
        </div>
      </div>
    </section>
  )
}
