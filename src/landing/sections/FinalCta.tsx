import { ArrowRight, Sparkles } from 'lucide-react'
import { AnchorButton, CtaLink } from '../components/CtaLink'
import { Reveal } from '../components/Reveal'
import { SAFETY_LINE } from '../content'

/** Último convite da página: bloco com borda em gradiente, luz que respira devagar e os dois caminhos. */
export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="px-4 pb-20 pt-24 md:pb-28 md:pt-32">
      <Reveal className="mx-auto max-w-6xl">
        <div className="relative rounded-[2rem] bg-gradient-to-br from-accent-soft/50 via-white/[0.08] to-galaxy/50 p-px shadow-[0_40px_120px_-50px_rgb(124_58_237/0.8)]">
          <div className="relative isolate overflow-hidden rounded-[calc(2rem-1px)] bg-[#08070f]">
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-[-12rem] -z-10 h-[30rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.45),transparent)] blur-2xl motion-safe:animate-[cta-breathe_9s_ease-in-out_infinite_alternate]"
            />
            <div aria-hidden="true" className="absolute -bottom-40 right-[-10rem] -z-10 h-[24rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.22),transparent)] blur-2xl" />
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 opacity-50 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(55%_60%_at_50%_35%,black,transparent)]"
            />
            <div aria-hidden="true" className="absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-accent-soft/70 to-transparent" />

            <div className="mx-auto flex max-w-4xl flex-col items-center px-5 py-20 text-center sm:px-8 md:py-28">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-200 ring-1 ring-white/[0.12] sm:text-xs">
                <Sparkles className="size-3.5 text-accent-soft" aria-hidden="true" />
                Comece sua próxima criação
              </p>
              <h2
                id="final-title"
                className="mt-7 text-balance font-landing text-[2.4rem] font-bold leading-[0.98] tracking-[-0.045em] text-zinc-50 sm:text-[3.4rem] md:text-[4.25rem]"
              >
                <span className="block">Sua próxima grande ideia</span>{' '}
                <span className="block bg-gradient-to-r from-accent-soft via-[#c4b5fd] to-galaxy bg-clip-text pb-[0.08em] text-transparent">começa aqui.</span>
              </h2>
              <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-zinc-300/85 md:text-lg">
                Explore novas possibilidades, transforme suas ideias em conteúdo e descubra tudo o que você pode criar com inteligência artificial.
              </p>
              <div className="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
                <CtaLink cta="final" size="lg" tone="glow" className="group w-full sm:w-auto">
                  Começar a criar
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                </CtaLink>
                <AnchorButton href="#precos" size="lg" tone="ghost" className="w-full backdrop-blur sm:w-auto">
                  Ver planos
                </AnchorButton>
              </div>
              <p className="mt-5 text-pretty text-[13px] text-zinc-400">{SAFETY_LINE}</p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
