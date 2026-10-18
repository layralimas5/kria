import { Plus } from 'lucide-react'
import { SectionHeading } from '../components/SectionHeading'
import { FAQ } from '../content'

export function Faq() {
  return (
    <section aria-labelledby="faq-title" className="px-4 pt-20 md:pt-28">
      <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-[1fr_1.6fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <SectionHeading id="faq-title" title="Antes de começar" lead="O que todo mundo pergunta na primeira vez." />
        </div>
        <div className="space-y-2">
          {FAQ.map(({ question, answer }) => (
            <details key={question} className="group rounded-2xl border border-white/[0.06] bg-panel open:bg-panel-hover">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left text-[15px] font-semibold text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
                {question}
                <Plus className="size-5 shrink-0 text-accent transition-transform duration-200 group-open:rotate-45" aria-hidden="true" />
              </summary>
              <p className="px-5 pb-5 text-pretty text-[15px] text-zinc-400">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
