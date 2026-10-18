import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { AUDIENCES, STEPS } from '../content'
import { CARD_HOVER } from '../styles'

export function HowItWorks() {
  return (
    <section aria-labelledby="como-title" className="px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading id="como-title" align="center" title="Três passos. Nenhum é gravar." lead="Sem câmera, sem cenário, sem editor de vídeo." />
        <ol className="mt-10 grid gap-3 md:grid-cols-3">
          {STEPS.map(({ title, text }, index) => (
            <Reveal key={title} as="li" delay={index * 0.06} className={`rounded-2xl border border-white/[0.06] bg-panel p-6 ${CARD_HOVER}`}>
              <span className="font-display text-6xl font-bold leading-none tracking-[-0.05em] text-accent">0{index + 1}</span>
              <h3 className="mt-6 font-display text-xl font-bold uppercase tracking-[-0.02em] text-zinc-50">{title}</h3>
              <p className="mt-1.5 text-pretty text-[15px] text-zinc-400">{text}</p>
            </Reveal>
          ))}
        </ol>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {AUDIENCES.map(({ title, text }) => (
            <li key={title} className={`flex items-baseline gap-3 rounded-2xl border border-white/[0.06] px-6 py-4 ${CARD_HOVER}`}>
              <span className="shrink-0 text-[15px] font-semibold text-zinc-50">{title}</span>
              <span className="text-pretty text-sm text-zinc-500">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
