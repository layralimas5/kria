import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { AUDIENCES, STEPS } from '../content'

export function HowItWorks() {
  return (
    <section aria-labelledby="como-title" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading id="como-title" eyebrow="Como funciona" title="Três passos, nenhum deles é gravar" />
        </Reveal>
        <ol className="mt-14 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ title, text }, index) => (
            <Reveal key={title} as="li" delay={index * 0.08} className="h-full rounded-2xl border border-white/[0.08] p-6 md:p-8">
              <span className="font-mono text-sm text-accent">0{index + 1}</span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-zinc-50">{title}</h3>
              <p className="mt-2 text-pretty text-zinc-400">{text}</p>
            </Reveal>
          ))}
        </ol>

        <Reveal className="mt-20 md:mt-28">
          <h3 className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Feito pra quem vende</h3>
        </Reveal>
        <ul className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] md:grid-cols-3">
          {AUDIENCES.map(({ title, text }) => (
            <li key={title} className="bg-zinc-950 p-6 md:p-8">
              <p className="text-lg font-semibold tracking-tight text-zinc-50">{title}</p>
              <p className="mt-2 text-pretty text-zinc-400">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
