import { Plus } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { FAQ } from '../content'

export function Faq() {
  return (
    <section aria-labelledby="faq-title" className="border-t border-white/[0.06] py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading id="faq-title" eyebrow="Dúvidas" title="Antes de começar" />
        </Reveal>
        <div className="mt-12 divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {FAQ.map(({ question, answer }) => (
            <details key={question} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-5 text-left font-medium text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
                {question}
                <Plus className="size-5 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-45" aria-hidden="true" />
              </summary>
              <p className="pb-5 pr-8 text-pretty text-zinc-400">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
