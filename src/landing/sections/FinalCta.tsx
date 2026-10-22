import { CtaLink } from '../components/CtaLink'
import { WELCOME_CREDITS } from '../content'

export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="px-4 py-20 md:py-28">
      <div className="relative isolate mx-auto max-w-[1440px] overflow-hidden rounded-[28px] border border-white/[0.06] bg-[radial-gradient(70%_90%_at_50%_0%,#2a1c55_0%,#14112c_55%,#0b0a1a_100%)]">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(60%_70%_at_50%_30%,black,transparent)]"
        />
        <div aria-hidden="true" className="absolute -bottom-24 left-1/2 -z-10 h-64 w-[70%] -translate-x-1/2 rounded-full bg-galaxy/20 blur-3xl" />
        <div className="mx-auto flex max-w-3xl flex-col items-center px-5 py-20 text-center md:py-28">
          <h2 id="final-title" className="text-balance font-landing text-[2.6rem] font-bold uppercase leading-[0.9] tracking-[-0.045em] text-zinc-50 md:text-[4.75rem]">
            Da primeira ideia <span className="text-accent-soft">à próxima criação.</span>
          </h2>
          <p className="mt-6 max-w-xl text-pretty text-[17px] font-medium text-zinc-300">
            Crie a conta, use os {WELCOME_CREDITS} créditos de boas-vindas e veja o fluxo inteiro funcionando antes de escolher um plano.
          </p>
          <CtaLink cta="final" size="lg" className="mt-9">
            Começar no Vynkio
          </CtaLink>
        </div>
      </div>
    </section>
  )
}
