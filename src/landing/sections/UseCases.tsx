import { Building2, Clapperboard, GraduationCap, Link2, Smartphone, Sparkles, Store, type LucideIcon } from 'lucide-react'
import { CtaLink } from '../components/CtaLink'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { USE_CASES } from '../content'
import { CARD_HOVER } from '../styles'

/** Na ordem de `USE_CASES`. */
const ICONS: readonly LucideIcon[] = [Smartphone, Clapperboard, Sparkles, Link2, GraduationCap, Store, Building2]

export function UseCases() {
  return (
    <section id="para-quem" aria-labelledby="para-quem-title" className="scroll-mt-16 px-4 pt-20 md:pt-28">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading id="para-quem-title" title="Para quem cria" lead="Do primeiro post de quem está começando à rotina de quem produz para vários clientes." />
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map(({ audience, example }, index) => {
            const Icon = ICONS[index] ?? Sparkles
            return (
              <Reveal key={audience} as="li" delay={(index % 4) * 0.05} className={`rounded-2xl border border-white/[0.06] bg-panel p-5 ${CARD_HOVER}`}>
                <Icon className="size-5 text-accent-soft" aria-hidden="true" />
                <h3 className="mt-4 text-[15px] font-semibold text-zinc-50">{audience}</h3>
                <p className="mt-1.5 text-pretty text-sm text-zinc-400">{example}</p>
              </Reveal>
            )
          })}
          <Reveal as="li" className="flex flex-col justify-between gap-4 rounded-2xl border border-accent/30 bg-[linear-gradient(160deg,rgba(124,58,237,0.16),transparent_70%)] p-5">
            <p className="text-[15px] font-semibold text-zinc-50">Seu caso não está aqui? Teste com os créditos grátis e veja se encaixa.</p>
            <CtaLink cta="use_cases" size="sm" className="self-start" />
          </Reveal>
        </ul>
      </div>
    </section>
  )
}
